use server::{database::Database, server, ServerConfig};

#[tokio::main]
async fn main() {
    pretty_env_logger::init();
    let port = 5050;
    let config = ServerConfig {
        expiry_days: std::env::var("EXPIRY_DAYS")
            .unwrap_or_else(|_| String::from("1"))
            .parse()
            .expect("Unable to parse EXPIRY_DAYS"),
        database: match std::env::var("SQLITE_URI") {
            Ok(uri) => Some(
                Database::new(&uri)
                    .await
                    .expect("Unable to connect to SQLITE_URI"),
            ),
            Err(_) => None,
        },
    };
    warp::serve(server(config)).run(([0, 0, 0, 0], port)).await;
}
