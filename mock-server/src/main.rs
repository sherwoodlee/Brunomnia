#[allow(dead_code)]
#[path = "../../src-tauri/src/mock_deployment.rs"]
mod mock_deployment;
#[allow(dead_code)]
#[path = "../../src-tauri/src/mock_faker.rs"]
mod mock_faker;
#[allow(dead_code)]
#[path = "../../src-tauri/src/mock_server.rs"]
mod mock_server;
#[allow(dead_code)]
#[path = "../../src-tauri/src/models.rs"]
mod models;

#[tokio::main]
async fn main() {
    std::process::exit(mock_deployment::run_cli(std::env::args_os().skip(1)).await);
}
