mod client_identity;
mod external_url;
mod external_vault;
mod gguf;
mod grpc_client;
mod http_client;
mod mcp_http;
mod mcp_stdio;
mod mock_faker;
mod mock_server;
mod models;
mod oauth2_callback;
mod plugin;
mod project;
mod runtime_credentials;
mod secure_store;
mod specification_source;
mod streaming;
mod template_os;
mod workspace_store;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use models::{HttpRequestError, HttpRequestInput, HttpResponseOutput};
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

pub fn run_gguf_worker() -> i32 {
    gguf::run_worker()
}

fn workspace_store_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(workspace_path(app)?.with_file_name("workspaces"))
}

fn legacy_vault_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(workspace_path(app)?.with_file_name("local-vault.enc.json"))
}

fn vault_path(app: &AppHandle, workspace_id: &str) -> Result<std::path::PathBuf, String> {
    workspace_store::project_vault_path(
        &workspace_store_path(app)?,
        &legacy_vault_path(app)?,
        workspace_id,
    )
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<Value>, String> {
    let path = workspace_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let stored: Value = serde_json::from_str(&data).map_err(|error| error.to_string())?;
    let stored = if runtime_credentials::needs_protection(&stored) {
        let protected = runtime_credentials::protect("local-workspace", &stored)?;
        let temporary_path = path.with_extension("json.tmp");
        let data = serde_json::to_string_pretty(&protected).map_err(|error| error.to_string())?;
        fs::write(&temporary_path, data).map_err(|error| error.to_string())?;
        fs::rename(&temporary_path, &path).map_err(|error| error.to_string())?;
        protected
    } else {
        stored
    };
    let workspace = runtime_credentials::unprotect("local-workspace", &stored)?;
    Ok(Some(workspace))
}

#[tauri::command]
fn save_workspace(app: AppHandle, workspace: Value) -> Result<(), String> {
    let path = workspace_path(&app)?;
    let temporary_path = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(&runtime_credentials::protect(
        "local-workspace",
        &workspace,
    )?)
    .map_err(|error| error.to_string())?;

    fs::write(&temporary_path, data).map_err(|error| error.to_string())?;
    fs::rename(&temporary_path, &path).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn workspace_catalog_load(
    app: AppHandle,
    default_workspace: Value,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::load(
        &workspace_store_path(&app)?,
        Some(&workspace_path(&app)?),
        &default_workspace,
    )
}

#[tauri::command]
fn workspace_catalog_open(
    app: AppHandle,
    workspace_id: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::open(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
fn workspace_catalog_read(app: AppHandle, workspace_id: String) -> Result<Value, String> {
    workspace_store::read(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
fn workspace_catalog_cli_path(app: AppHandle, workspace_id: String) -> Result<String, String> {
    workspace_store::cli_path(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
fn workspace_catalog_save(
    app: AppHandle,
    workspace_id: String,
    workspace: Value,
) -> Result<(), String> {
    workspace_store::save(&workspace_store_path(&app)?, &workspace_id, &workspace)
}

#[tauri::command]
fn workspace_catalog_create(
    app: AppHandle,
    workspace_id: String,
    workspace: Value,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::create(&workspace_store_path(&app)?, &workspace_id, &workspace)
}

#[tauri::command]
fn workspace_catalog_rename(
    app: AppHandle,
    workspace_id: String,
    name: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::rename(&workspace_store_path(&app)?, &workspace_id, &name)
}

#[tauri::command]
fn workspace_catalog_reorder(
    app: AppHandle,
    workspace_id: String,
    target_workspace_id: String,
    position: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::reorder(
        &workspace_store_path(&app)?,
        &workspace_id,
        &target_workspace_id,
        &position,
    )
}

#[tauri::command]
fn workspace_catalog_delete(
    app: AppHandle,
    workspace_id: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::delete(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
fn workspace_catalog_list_trash(
    app: AppHandle,
) -> Result<Vec<workspace_store::WorkspaceTrashEntry>, String> {
    workspace_store::list_trash(&workspace_store_path(&app)?)
}

#[tauri::command]
fn workspace_catalog_restore_trash(
    app: AppHandle,
    workspace_id: String,
    deleted_at: i64,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::restore_trash(&workspace_store_path(&app)?, &workspace_id, deleted_at)
}

#[tauri::command]
fn workspace_catalog_purge_trash(
    app: AppHandle,
    workspace_id: String,
    deleted_at: i64,
) -> Result<(), String> {
    workspace_store::purge_trash(&workspace_store_path(&app)?, &workspace_id, deleted_at)
}

#[tauri::command]
fn workspace_catalog_empty_trash(app: AppHandle) -> Result<usize, String> {
    workspace_store::empty_trash(&workspace_store_path(&app)?)
}

#[tauri::command]
fn workspace_catalog_list_snapshots(
    app: AppHandle,
    workspace_id: String,
) -> Result<Vec<workspace_store::WorkspaceSnapshotEntry>, String> {
    workspace_store::list_snapshots(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
fn workspace_catalog_create_snapshot(
    app: AppHandle,
    workspace_id: String,
    message: String,
) -> Result<workspace_store::WorkspaceSnapshotEntry, String> {
    workspace_store::create_snapshot(&workspace_store_path(&app)?, &workspace_id, &message)
}

#[tauri::command]
fn workspace_catalog_restore_snapshot(
    app: AppHandle,
    workspace_id: String,
    snapshot_id: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::restore_snapshot(&workspace_store_path(&app)?, &workspace_id, &snapshot_id)
}

#[tauri::command]
fn workspace_catalog_restore_backup(
    app: AppHandle,
    workspace_id: String,
) -> Result<workspace_store::WorkspaceCatalogSnapshot, String> {
    workspace_store::restore_backup(&workspace_store_path(&app)?, &workspace_id)
}

#[tauri::command]
async fn send_http_request(
    input: HttpRequestInput,
    cancellation_id: Option<String>,
    state: State<'_, http_client::HttpCancellationState>,
) -> Result<HttpResponseOutput, HttpRequestError> {
    http_client::send_cancellable(input, cancellation_id, state.inner()).await
}

#[tauri::command]
fn gguf_list_models(app: AppHandle) -> Result<gguf::GgufModelCatalog, String> {
    gguf::list_models(&app)
}

#[tauri::command]
fn gguf_open_models_folder(app: AppHandle) -> Result<String, String> {
    gguf::open_models_folder(&app)
}

#[tauri::command]
async fn gguf_generate_text(
    app: AppHandle,
    input: gguf::GgufGenerationInput,
) -> Result<String, String> {
    gguf::generate(app, input).await
}

#[tauri::command]
async fn fetch_public_specification_source(url: String) -> Result<String, String> {
    specification_source::fetch(&url).await
}

#[tauri::command]
fn cancel_http_request(
    cancellation_id: String,
    state: State<'_, http_client::HttpCancellationState>,
) -> bool {
    state.cancel(&cancellation_id)
}

#[tauri::command]
async fn send_mcp_http_request(
    input: mcp_http::McpHttpRequestInput,
    cancellation_id: Option<String>,
    on_event: Channel<mcp_http::McpHttpEvent>,
    cancellations: State<'_, http_client::HttpCancellationState>,
    sessions: State<'_, mcp_http::McpHttpSessionState>,
) -> Result<HttpResponseOutput, String> {
    mcp_http::send_cancellable(
        input,
        cancellation_id,
        on_event,
        cancellations.inner(),
        sessions.inner().clone(),
    )
    .await
}

#[tauri::command]
async fn close_mcp_http_session(
    session_key: String,
    state: State<'_, mcp_http::McpHttpSessionState>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    Ok(state.close(&session_key).await)
}

#[tauri::command]
fn template_os_info() -> Value {
    template_os::info()
}

#[tauri::command]
async fn oauth2_authorize(
    input: oauth2_callback::OAuthCallbackInput,
    on_event: Channel<oauth2_callback::OAuthCallbackEvent>,
    app: AppHandle,
    state: State<'_, oauth2_callback::OAuthCallbackState>,
) -> Result<oauth2_callback::OAuthCallbackOutput, String> {
    oauth2_callback::authorize(input, on_event, app, state.inner().clone()).await
}

#[tauri::command]
async fn oauth2_cancel(
    flow_id: String,
    state: State<'_, oauth2_callback::OAuthCallbackState>,
) -> Result<(), String> {
    oauth2_callback::cancel(flow_id, state.inner().clone()).await
}

#[tauri::command]
async fn oauth2_clear_session(
    app: AppHandle,
    state: State<'_, oauth2_callback::OAuthCallbackState>,
) -> Result<(), String> {
    oauth2_callback::clear_session(app, state.inner().clone()).await
}

#[tauri::command]
async fn oauth2_configure_session(
    clear_on_restart: bool,
    app: AppHandle,
    state: State<'_, oauth2_callback::OAuthCallbackState>,
) -> Result<(), String> {
    oauth2_callback::configure_session(app, clear_on_restart, state.inner().clone()).await
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    external_url::open(&url)
}

const SCRIPT_FILE_LIMIT: u64 = 5_000_000;

fn script_file_mime(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "csv" => "text/csv",
        "html" | "htm" => "text/html",
        "json" => "application/json",
        "pem" | "crt" | "cer" | "key" => "application/x-pem-file",
        "txt" => "text/plain",
        "xml" => "application/xml",
        "gif" => "image/gif",
        "jpeg" | "jpg" => "image/jpeg",
        "png" => "image/png",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn read_script_file_path(
    path: String,
    allowed_roots: Vec<String>,
) -> Result<models::FilePayload, String> {
    let source = std::path::PathBuf::from(path.trim());
    if source.as_os_str().is_empty() {
        return Err("Script file path cannot be empty.".into());
    }
    let canonical = source
        .canonicalize()
        .map_err(|error| format!("Unable to open script file {}: {error}", source.display()))?;
    let canonical_roots = allowed_roots
        .iter()
        .filter_map(|root| {
            let root = std::path::PathBuf::from(root.trim());
            if root.as_os_str().is_empty() || !root.is_absolute() {
                return None;
            }
            let canonical_root = root.canonicalize().ok()?;
            canonical_root.is_dir().then_some(canonical_root)
        })
        .collect::<Vec<_>>();
    if canonical_roots.is_empty() {
        return Err(
            "No valid allowed data folders are configured in Preferences → Request scripts.".into(),
        );
    }
    if !canonical_roots
        .iter()
        .any(|root| canonical.starts_with(root))
    {
        return Err(format!(
            "Script file is outside every allowed data folder: {}",
            canonical.display()
        ));
    }
    let metadata = canonical.metadata().map_err(|error| {
        format!(
            "Unable to inspect script file {}: {error}",
            canonical.display()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "Script file path is not a regular file: {}",
            canonical.display()
        ));
    }
    if metadata.len() > SCRIPT_FILE_LIMIT {
        return Err(format!(
            "Script file exceeds the {} MB per-file limit: {}",
            SCRIPT_FILE_LIMIT / 1_000_000,
            canonical.display()
        ));
    }
    let bytes = fs::read(&canonical).map_err(|error| {
        format!(
            "Unable to read script file {}: {error}",
            canonical.display()
        )
    })?;
    if bytes.len() as u64 > SCRIPT_FILE_LIMIT {
        return Err("Script file grew beyond the 5 MB per-file limit while it was read.".into());
    }
    Ok(models::FilePayload {
        file_name: canonical
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("attachment.bin")
            .to_string(),
        mime_type: script_file_mime(&canonical).to_string(),
        data_base64: BASE64.encode(bytes),
    })
}

#[tauri::command]
async fn script_read_file(
    path: String,
    allowed_roots: Vec<String>,
) -> Result<models::FilePayload, String> {
    blocking(move || read_script_file_path(path, allowed_roots)).await
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
async fn project_git_discard(
    path: String,
    paths: Vec<String>,
) -> Result<project::GitStatusOutput, String> {
    blocking(move || project::git_discard(path, paths)).await
}

#[tauri::command]
async fn project_git_diff(path: String, staged: bool) -> Result<String, String> {
    blocking(move || project::git_diff(path, staged)).await
}

#[tauri::command]
async fn project_git_file_diff(path: String, staged: bool, file: String) -> Result<String, String> {
    blocking(move || project::git_file_diff(path, staged, file)).await
}

#[tauri::command]
async fn project_git_history(
    path: String,
    limit: Option<usize>,
) -> Result<Vec<project::GitCommitSummary>, String> {
    blocking(move || project::git_history(path, limit)).await
}

#[tauri::command]
async fn project_git_commit_patch(
    path: String,
    oid: String,
) -> Result<project::GitCommitPatch, String> {
    blocking(move || project::git_commit_patch(path, oid)).await
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
async fn project_git_delete_branch(
    path: String,
    branch: String,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_delete_branch(path, branch)).await
}

#[tauri::command]
async fn project_git_fetch(
    path: String,
    remote: String,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_fetch(path, remote)).await
}

#[tauri::command]
async fn project_git_checkout_remote(
    path: String,
    remote: String,
    branch: String,
) -> Result<project::GitOperationOutput, String> {
    blocking(move || project::git_checkout_remote(path, remote, branch)).await
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
async fn project_git_validate_remote_access(path: String, remote: String) -> Result<(), String> {
    blocking(move || project::git_validate_remote_access(path, remote)).await
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
async fn secure_vault_status(
    app: AppHandle,
    workspace_id: String,
) -> Result<secure_store::SecureFileStatus, String> {
    let path = vault_path(&app, &workspace_id)?;
    blocking(move || secure_store::vault_status(&path)).await
}

#[tauri::command]
async fn secure_vault_unlock(
    app: AppHandle,
    workspace_id: String,
    passphrase: String,
) -> Result<Vec<secure_store::VaultEntry>, String> {
    let path = vault_path(&app, &workspace_id)?;
    blocking(move || secure_store::vault_unlock(&path, passphrase)).await
}

#[tauri::command]
async fn secure_vault_save(
    app: AppHandle,
    workspace_id: String,
    input: secure_store::VaultSaveInput,
) -> Result<secure_store::SecureFileStatus, String> {
    let path = vault_path(&app, &workspace_id)?;
    blocking(move || secure_store::vault_save(&path, input)).await
}

#[tauri::command]
async fn secure_vault_reset(app: AppHandle, workspace_id: String) -> Result<(), String> {
    let path = vault_path(&app, &workspace_id)?;
    blocking(move || secure_store::vault_reset(&path)).await
}

#[tauri::command]
async fn secure_sync_status(path: String) -> Result<secure_store::SecureFileStatus, String> {
    blocking(move || secure_store::sync_status(path)).await
}

#[tauri::command]
async fn secure_sync_pull(
    path: String,
    passphrase: String,
) -> Result<secure_store::SyncPayload, String> {
    blocking(move || secure_store::sync_pull(path, passphrase)).await
}

#[tauri::command]
async fn secure_sync_push(
    input: secure_store::SyncPushInput,
) -> Result<secure_store::SyncPayload, String> {
    blocking(move || secure_store::sync_push(input)).await
}

#[tauri::command]
async fn secure_external_secret(
    input: external_vault::ExternalSecretInput,
    state: State<'_, external_vault::ExternalSecretCache>,
) -> Result<String, String> {
    let cache = state.inner().clone();
    blocking(move || cache.resolve(input)).await
}

#[tauri::command]
async fn mcp_stdio_call(
    input: mcp_stdio::McpStdioInput,
    on_event: Channel<mcp_stdio::McpStdioEvent>,
    cancellations: State<'_, mcp_stdio::McpStdioCancellationState>,
    sessions: State<'_, mcp_stdio::McpStdioSessionState>,
) -> Result<mcp_stdio::McpStdioOutput, String> {
    let cancellations = cancellations.inner().clone();
    let sessions = sessions.inner().clone();
    blocking(move || sessions.call_with_events(input, &cancellations, on_event)).await
}

#[tauri::command]
async fn respond_mcp_stdio_server_request(
    input: mcp_stdio::McpStdioServerResponseInput,
    state: State<'_, mcp_stdio::McpStdioSessionState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || state.respond_server_request(input)).await
}

#[tauri::command]
async fn update_mcp_stdio_roots(
    session_key: String,
    roots: Vec<String>,
    notify: bool,
    state: State<'_, mcp_stdio::McpStdioSessionState>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    blocking(move || state.update_roots(&session_key, roots, notify)).await
}

#[tauri::command]
fn cancel_mcp_stdio_call(
    cancellation_id: String,
    state: State<'_, mcp_stdio::McpStdioCancellationState>,
) -> bool {
    state.cancel(&cancellation_id)
}

#[tauri::command]
async fn close_mcp_stdio_session(
    session_key: String,
    state: State<'_, mcp_stdio::McpStdioSessionState>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    blocking(move || Ok(state.close(&session_key))).await
}

#[tauri::command]
fn has_mcp_stdio_session(
    session_key: String,
    state: State<'_, mcp_stdio::McpStdioSessionState>,
) -> bool {
    state.contains(&session_key)
}

#[tauri::command]
fn secure_external_cache_clear(
    state: State<'_, external_vault::ExternalSecretCache>,
) -> Result<(), String> {
    state.clear()
}

#[tauri::command]
async fn connect_websocket(
    input: models::StreamConnectInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, streaming::StreamingState>,
) -> Result<models::StreamConnectOutput, String> {
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
async fn connect_socket_io(
    input: models::SocketIoConnectInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, streaming::StreamingState>,
) -> Result<models::StreamConnectOutput, String> {
    streaming::connect_socket_io(input, on_event, state.inner().clone()).await
}

#[tauri::command]
async fn send_socket_io_message(
    session_id: String,
    event_name: String,
    args: Vec<Value>,
    ack: bool,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::send_socket_io_message(session_id, event_name, args, ack, state.inner().clone())
        .await
}

#[tauri::command]
async fn set_socket_io_listener(
    session_id: String,
    event_name: String,
    enabled: bool,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::set_socket_io_listener(session_id, event_name, enabled, state.inner().clone()).await
}

#[tauri::command]
async fn disconnect_socket_io(
    session_id: String,
    state: State<'_, streaming::StreamingState>,
) -> Result<(), String> {
    streaming::disconnect_socket_io(session_id, state.inner().clone()).await
}

#[tauri::command]
async fn connect_sse(
    input: models::StreamConnectInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, streaming::StreamingState>,
) -> Result<models::StreamConnectOutput, String> {
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
async fn grpc_start_session(
    input: models::GrpcSessionStartInput,
    on_event: Channel<models::StreamEvent>,
    state: State<'_, grpc_client::GrpcSessionState>,
) -> Result<models::GrpcSessionStartOutput, String> {
    grpc_client::start_session(input, on_event, state.inner().clone()).await
}

#[tauri::command]
async fn grpc_send_message(
    session_id: String,
    message_json: String,
    state: State<'_, grpc_client::GrpcSessionState>,
) -> Result<(), String> {
    grpc_client::send_session_message(session_id, message_json, state.inner().clone()).await
}

#[tauri::command]
async fn grpc_commit_session(
    session_id: String,
    state: State<'_, grpc_client::GrpcSessionState>,
) -> Result<(), String> {
    grpc_client::commit_session(session_id, state.inner().clone()).await
}

#[tauri::command]
async fn grpc_cancel_session(
    session_id: String,
    state: State<'_, grpc_client::GrpcSessionState>,
) -> Result<(), String> {
    grpc_client::cancel_session(session_id, state.inner().clone()).await
}

#[tauri::command]
async fn grpc_close_all_sessions(
    state: State<'_, grpc_client::GrpcSessionState>,
) -> Result<(), String> {
    grpc_client::close_all_sessions(state.inner().clone()).await;
    Ok(())
}

#[tauri::command]
async fn start_mock_server(
    input: models::MockServerInput,
    state: State<'_, mock_server::MockServerState>,
) -> Result<models::MockServerOutput, String> {
    mock_server::start(input, state.inner().clone()).await
}

#[tauri::command]
async fn update_mock_server(
    input: models::MockServerUpdateInput,
    state: State<'_, mock_server::MockServerState>,
) -> Result<models::MockServerUpdateOutput, String> {
    mock_server::update(input, state.inner().clone()).await
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
        .manage(http_client::HttpCancellationState::default())
        .manage(mcp_http::McpHttpSessionState::default())
        .manage(mcp_stdio::McpStdioCancellationState::default())
        .manage(mcp_stdio::McpStdioSessionState::default())
        .manage(grpc_client::GrpcSessionState::default())
        .manage(mock_server::MockServerState::default())
        .manage(oauth2_callback::OAuthCallbackState::default())
        .manage(external_vault::ExternalSecretCache::default())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            workspace_catalog_load,
            workspace_catalog_open,
            workspace_catalog_read,
            workspace_catalog_cli_path,
            workspace_catalog_save,
            workspace_catalog_create,
            workspace_catalog_rename,
            workspace_catalog_reorder,
            workspace_catalog_delete,
            workspace_catalog_list_trash,
            workspace_catalog_restore_trash,
            workspace_catalog_purge_trash,
            workspace_catalog_empty_trash,
            workspace_catalog_list_snapshots,
            workspace_catalog_create_snapshot,
            workspace_catalog_restore_snapshot,
            workspace_catalog_restore_backup,
            template_os_info,
            gguf_list_models,
            gguf_open_models_folder,
            gguf_generate_text,
            send_http_request,
            fetch_public_specification_source,
            cancel_http_request,
            send_mcp_http_request,
            close_mcp_http_session,
            oauth2_authorize,
            oauth2_cancel,
            oauth2_clear_session,
            oauth2_configure_session,
            open_external_url,
            script_read_file,
            project_write,
            project_read,
            project_git_init,
            project_git_clone,
            project_git_status,
            project_git_stage,
            project_git_unstage,
            project_git_discard,
            project_git_diff,
            project_git_file_diff,
            project_git_history,
            project_git_commit_patch,
            project_git_commit,
            project_git_checkout,
            project_git_delete_branch,
            project_git_fetch,
            project_git_checkout_remote,
            project_git_set_remote,
            project_git_pull,
            project_git_push,
            project_git_validate_remote_access,
            project_git_merge,
            project_git_abort_merge,
            project_git_conflicts,
            project_git_resolve_conflict,
            project_git_resolve_conflict_side,
            plugin_read_source,
            secure_vault_status,
            secure_vault_unlock,
            secure_vault_save,
            secure_vault_reset,
            secure_sync_status,
            secure_sync_pull,
            secure_sync_push,
            secure_external_secret,
            secure_external_cache_clear,
            mcp_stdio_call,
            respond_mcp_stdio_server_request,
            update_mcp_stdio_roots,
            cancel_mcp_stdio_call,
            close_mcp_stdio_session,
            has_mcp_stdio_session,
            connect_websocket,
            send_websocket_message,
            disconnect_websocket,
            connect_socket_io,
            send_socket_io_message,
            set_socket_io_listener,
            disconnect_socket_io,
            connect_sse,
            disconnect_sse,
            grpc_load_schema,
            send_grpc_request,
            grpc_start_session,
            grpc_send_message,
            grpc_commit_session,
            grpc_cancel_session,
            grpc_close_all_sessions,
            start_mock_server,
            update_mock_server,
            stop_mock_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running Brunomnia");
}

#[cfg(test)]
mod script_file_tests {
    use super::*;

    #[test]
    fn reads_bounded_regular_script_files_and_rejects_oversized_inputs() {
        let directory = tempfile::tempdir().unwrap();
        let payload_path = directory.path().join("payload.csv");
        fs::write(&payload_path, b"id,name\n1,Ada\n").unwrap();
        let allowed_roots = vec![directory.path().to_string_lossy().into_owned()];
        let payload = read_script_file_path(
            payload_path.to_string_lossy().into_owned(),
            allowed_roots.clone(),
        )
        .unwrap();
        assert_eq!(payload.file_name, "payload.csv");
        assert_eq!(payload.mime_type, "text/csv");
        assert_eq!(payload.data_base64, BASE64.encode(b"id,name\n1,Ada\n"));

        let oversized_path = directory.path().join("oversized.bin");
        fs::write(&oversized_path, vec![0_u8; SCRIPT_FILE_LIMIT as usize + 1]).unwrap();
        let error =
            read_script_file_path(oversized_path.to_string_lossy().into_owned(), allowed_roots)
                .unwrap_err();
        assert!(error.contains("5 MB per-file limit"));
    }

    #[test]
    fn rejects_script_files_outside_allowed_roots() {
        let allowed = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let payload_path = outside.path().join("secret.txt");
        fs::write(&payload_path, b"not allowed").unwrap();

        let error = read_script_file_path(
            payload_path.to_string_lossy().into_owned(),
            vec![allowed.path().to_string_lossy().into_owned()],
        )
        .unwrap_err();
        assert!(error.contains("outside every allowed data folder"));

        let invalid_roots = [
            vec![],
            vec!["relative/folder".into()],
            vec![allowed
                .path()
                .join("missing")
                .to_string_lossy()
                .into_owned()],
            vec![payload_path.to_string_lossy().into_owned()],
        ];
        for roots in invalid_roots {
            let error = read_script_file_path(payload_path.to_string_lossy().into_owned(), roots)
                .unwrap_err();
            assert!(error.contains("No valid allowed data folders"));
        }
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_that_escape_allowed_roots() {
        use std::os::unix::fs::symlink;

        let allowed = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let payload_path = outside.path().join("secret.txt");
        let link_path = allowed.path().join("linked-secret.txt");
        fs::write(&payload_path, b"not allowed").unwrap();
        symlink(&payload_path, &link_path).unwrap();

        let error = read_script_file_path(
            link_path.to_string_lossy().into_owned(),
            vec![allowed.path().to_string_lossy().into_owned()],
        )
        .unwrap_err();
        assert!(error.contains("outside every allowed data folder"));
    }
}
