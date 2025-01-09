use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use anyhow::{bail, Context, Result};
use futures::prelude::*;
use log::{info, warn};
use operational_transform::OperationSeq;
use parking_lot::{RwLock, RwLockUpgradableReadGuard};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, Notify};
use warp::ws::{Message, WebSocket};

use crate::ot::transform_index;

pub struct Collab {
    state: RwLock<DocState>,
    count: AtomicU64,
    notify: Notify,
    update: broadcast::Sender<ServerMessage>,
    killed: AtomicBool,
}

#[derive(Default)]
struct DocState {
    operations: Vec<UserOperation>,
    text: String,
    users: HashMap<u64, UserInfo>,
    cursors: HashMap<u64, CursorData>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct UserOperation {
    id: u64,
    operation: OperationSeq,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct UserInfo {
    name: String,
    color: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CursorData {
    cursors: Vec<u32>,
    selections: Vec<(u32, u32)>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum ClientMessage {
    Edit {
        revision: usize,
        operation: OperationSeq,
    },
    ClientInfo(UserInfo),
    CursorData(CursorData),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum ServerMessage {
    Identity(u64),
    History {
        start: usize,
        operations: Vec<UserOperation>,
    },
    UserInfo { id: u64, info: Option<UserInfo> },
    UserCursor { id: u64, data: CursorData },
}

impl From<ServerMessage> for Message {
    fn from(msg: ServerMessage) -> Self {
        let serialized = serde_json::to_string(&msg).expect("failed serialize");
        Message::text(serialized)
    }
}

impl Default for Collab {
    fn default() -> Self {
        let (tx, _) = broadcast::channel(16);
        Self {
            state: Default::default(),
            count: Default::default(),
            notify: Default::default(),
            update: tx,
            killed: AtomicBool::new(false),
        }
    }
}

impl Collab {
    // Client connection handle.
    pub async fn on_connection(&self, socket: WebSocket) {
        let id = self.count.fetch_add(1, Ordering::Relaxed);
        info!("connection id = {}", id);
        if let Err(e) = self.handle_connection(id, socket).await {
            warn!("connection terminated early: {}", e);
        }
        info!("disconnection, id = {}", id);
        self.state.write().users.remove(&id);
        self.state.write().cursors.remove(&id);
        self.update
            .send(ServerMessage::UserInfo { id, info: None })
            .ok();
    }

    pub fn revision(&self) -> usize {
        let state = self.state.read();
        state.operations.len()
    }

    pub fn kill(&self) {
        self.killed.store(true, Ordering::Relaxed);
        self.notify.notify_waiters();
    }

    pub fn killed(&self) -> bool {
        self.killed.load(Ordering::Relaxed)
    }

    async fn handle_connection(&self, id: u64, mut socket: WebSocket) -> Result<()> {
        let mut update_rx = self.update.subscribe();

        let mut revision: usize = self.send_initial(id, &mut socket).await?;

        loop {
            let notified = self.notify.notified();
            if self.killed() {
                break;
            }
            if self.revision() > revision {
                revision = self.send_history(revision, &mut socket).await?
            }

            tokio::select! {
                _ = notified => {}
                update = update_rx.recv() => {
                    socket.send(update?.into()).await?;
                }
                result = socket.next() => {
                    match result {
                        None => break,
                        Some(message) => {
                            self.handle_message(id, message?).await?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    async fn send_initial(&self, id: u64, socket: &mut WebSocket) -> Result<usize> {
        socket.send(ServerMessage::Identity(id).into()).await?;
        let mut messages = Vec::new();
        let revision = {
            let state = self.state.read();
            if !state.operations.is_empty() {
                messages.push(ServerMessage::History {
                    start: 0,
                    operations: state.operations.clone(),
                });
            }
            for (&id, info) in &state.users {
                messages.push(ServerMessage::UserInfo {
                    id,
                    info: Some(info.clone()),
                });
            }
            for (&id, data) in &state.cursors {
                messages.push(ServerMessage::UserCursor {
                    id,
                    data: data.clone(),
                });
            }
            state.operations.len()
        };
        for msg in messages {
            socket.send(msg.into()).await?;
        }
        Ok(revision)
    }

    async fn send_history(&self, start: usize, socket: &mut WebSocket) -> Result<usize> {
        let operations = {
            let state = self.state.read();
            let len = state.operations.len();
            if start < len {
                state.operations[start..].to_owned()
            } else {
                Vec::new()
            }
        };
        let num_ops = operations.len();
        if num_ops > 0 {
            let msg = ServerMessage::History { start, operations };
            socket.send(msg.into()).await?;
        }
        Ok(start + num_ops)
    }

    async fn handle_message(&self, id: u64, message: Message) -> Result<()> {
        let msg: ClientMessage = match message.to_str() {
            Ok(text) => serde_json::from_str(text).context("failed to deserialize message")?,
            Err(()) => return Ok(()), 
        };
        match msg {
            ClientMessage::Edit {
                revision,
                operation,
            } => {
                self.apply_edit(id, revision, operation)
                    .context("invalid edit operation")?;
                self.notify.notify_waiters();
            }
            ClientMessage::ClientInfo(info) => {
                self.state.write().users.insert(id, info.clone());
                let msg = ServerMessage::UserInfo {
                    id,
                    info: Some(info),
                };
                self.update.send(msg).ok();
            }
            ClientMessage::CursorData(data) => {
                self.state.write().cursors.insert(id, data.clone());
                let msg = ServerMessage::UserCursor { id, data };
                self.update.send(msg).ok();
            }
        }
        Ok(())
    }

    fn apply_edit(&self, id: u64, revision: usize, mut operation: OperationSeq) -> Result<()> {
        info!(
            "edit: id = {}, revision = {}, base_len = {}, target_len = {}",
            id,
            revision,
            operation.base_len(),
            operation.target_len()
        );
        let state = self.state.upgradable_read();
        let len = state.operations.len();
        if revision > len {
            bail!("got revision {}, but current is {}", revision, len);
        }
        for history_op in &state.operations[revision..] {
            operation = operation.transform(&history_op.operation)?.0;
        }
        if operation.target_len() > 100000 {
            bail!(
                "target length {} is greater than 100 KB maximum",
                operation.target_len()
            );
        }
        let new_text = operation.apply(&state.text)?;
        let mut state = RwLockUpgradableReadGuard::upgrade(state);
        for (_, data) in state.cursors.iter_mut() {
            for cursor in data.cursors.iter_mut() {
                *cursor = transform_index(&operation, *cursor);
            }
            for (start, end) in data.selections.iter_mut() {
                *start = transform_index(&operation, *start);
                *end = transform_index(&operation, *end);
            }
        }
        state.operations.push(UserOperation { id, operation });
        state.text = new_text;
        Ok(())
    }
}
