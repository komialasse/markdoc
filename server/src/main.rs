use server::server;

#[tokio::main]
async fn main() {
    pretty_env_logger::init();
    let port = 5050;
    warp::serve(server()).run(([0, 0, 0, 0], port)).await;
}
