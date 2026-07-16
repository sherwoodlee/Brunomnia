mod grpc_client;
mod http_client;
mod mock_server;
mod models;
mod plugin;
mod project;
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

async fn blocking<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(operation)
        .await
        .map_err(|error| format!("Background operation failed: {error}"))?
}

#[tauri::command]
async fn project_write(
    input: project::ProjectWriteInput,
) -> Result<project::ProjectWriteOutput, String> {
    blocking(move || project::write_project(input)).await
}

#[tauri::command]
async fn project_read(path: String) -> Result<Value, String> {
    blocking(move || project::read_project(path)).await
}

#[tauri::command]
async fn project_git_init(
    path: String,
    default_branch: String,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_init(path, default_branch)).await
}

#[tauri::command]
async fn project_git_clone(
    remote: String,
    path: String,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_clone(remote, path)).await
}

#[tauri::command]
async fn project_git_status(path: String) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_status(path)).await
}

#[tauri::command]
async fn project_git_stage(
    path: String,
    paths: Vec<String>,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_stage(path, paths)).await
}

#[tauri::command]
async fn project_git_unstage(
    path: String,
    paths: Vec<String>,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_unstage(path, paths)).await
}

#[tauri::command]
async fn project_git_diff(path: String, staged: bool) -> Result<String, String> {
    blocking(move || project::git_diff(path, staged)).await
}

#[tauri::command]
async fn project_git_commit(
    input: project::GitCommitInput,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_commit(input)).await
}

#[tauri::command]
async fn project_git_checkout(
    path: String,
    branch: String,
    create: bool,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_checkout(path, branch, create)).await
}

#[tauri::command]
async fn project_git_set_remote(
    path: String,
    name: String,
    url: String,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_set_remote(path, name, url)).await
}

#[tauri::command]
async fn project_git_pull(
    input: project::GitPushPullInput,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_pull(input)).await
}

#[tauri::command]
async fn project_git_push(
    input: project::GitPushPullInput,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_push(input)).await
}

#[tauri::command]
async fn project_git_merge(
    path: String,
    branch: String,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_merge(path, branch)).await
}

#[tauri::command]
async fn project_git_abort_merge(path: String) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_abort_merge(path)).await
}

#[tauri::command]
async fn project_git_conflicts(path: String) -> Result<Vec<project::GitConflict>, String> {
    blocking(move || project::git_conflicts(path)).await
}

#[tauri::command]
async fn project_git_resolve_conflict(
    path: String,
    file: String,
    contents: String,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_resolve_conflict(path, file, contents)).await
}

#[tauri::command]
async fn project_git_resolve_conflict_side(
    path: String,
    file: String,
    side: String,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_resolve_conflict_side(path, file, side)).await
}

#[tauri::command]
async fn plugin_read_source(path: String) -> Result<plugin::PluginSourceOutput, String> {
    blocking(move || plugin::read_plugin_source(path)).await
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
    kind: String,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::send_websocket_message(session_id, message, kind, state.inner().clone()).await
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
            project_write,
            project_read,
            project_git_init,
            project_git_clone,
            project_git_status,
            project_git_stage,
            project_git_unstage,
            project_git_diff,
            project_git_commit,
            project_git_checkout,
            project_git_set_remote,
            project_git_pull,
            project_git_push,
            project_git_merge,
            project_git_abort_merge,
            project_git_conflicts,
            project_git_resolve_conflict,
            project_git_resolve_conflict_side,
            plugin_read_source,
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
