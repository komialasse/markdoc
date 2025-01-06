
use std::sync::Arc;

use dashmap::DashMap;
use log::{error, info};
use tokio::time::{self, Instant};
use warp::{filters::BoxedFilter, ws::Ws, Filter, Rejection, Reply};

use crate::collab::Collab;

mod ot;
mod collab;

struct Document {
    last_accessed: Instant,
    Collab: Arc<Collab>,
}

impl Document {
    fn new(Collab: Arc<Collab>) -> Self {
        Self {
            last_accessed: Instant::now(),
            Collab,
        }
    }
}

impl Drop for Document {
    fn drop(&mut self) {
        self.Collab.kill();
    }
}

#[allow(dead_code)]
#[derive(Debug)]
struct CustomReject(anyhow::Error);

impl warp::reject::Reject for CustomReject {}

#[derive(Clone)]
struct ServerState {
    documents: Arc<DashMap<String, Document>>,
}


pub fn server() -> BoxedFilter<(impl Reply,)> {
    warp::path("api")
    .and(backend())
    .or(frontend())
    .boxed()
}

fn frontend() -> BoxedFilter<(impl Reply,)> {
    warp::fs::dir("dist").boxed()
}

fn backend() -> BoxedFilter<(impl Reply,)> {
    let state = ServerState {
        documents: Default::default(),
    };

    let state_filter = warp::any().map(move || state.clone());

    let socket = warp::path!("socket" / String)
        .and(warp::ws())
        .and(state_filter.clone())
        .and_then(socket_handler);

    socket.boxed()
}

async fn socket_handler(id: String, ws: Ws, state: ServerState) -> Result<impl Reply, Rejection> {
    use dashmap::mapref::entry::Entry;

    let mut entry = match state.documents.entry(id.clone()) {
        Entry::Occupied(e) => e.into_ref(),
        Entry::Vacant(e) => {
            let collab = Collab::default();
            e.insert(Document::new(Arc::new(collab)))
        }
    };

    let value = entry.value_mut();
    value.last_accessed = Instant::now();
    let Collab = Arc::clone(&value.Collab);
    Ok(ws.on_upgrade(|socket| async move { Collab.on_connection(socket).await }))
}
