mod external_url;
mod external_vault;
mod grpc_client;
mod http_client;
mod mcp_stdio;
mod mock_server;
mod models;
mod plugin;
mod project;
mod secure_store;
mod streaming;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
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

fn vault_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(workspace_path(app)?.with_file_name("local-vault.enc.json"))
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
async fn secure_vault_status(app: AppHandle) -> Result<secure_store::SecureFileStatus, String> {
    let path = vault_path(&app)?;
    blocking(move || secure_store::vault_status(&path)).await
}

#[tauri::command]
async fn secure_vault_unlock(
    app: AppHandle,
    passphrase: String,
) -> Result<Vec<secure_store::VaultEntry>, String> {
    let path = vault_path(&app)?;
    blocking(move || secure_store::vault_unlock(&path, passphrase)).await
}

#[tauri::command]
async fn secure_vault_save(
    app: AppHandle,
    input: secure_store::VaultSaveInput,
) -> Result<secure_store::SecureFileStatus, String> {
    let path = vault_path(&app)?;
    blocking(move || secure_store::vault_save(&path, input)).await
}

#[tauri::command]
async fn secure_vault_reset(app: AppHandle) -> Result<(), String> {
    let path = vault_path(&app)?;
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
) -> Result<mcp_stdio::McpStdioOutput, String> {
    blocking(move || mcp_stdio::call(input)).await
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
        .manage(external_vault::ExternalSecretCache::default())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            send_http_request,
            open_external_url,
            script_read_file,
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
