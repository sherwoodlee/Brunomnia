mod grpc_client;
mod http_client;
mod mock_server;
mod models;
mod streaming;

use models::{HttpRequestInput, HttpResponseOutput};
use serde_json::Value;
use std::fs;
use tauri::{ipc::Channel, AppHandle, Manager, State};

fn workspace_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data).map_err(|error| error.to_string())?;
    Ok(app_data.join("workspace.json"))
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<Value>, String> {
    let path = workspace_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let workspace = serde_json::from_str(&data).map_err(|error| error.to_string())?;
    Ok(Some(workspace))
}

#[tauri::command]
fn save_workspace(app: AppHandle, workspace: Value) -> Result<(), String> {
    let path = workspace_path(&app)?;
    let temporary_path = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(&workspace).map_err(|error| error.to_string())?;

    fs::write(&temporary_path, data).map_err(|error| error.to_string())?;
    fs::rename(&temporary_path, &path).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn send_http_request(input: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    http_client::send(input).await
}

#[tauri::command]
async fn connect_websocket(
    input: models::StreamConnectInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::connect_websocket(input, on_event, state.inner().clone()).await
}

#[tauri::command]
async fn send_websocket_message(
    session_id: String,
    message: String,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::send_websocket_message(session_id, message, state.inner().clone()).await
}

#[tauri::command]
async fn disconnect_websocket(
    session_id: String,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::disconnect_websocket(session_id, state.inner().clone()).await
}

#[tauri::command]
async fn connect_sse(
    input: models::StreamConnectInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::connect_sse(input, on_event, state.inner().clone()).await
}

#[tauri::command]
async fn disconnect_sse(
    session_id: String,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::disconnect_sse(session_id, state.inner().clone()).await
}

#[tauri::command]
async fn grpc_load_schema(
    input: models::GrpcSchemaInput,
) -> Result<models::GrpcSchemaOutput, String> {
    grpc_client::load_schema(input).await
}

#[tauri::command]
async fn send_grpc_request(input: models::GrpcCallInput) -> Result<models::GrpcCallOutput, String> {
    grpc_client::call(input).await
}

#[tauri::command]
async fn start_mock_server(
    input: models::MockServerInput,
    state: State<'_, mock_server::MockServerState>,
) -> Result<models::MockServerOutput, String> {
    mock_server::start(input, state.inner().clone()).await
}

#[tauri::command]
async fn stop_mock_server(
    server_id: String,
    state: State<'_, mock_server::MockServerState>,
) -> Result<(), String> {
    mock_server::stop(server_id, state.inner().clone()).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(streaming::StreamingState::default())
        .manage(mock_server::MockServerState::default())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            send_http_request,
            connect_websocket,
            send_websocket_message,
            disconnect_websocket,
            connect_sse,
            disconnect_sse,
            grpc_load_schema,
            send_grpc_request,
            start_mock_server,
            stop_mock_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running Brunomnia");
}
