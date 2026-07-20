use crate::{runtime_credentials, workspace_physical_store};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use uuid::Uuid;

const CATALOG_VERSION: u32 = 1;
const MAX_WORKSPACES: usize = 500;
const MAX_CATALOG_BYTES: u64 = 5_000_000;
const MAX_SNAPSHOT_BYTES: u64 = 100_000_000;
const MAX_WORKSPACE_ID_BYTES: usize = 128;
const MAX_WORKSPACE_NAME_CHARS: usize = 200;
const MAX_TRASH_ENTRIES: usize = 1_000;
const MAX_SNAPSHOTS: usize = 50;
const SNAPSHOT_VERSION: u32 = 1;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogEntry {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    last_opened_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Catalog {
    version: u32,
    active_workspace_id: String,
    entries: Vec<CatalogEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCatalogEntry {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    last_opened_at: String,
    status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRecovery {
    kind: String,
    workspace_id: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCatalogSnapshot {
    active_workspace_id: String,
    entries: Vec<WorkspaceCatalogEntry>,
    workspace: Value,
    recovery: Option<WorkspaceRecovery>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTrashEntry {
    workspace_id: String,
    name: String,
    deleted_at: i64,
    status: String,
    has_backup: bool,
    has_vault: bool,
    has_snapshots: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshotEntry {
    id: String,
    message: String,
    created_at: String,
    file_count: usize,
    size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSnapshotFile {
    version: u32,
    id: String,
    workspace_id: String,
    message: String,
    created_at: String,
    file_count: usize,
    workspace: Value,
}

enum WorkspaceRead {
    Primary(Value),
    Backup(Value),
    Unavailable,
}

#[derive(Clone, Copy)]
enum TrashFileKind {
    Workspace,
    Backup,
    Vault,
    Metadata,
}

#[derive(Default)]
struct TrashFiles {
    workspace: Option<PathBuf>,
    backup: Option<PathBuf>,
    workspace_records: Option<PathBuf>,
    backup_records: Option<PathBuf>,
    vault: Option<PathBuf>,
    metadata: Option<PathBuf>,
    snapshots: Option<PathBuf>,
}

fn catalog_path(root: &Path) -> PathBuf {
    root.join("catalog.json")
}

fn catalog_backup_path(root: &Path) -> PathBuf {
    root.join("catalog.backup.json")
}

fn workspace_path(root: &Path, id: &str) -> PathBuf {
    root.join(format!("{id}.json"))
}

fn workspace_backup_path(root: &Path, id: &str) -> PathBuf {
    root.join(format!("{id}.backup.json"))
}

fn workspace_records_path(root: &Path, id: &str) -> PathBuf {
    root.join(format!("{id}.records"))
}

fn workspace_backup_records_path(root: &Path, id: &str) -> PathBuf {
    root.join(format!("{id}.backup.records"))
}

fn workspace_snapshot_dir(root: &Path, id: &str) -> PathBuf {
    root.join("snapshots").join(id)
}

fn workspace_snapshot_path(root: &Path, workspace_id: &str, snapshot_id: &str) -> PathBuf {
    workspace_snapshot_dir(root, workspace_id).join(format!("{snapshot_id}.json"))
}

fn ensure_snapshot_root(root: &Path) -> Result<PathBuf, String> {
    let parent = root.join("snapshots");
    match fs::symlink_metadata(&parent) {
        Ok(metadata) if metadata.file_type().is_dir() => {}
        Ok(_) => return Err("The project snapshot store is not a regular directory.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(&parent).map_err(|error| error.to_string())?;
        }
        Err(error) => return Err(error.to_string()),
    }
    Ok(parent)
}

fn ensure_workspace_snapshot_dir(root: &Path, workspace_id: &str) -> Result<PathBuf, String> {
    ensure_snapshot_root(root)?;
    let directory = workspace_snapshot_dir(root, workspace_id);
    match fs::symlink_metadata(&directory) {
        Ok(metadata) if metadata.file_type().is_dir() => {}
        Ok(_) => return Err("The project snapshot store is not a regular directory.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&directory).map_err(|error| error.to_string())?;
        }
        Err(error) => return Err(error.to_string()),
    }
    Ok(directory)
}

fn trash_snapshot_dir(root: &Path, id: &str, deleted_at: i64) -> PathBuf {
    root.join("trash")
        .join(format!("{id}-{deleted_at}.snapshots"))
}

fn trash_records_dir(root: &Path, id: &str, deleted_at: i64, label: &str) -> PathBuf {
    root.join("trash")
        .join(format!("{id}-{deleted_at}.{label}.records"))
}

pub fn cli_path(root: &Path, workspace_id: &str) -> Result<String, String> {
    validate_workspace_id(workspace_id)?;
    let path = workspace_path(root, workspace_id);
    if read_valid_stored_workspace(&path, &workspace_records_path(root, workspace_id)).is_none() {
        return Err("This local project's saved workspace file is unavailable.".into());
    }
    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    let path = fs::canonicalize(path).map_err(|error| error.to_string())?;
    if !path.starts_with(root) {
        return Err("The saved workspace path escapes the local project store.".into());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn trash_file_path(root: &Path, id: &str, deleted_at: i64, label: &str) -> PathBuf {
    root.join("trash")
        .join(format!("{id}-{deleted_at}.{label}.json"))
}

fn parse_trash_file_name(name: &str) -> Option<(String, i64, TrashFileKind)> {
    let (stem, kind) = if let Some(stem) = name.strip_suffix(".workspace.json") {
        (stem, TrashFileKind::Workspace)
    } else if let Some(stem) = name.strip_suffix(".backup.json") {
        (stem, TrashFileKind::Backup)
    } else if let Some(stem) = name.strip_suffix(".metadata.json") {
        (stem, TrashFileKind::Metadata)
    } else {
        let stem = name.strip_suffix(".vault.json")?;
        (stem, TrashFileKind::Vault)
    };
    let (workspace_id, deleted_at) = stem.rsplit_once('-')?;
    validate_workspace_id(workspace_id).ok()?;
    let deleted_at = deleted_at.parse::<i64>().ok()?;
    (deleted_at >= 0).then(|| (workspace_id.to_string(), deleted_at, kind))
}

fn parse_trash_snapshot_dir_name(name: &str) -> Option<(String, i64)> {
    let stem = name.strip_suffix(".snapshots")?;
    let (workspace_id, deleted_at) = stem.rsplit_once('-')?;
    validate_workspace_id(workspace_id).ok()?;
    let deleted_at = deleted_at.parse::<i64>().ok()?;
    (deleted_at >= 0).then(|| (workspace_id.to_string(), deleted_at))
}

fn parse_trash_records_dir_name(name: &str) -> Option<(String, i64, bool)> {
    let (stem, backup) = if let Some(stem) = name.strip_suffix(".workspace.records") {
        (stem, false)
    } else {
        (name.strip_suffix(".backup.records")?, true)
    };
    let (workspace_id, deleted_at) = stem.rsplit_once('-')?;
    validate_workspace_id(workspace_id).ok()?;
    let deleted_at = deleted_at.parse::<i64>().ok()?;
    (deleted_at >= 0).then(|| (workspace_id.to_string(), deleted_at, backup))
}

fn read_regular_bytes(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.file_type().is_file() {
        return Err("A deleted-project recovery item is not a regular file.".into());
    }
    fs::read(path).map(Some).map_err(|error| error.to_string())
}

fn valid_trash_catalog_entry(bytes: &[u8], workspace_id: &str) -> Option<CatalogEntry> {
    let mut entry = serde_json::from_slice::<CatalogEntry>(bytes).ok()?;
    if entry.id != workspace_id
        || entry.created_at.len() > 64
        || entry.updated_at.len() > 64
        || entry.last_opened_at.len() > 64
    {
        return None;
    }
    entry.name = normalize_name(&entry.name);
    Some(entry)
}

fn collect_trash_files(root: &Path) -> Result<HashMap<(String, i64), TrashFiles>, String> {
    let trash = root.join("trash");
    if !trash.exists() {
        return Ok(HashMap::new());
    }
    let mut groups: HashMap<(String, i64), TrashFiles> = HashMap::new();
    for entry in fs::read_dir(trash).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let name = entry.file_name();
        if file_type.is_dir() {
            if let Some((workspace_id, deleted_at, backup)) =
                name.to_str().and_then(parse_trash_records_dir_name)
            {
                let files = groups.entry((workspace_id, deleted_at)).or_default();
                if backup {
                    files.backup_records = Some(entry.path());
                } else {
                    files.workspace_records = Some(entry.path());
                }
                continue;
            }
            if let Some((workspace_id, deleted_at)) =
                name.to_str().and_then(parse_trash_snapshot_dir_name)
            {
                groups
                    .entry((workspace_id, deleted_at))
                    .or_default()
                    .snapshots = Some(entry.path());
            }
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let Some((workspace_id, deleted_at, kind)) = name.to_str().and_then(parse_trash_file_name)
        else {
            continue;
        };
        let files = groups.entry((workspace_id, deleted_at)).or_default();
        match kind {
            TrashFileKind::Workspace => files.workspace = Some(entry.path()),
            TrashFileKind::Backup => files.backup = Some(entry.path()),
            TrashFileKind::Vault => files.vault = Some(entry.path()),
            TrashFileKind::Metadata => files.metadata = Some(entry.path()),
        }
    }
    Ok(groups)
}

pub(crate) fn validate_workspace_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > MAX_WORKSPACE_ID_BYTES
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(
            "Workspace IDs may contain only letters, numbers, hyphens, and underscores.".into(),
        );
    }
    Ok(())
}

pub(crate) fn project_vault_path(
    root: &Path,
    legacy_path: &Path,
    workspace_id: &str,
) -> Result<PathBuf, String> {
    validate_workspace_id(workspace_id)?;
    let directory = root.join("vaults");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(format!("{workspace_id}.enc.json"));
    if workspace_id == "local-workspace" && !path.exists() && legacy_path.exists() {
        fs::copy(legacy_path, &path).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn normalize_name(name: &str) -> String {
    let name = name
        .replace(['\r', '\n', '\0'], " ")
        .trim()
        .chars()
        .take(MAX_WORKSPACE_NAME_CHARS)
        .collect::<String>();
    if name.is_empty() {
        "Untitled Project".into()
    } else {
        name
    }
}

fn workspace_name(value: &Value) -> String {
    normalize_name(
        value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
}

fn workspace_is_valid(value: &Value) -> bool {
    value.get("format").and_then(Value::as_str) == Some("brunomnia")
        && value.get("collections").is_some_and(Value::is_array)
}

fn normalize_snapshot_message(message: &str) -> Result<String, String> {
    let message = message
        .replace(['\r', '\n', '\0'], " ")
        .trim()
        .chars()
        .take(MAX_WORKSPACE_NAME_CHARS)
        .collect::<String>();
    if message.is_empty() {
        return Err("A snapshot message is required.".into());
    }
    Ok(message)
}

fn workspace_file_count(workspace: &Value) -> usize {
    let design_collection_ids = workspace
        .get("apiDesigns")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|design| design.get("collectionId").and_then(Value::as_str))
        .collect::<HashSet<_>>();
    let collections = workspace
        .get("collections")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|collection| {
            collection
                .get("id")
                .and_then(Value::as_str)
                .map_or(true, |id| !design_collection_ids.contains(id))
        })
        .count();
    let designs = workspace
        .get("apiDesigns")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let mocks = workspace
        .get("mockServers")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let environments = workspace
        .get("environments")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|environment| {
            environment
                .get("parentId")
                .and_then(Value::as_str)
                .map_or(true, str::is_empty)
        })
        .count();
    let mcp_clients = workspace
        .get("mcpClients")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    collections + designs + mocks + environments + mcp_clients
}

fn valid_snapshot_file(
    bytes: &[u8],
    workspace_id: &str,
    snapshot_id: &str,
) -> Option<WorkspaceSnapshotFile> {
    let mut snapshot = serde_json::from_slice::<WorkspaceSnapshotFile>(bytes).ok()?;
    if snapshot.version != SNAPSHOT_VERSION
        || snapshot.id != snapshot_id
        || snapshot.workspace_id != workspace_id
        || validate_workspace_id(&snapshot.id).is_err()
        || snapshot.created_at.len() > 64
        || chrono::DateTime::parse_from_rfc3339(&snapshot.created_at).is_err()
        || !workspace_is_valid(&snapshot.workspace)
    {
        return None;
    }
    snapshot.message = normalize_snapshot_message(&snapshot.message).ok()?;
    snapshot.file_count = workspace_file_count(&snapshot.workspace);
    Some(snapshot)
}

fn read_json(path: &Path) -> Option<Value> {
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn read_valid_workspace(path: &Path) -> Option<Value> {
    read_json(path).filter(workspace_is_valid)
}

fn read_valid_stored_workspace(path: &Path, records: &Path) -> Option<Value> {
    let stored = read_json(path)?;
    if workspace_is_valid(&stored) {
        return Some(stored);
    }
    if !workspace_physical_store::is_manifest(&stored) {
        return None;
    }
    let metadata = fs::symlink_metadata(records).ok()?;
    if !metadata.file_type().is_dir() {
        return None;
    }
    workspace_physical_store::assemble(&stored, |key| {
        if !workspace_physical_store::valid_record_key(key) {
            return None;
        }
        let path = records.join(key);
        let metadata = fs::symlink_metadata(&path).ok()?;
        if !metadata.file_type().is_file() {
            return None;
        }
        read_json(&path)
    })
    .filter(workspace_is_valid)
}

fn read_workspace_raw(root: &Path, id: &str) -> WorkspaceRead {
    if let Some(value) =
        read_valid_stored_workspace(&workspace_path(root, id), &workspace_records_path(root, id))
    {
        WorkspaceRead::Primary(value)
    } else if let Some(value) = read_valid_stored_workspace(
        &workspace_backup_path(root, id),
        &workspace_backup_records_path(root, id),
    ) {
        WorkspaceRead::Backup(value)
    } else {
        WorkspaceRead::Unavailable
    }
}

fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "The workspace store path is invalid.".to_string())?;
    let temporary = path.with_file_name(format!(".{file_name}.tmp"));
    let previous = path.with_file_name(format!(".{file_name}.previous"));
    let mut file = fs::File::create(&temporary).map_err(|error| error.to_string())?;
    file.write_all(bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    if previous.exists() {
        fs::remove_file(&previous).map_err(|error| error.to_string())?;
    }
    if path.exists() {
        fs::rename(path, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        if previous.exists() {
            let _ = fs::rename(&previous, path);
        }
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if previous.exists() {
        fs::remove_file(previous).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    write_bytes_atomic(path, &data)
}

fn path_present(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

fn remove_store_copy(path: &Path, records: &Path) -> Result<(), String> {
    if path_present(path)? {
        let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
        if !metadata.file_type().is_file() {
            return Err("A project manifest is not a regular file.".into());
        }
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    if path_present(records)? {
        let metadata = fs::symlink_metadata(records).map_err(|error| error.to_string())?;
        if !metadata.file_type().is_dir() {
            return Err("A project record store is not a regular directory.".into());
        }
        fs::remove_dir_all(records).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn stage_physical_copy(
    path: &Path,
    records: &Path,
    workspace: &Value,
) -> Result<(PathBuf, PathBuf), String> {
    let (manifest, physical_records) = workspace_physical_store::split(workspace)?;
    let nonce = Uuid::new_v4();
    let path_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "The project manifest path is invalid.".to_string())?;
    let records_name = records
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "The project record path is invalid.".to_string())?;
    let temporary_path = path.with_file_name(format!(".{path_name}.{nonce}.staged"));
    let temporary_records = records.with_file_name(format!(".{records_name}.{nonce}.staged"));
    fs::create_dir(&temporary_records).map_err(|error| error.to_string())?;
    let staged = (|| {
        for (key, physical_record) in physical_records {
            if !workspace_physical_store::valid_record_key(&key) {
                return Err("A generated project record key is invalid.".into());
            }
            write_json_atomic(&temporary_records.join(key), &physical_record)?;
        }
        write_json_atomic(&temporary_path, &manifest)
    })();
    if let Err(error) = staged {
        let _ = fs::remove_dir_all(&temporary_records);
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    Ok((temporary_path, temporary_records))
}

fn install_staged_copy(
    temporary_path: &Path,
    temporary_records: &Path,
    path: &Path,
    records: &Path,
) -> Result<(), String> {
    fs::rename(temporary_records, records).map_err(|error| error.to_string())?;
    if let Err(error) = fs::rename(temporary_path, path) {
        let _ = fs::remove_dir_all(records);
        return Err(error.to_string());
    }
    Ok(())
}

fn write_physical_copy(path: &Path, records: &Path, workspace: &Value) -> Result<(), String> {
    let (temporary_path, temporary_records) = stage_physical_copy(path, records, workspace)?;
    let nonce = Uuid::new_v4();
    let previous_path = path.with_file_name(format!(
        ".{}.{}.previous",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("manifest"),
        nonce
    ));
    let previous_records = records.with_file_name(format!(
        ".{}.{}.previous",
        records
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("records"),
        nonce
    ));
    let had_previous = path_present(path)? || path_present(records)?;
    if had_previous {
        if let Err(error) = move_store_copy(path, records, &previous_path, &previous_records) {
            let _ = fs::remove_file(temporary_path);
            let _ = fs::remove_dir_all(temporary_records);
            return Err(error);
        }
    }
    if let Err(error) = install_staged_copy(&temporary_path, &temporary_records, path, records) {
        if had_previous {
            let _ = move_store_copy(&previous_path, &previous_records, path, records);
        }
        let _ = fs::remove_file(temporary_path);
        let _ = fs::remove_dir_all(temporary_records);
        return Err(error);
    }
    if had_previous {
        let _ = remove_store_copy(&previous_path, &previous_records);
    }
    Ok(())
}

fn move_store_copy(
    source_path: &Path,
    source_records: &Path,
    destination_path: &Path,
    destination_records: &Path,
) -> Result<(), String> {
    let has_manifest = path_present(source_path)?;
    let has_records = path_present(source_records)?;
    if has_manifest {
        let metadata = fs::symlink_metadata(source_path).map_err(|error| error.to_string())?;
        if !metadata.file_type().is_file() {
            return Err("A project manifest is not a regular file.".into());
        }
        fs::rename(source_path, destination_path).map_err(|error| error.to_string())?;
    }
    if has_records {
        let metadata = fs::symlink_metadata(source_records).map_err(|error| error.to_string())?;
        if !metadata.file_type().is_dir() {
            if has_manifest {
                let _ = fs::rename(destination_path, source_path);
            }
            return Err("A project record store is not a regular directory.".into());
        }
        if let Err(error) = fs::rename(source_records, destination_records) {
            if has_manifest {
                let _ = fs::rename(destination_path, source_path);
            }
            return Err(error.to_string());
        }
    }
    Ok(())
}

fn migrate_workspace_file(path: &Path, workspace_id: &str) -> Result<(), String> {
    let Some(workspace) = read_valid_workspace(path) else {
        return Ok(());
    };
    if runtime_credentials::needs_protection(&workspace) {
        write_json_atomic(
            path,
            &runtime_credentials::protect(workspace_id, &workspace)?,
        )?;
    }
    Ok(())
}

fn migrate_stored_workspace_copy(
    path: &Path,
    records: &Path,
    workspace_id: &str,
) -> Result<(), String> {
    let Some(stored) = read_json(path) else {
        return Ok(());
    };
    if workspace_is_valid(&stored) {
        let protected = if runtime_credentials::needs_protection(&stored) {
            runtime_credentials::protect(workspace_id, &stored)?
        } else {
            stored
        };
        return write_physical_copy(path, records, &protected);
    }
    let Some(workspace) = read_valid_stored_workspace(path, records) else {
        return Ok(());
    };
    if runtime_credentials::needs_protection(&workspace) {
        write_physical_copy(
            path,
            records,
            &runtime_credentials::protect(workspace_id, &workspace)?,
        )?;
    }
    Ok(())
}

fn migrate_workspace_copies(root: &Path, workspace_id: &str) -> Result<(), String> {
    migrate_stored_workspace_copy(
        &workspace_path(root, workspace_id),
        &workspace_records_path(root, workspace_id),
        workspace_id,
    )?;
    migrate_stored_workspace_copy(
        &workspace_backup_path(root, workspace_id),
        &workspace_backup_records_path(root, workspace_id),
        workspace_id,
    )
}

fn migrate_trash_workspaces(root: &Path) -> Result<HashMap<(String, i64), TrashFiles>, String> {
    let trash_files = collect_trash_files(root)?;
    for ((workspace_id, deleted_at), files) in &trash_files {
        if let Some(path) = files.workspace.as_deref() {
            let records = trash_records_dir(root, workspace_id, *deleted_at, "workspace");
            migrate_stored_workspace_copy(
                path,
                files.workspace_records.as_deref().unwrap_or(&records),
                workspace_id,
            )?;
        }
        if let Some(path) = files.backup.as_deref() {
            let records = trash_records_dir(root, workspace_id, *deleted_at, "backup");
            migrate_stored_workspace_copy(
                path,
                files.backup_records.as_deref().unwrap_or(&records),
                workspace_id,
            )?;
        }
    }
    collect_trash_files(root)
}

fn read_workspace(root: &Path, id: &str) -> Result<WorkspaceRead, String> {
    migrate_workspace_copies(root, id)?;
    let primary =
        read_valid_stored_workspace(&workspace_path(root, id), &workspace_records_path(root, id));
    let backup = read_valid_stored_workspace(
        &workspace_backup_path(root, id),
        &workspace_backup_records_path(root, id),
    );
    if let Some(workspace) = primary {
        match runtime_credentials::unprotect(id, &workspace) {
            Ok(workspace) => return Ok(WorkspaceRead::Primary(workspace)),
            Err(primary_error) => {
                if let Some(backup) = backup {
                    return runtime_credentials::unprotect(id, &backup)
                        .map(WorkspaceRead::Backup)
                        .map_err(|_| primary_error);
                }
                return Err(primary_error);
            }
        }
    }
    backup
        .map(|workspace| runtime_credentials::unprotect(id, &workspace).map(WorkspaceRead::Backup))
        .transpose()
        .map(|workspace| workspace.unwrap_or(WorkspaceRead::Unavailable))
}

fn preserve_invalid(root: &Path, id: &str, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let recovery = root.join("recovery");
    fs::create_dir_all(&recovery).map_err(|error| error.to_string())?;
    let destination = recovery.join(format!(
        "{}-{}.invalid.json",
        id,
        Utc::now().timestamp_millis()
    ));
    fs::rename(path, destination).map_err(|error| error.to_string())
}

fn preserve_invalid_store(
    root: &Path,
    id: &str,
    path: &Path,
    records: &Path,
) -> Result<(), String> {
    let recovery = root.join("recovery");
    fs::create_dir_all(&recovery).map_err(|error| error.to_string())?;
    let suffix = Utc::now().timestamp_millis();
    if path_present(path)? {
        fs::rename(path, recovery.join(format!("{id}-{suffix}.invalid.json")))
            .map_err(|error| error.to_string())?;
    }
    if path_present(records)? {
        fs::rename(
            records,
            recovery.join(format!("{id}-{suffix}.invalid.records")),
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn write_workspace(root: &Path, id: &str, workspace: &Value) -> Result<(), String> {
    if !workspace_is_valid(workspace) {
        return Err("The project is not a valid Brunomnia workspace.".into());
    }
    let protected_workspace = runtime_credentials::protect(id, workspace)?;
    let path = workspace_path(root, id);
    let records = workspace_records_path(root, id);
    let backup = workspace_backup_path(root, id);
    let backup_records = workspace_backup_records_path(root, id);
    let (temporary_path, temporary_records) =
        stage_physical_copy(&path, &records, &protected_workspace)?;
    let had_current = path_present(&path)? || path_present(&records)?;
    let current_valid = read_valid_stored_workspace(&path, &records).is_some();
    let mut moved_current = false;
    if had_current {
        if current_valid {
            remove_store_copy(&backup, &backup_records)?;
            move_store_copy(&path, &records, &backup, &backup_records)?;
            moved_current = true;
        } else {
            preserve_invalid_store(root, id, &path, &records)?;
        }
    }
    if let Err(error) = install_staged_copy(&temporary_path, &temporary_records, &path, &records) {
        if moved_current {
            let _ = move_store_copy(&backup, &backup_records, &path, &records);
        }
        let _ = fs::remove_file(temporary_path);
        let _ = fs::remove_dir_all(temporary_records);
        return Err(error);
    }
    Ok(())
}

fn catalog_is_valid(catalog: &Catalog) -> bool {
    let mut ids = HashSet::new();
    catalog.version == CATALOG_VERSION
        && catalog.entries.len() <= MAX_WORKSPACES
        && catalog
            .entries
            .iter()
            .all(|entry| validate_workspace_id(&entry.id).is_ok() && ids.insert(&entry.id))
}

fn read_catalog_file(path: &Path) -> Option<Catalog> {
    if fs::metadata(path).ok()?.len() > MAX_CATALOG_BYTES {
        return None;
    }
    let mut catalog = serde_json::from_slice::<Catalog>(&fs::read(path).ok()?).ok()?;
    if !catalog_is_valid(&catalog) {
        return None;
    }
    let now = Utc::now().to_rfc3339();
    for entry in &mut catalog.entries {
        entry.name = normalize_name(&entry.name);
        if entry.created_at.len() > 64 {
            entry.created_at = now.clone();
        }
        if entry.updated_at.len() > 64 {
            entry.updated_at = now.clone();
        }
        if entry.last_opened_at.len() > 64 {
            entry.last_opened_at = now.clone();
        }
    }
    Some(catalog)
}

fn write_catalog(root: &Path, catalog: &Catalog) -> Result<(), String> {
    let path = catalog_path(root);
    let backup = catalog_backup_path(root);
    if read_catalog_file(&path).is_some() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        fs::copy(&path, &backup).map_err(|error| error.to_string())?;
    } else if path.exists() {
        preserve_invalid(root, "catalog", &path)?;
    }
    write_json_atomic(&path, catalog)
}

fn new_entry(id: String, workspace: &Value) -> CatalogEntry {
    let now = Utc::now().to_rfc3339();
    CatalogEntry {
        id,
        name: workspace_name(workspace),
        created_at: now.clone(),
        updated_at: now.clone(),
        last_opened_at: now,
    }
}

fn reconstruct_catalog(root: &Path) -> Catalog {
    let mut entries = fs::read_dir(root)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            if !name.ends_with(".json") || name == "catalog.json" || name.ends_with(".backup.json")
            {
                return None;
            }
            let id = name.strip_suffix(".json")?.to_string();
            validate_workspace_id(&id).ok()?;
            let workspace = read_valid_stored_workspace(&path, &workspace_records_path(root, &id))?;
            Some(new_entry(id, &workspace))
        })
        .take(MAX_WORKSPACES)
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Catalog {
        version: CATALOG_VERSION,
        active_workspace_id: entries
            .first()
            .map(|entry| entry.id.clone())
            .unwrap_or_default(),
        entries,
    }
}

fn load_or_rebuild_catalog(
    root: &Path,
    legacy_path: Option<&Path>,
    default_workspace: Option<&Value>,
) -> Result<(Catalog, Option<WorkspaceRecovery>), String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    if let Some(catalog) = read_catalog_file(&catalog_path(root)) {
        return Ok((catalog, None));
    }
    if let Some(catalog) = read_catalog_file(&catalog_backup_path(root)) {
        write_catalog(root, &catalog)?;
        return Ok((
            catalog,
            Some(WorkspaceRecovery {
                kind: "catalog-backup".into(),
                workspace_id: String::new(),
                message: "The project catalog was restored from its latest valid backup.".into(),
            }),
        ));
    }
    let mut catalog = reconstruct_catalog(root);
    let mut recovery = None;
    if catalog.entries.is_empty() {
        if let Some(legacy_path) = legacy_path.filter(|path| path.exists()) {
            if let Some(workspace) = read_valid_workspace(legacy_path) {
                let workspace = runtime_credentials::unprotect("local-workspace", &workspace)?;
                let id = "local-workspace".to_string();
                write_workspace(root, &id, &workspace)?;
                catalog.entries.push(new_entry(id.clone(), &workspace));
                catalog.active_workspace_id = id;
            } else {
                preserve_invalid(root, "legacy-workspace", legacy_path)?;
                recovery = Some(WorkspaceRecovery {
                    kind: "legacy-corrupt".into(),
                    workspace_id: String::new(),
                    message: "The legacy workspace was unreadable and was preserved in the recovery folder.".into(),
                });
            }
        }
    }
    if catalog.entries.is_empty() {
        let workspace = default_workspace
            .filter(|workspace| workspace_is_valid(workspace))
            .ok_or_else(|| {
                "A valid default workspace is required to initialize the project catalog."
                    .to_string()
            })?;
        let id = format!("workspace-{}", Uuid::new_v4());
        write_workspace(root, &id, workspace)?;
        catalog.entries.push(new_entry(id.clone(), workspace));
        catalog.active_workspace_id = id;
    } else if recovery.is_none() {
        recovery = Some(WorkspaceRecovery {
            kind: "catalog-rebuilt".into(),
            workspace_id: String::new(),
            message: "The project catalog was rebuilt from valid local project files.".into(),
        });
    }
    write_catalog(root, &catalog)?;
    Ok((catalog, recovery))
}

fn entry_status(root: &Path, id: &str) -> &'static str {
    match read_workspace_raw(root, id) {
        WorkspaceRead::Primary(_) => "ready",
        WorkspaceRead::Backup(_) => "recoverable",
        WorkspaceRead::Unavailable => "unavailable",
    }
}

fn ensure_active(catalog: &mut Catalog, root: &Path) -> Result<(), String> {
    if catalog.entries.iter().any(|entry| {
        entry.id == catalog.active_workspace_id && entry_status(root, &entry.id) != "unavailable"
    }) {
        return Ok(());
    }
    catalog.active_workspace_id = catalog
        .entries
        .iter()
        .find(|entry| entry_status(root, &entry.id) != "unavailable")
        .map(|entry| entry.id.clone())
        .ok_or_else(|| "No valid or recoverable local project is available.".to_string())?;
    Ok(())
}

fn snapshot(
    root: &Path,
    mut catalog: Catalog,
    mut recovery: Option<WorkspaceRecovery>,
) -> Result<WorkspaceCatalogSnapshot, String> {
    ensure_active(&mut catalog, root)?;
    let workspace = match read_workspace(root, &catalog.active_workspace_id)? {
        WorkspaceRead::Primary(value) => value,
        WorkspaceRead::Backup(value) => {
            recovery = Some(WorkspaceRecovery {
                kind: "workspace-backup".into(),
                workspace_id: catalog.active_workspace_id.clone(),
                message: "The active project file is unreadable. Brunomnia opened its latest valid backup read-only until you restore it.".into(),
            });
            value
        }
        WorkspaceRead::Unavailable => return Err("The active project cannot be opened.".into()),
    };
    let entries = catalog
        .entries
        .iter()
        .map(|entry| WorkspaceCatalogEntry {
            id: entry.id.clone(),
            name: entry.name.clone(),
            created_at: entry.created_at.clone(),
            updated_at: entry.updated_at.clone(),
            last_opened_at: entry.last_opened_at.clone(),
            status: entry_status(root, &entry.id).into(),
        })
        .collect();
    Ok(WorkspaceCatalogSnapshot {
        active_workspace_id: catalog.active_workspace_id,
        entries,
        workspace,
        recovery,
    })
}

pub fn load(
    root: &Path,
    legacy_path: Option<&Path>,
    default_workspace: &Value,
) -> Result<WorkspaceCatalogSnapshot, String> {
    if let Some(legacy_path) = legacy_path {
        migrate_workspace_file(legacy_path, "local-workspace")?;
    }
    let (mut catalog, mut recovery) =
        load_or_rebuild_catalog(root, legacy_path, Some(default_workspace))?;
    for entry in &catalog.entries {
        migrate_workspace_copies(root, &entry.id)?;
    }
    migrate_trash_workspaces(root)?;
    if ensure_active(&mut catalog, root).is_err() {
        let id = format!("workspace-{}", Uuid::new_v4());
        write_workspace(root, &id, default_workspace)?;
        catalog
            .entries
            .push(new_entry(id.clone(), default_workspace));
        catalog.active_workspace_id = id;
        recovery = Some(WorkspaceRecovery {
            kind: "catalog-rebuilt".into(),
            workspace_id: String::new(),
            message: "No stored project could be opened. A fresh local project was created while the unreadable files remain available for recovery.".into(),
        });
    }
    let now = Utc::now().to_rfc3339();
    if let Some(entry) = catalog
        .entries
        .iter_mut()
        .find(|entry| entry.id == catalog.active_workspace_id)
    {
        entry.last_opened_at = now;
    }
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

pub fn open(root: &Path, workspace_id: &str) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    let (mut catalog, recovery) = load_or_rebuild_catalog(root, None, None)?;
    let entry = catalog
        .entries
        .iter_mut()
        .find(|entry| entry.id == workspace_id)
        .ok_or_else(|| "This local project no longer exists.".to_string())?;
    if entry_status(root, workspace_id) == "unavailable" {
        return Err("This local project and its backup are unreadable.".into());
    }
    entry.last_opened_at = Utc::now().to_rfc3339();
    catalog.active_workspace_id = workspace_id.into();
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

pub fn read(root: &Path, workspace_id: &str) -> Result<Value, String> {
    validate_workspace_id(workspace_id)?;
    let (catalog, _) = load_or_rebuild_catalog(root, None, None)?;
    if !catalog.entries.iter().any(|entry| entry.id == workspace_id) {
        return Err("This local project no longer exists.".into());
    }
    match read_workspace(root, workspace_id)? {
        WorkspaceRead::Primary(workspace) | WorkspaceRead::Backup(workspace) => Ok(workspace),
        WorkspaceRead::Unavailable => {
            Err("This local project and its backup are unreadable.".into())
        }
    }
}

pub fn save(root: &Path, workspace_id: &str, workspace: &Value) -> Result<(), String> {
    validate_workspace_id(workspace_id)?;
    let (mut catalog, _) = load_or_rebuild_catalog(root, None, None)?;
    let entry = catalog
        .entries
        .iter_mut()
        .find(|entry| entry.id == workspace_id)
        .ok_or_else(|| "This local project no longer exists.".to_string())?;
    write_workspace(root, workspace_id, workspace)?;
    entry.name = workspace_name(workspace);
    entry.updated_at = Utc::now().to_rfc3339();
    write_catalog(root, &catalog)
}

pub fn create(
    root: &Path,
    workspace_id: &str,
    workspace: &Value,
) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    if !workspace_is_valid(workspace) {
        return Err("The new project is not a valid Brunomnia workspace.".into());
    }
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let (mut catalog, recovery) = match load_or_rebuild_catalog(root, None, None) {
        Ok(result) => result,
        Err(error) if error == "A valid default workspace is required to initialize the project catalog." => (
            Catalog {
                version: CATALOG_VERSION,
                active_workspace_id: String::new(),
                entries: Vec::new(),
            },
            Some(WorkspaceRecovery {
                kind: "catalog-rebuilt".into(),
                workspace_id: String::new(),
                message: "A new project catalog was created because no existing project could be opened.".into(),
            }),
        ),
        Err(error) => return Err(error),
    };
    if catalog.entries.len() >= MAX_WORKSPACES {
        return Err(format!(
            "At most {MAX_WORKSPACES} local projects can be stored."
        ));
    }
    if catalog.entries.iter().any(|entry| entry.id == workspace_id) {
        return Err("A local project with this ID already exists.".into());
    }
    match fs::symlink_metadata(workspace_snapshot_dir(root, workspace_id)) {
        Ok(_) => {
            return Err("Existing local snapshot history conflicts with this project ID.".into())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    write_workspace(root, workspace_id, workspace)?;
    catalog
        .entries
        .push(new_entry(workspace_id.into(), workspace));
    catalog.active_workspace_id = workspace_id.into();
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

pub fn rename(
    root: &Path,
    workspace_id: &str,
    name: &str,
) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    let (mut catalog, recovery) = load_or_rebuild_catalog(root, None, None)?;
    let entry = catalog
        .entries
        .iter_mut()
        .find(|entry| entry.id == workspace_id)
        .ok_or_else(|| "This local project no longer exists.".to_string())?;
    let mut workspace = match read_workspace(root, workspace_id)? {
        WorkspaceRead::Primary(value) | WorkspaceRead::Backup(value) => value,
        WorkspaceRead::Unavailable => {
            return Err("This local project and its backup are unreadable.".into())
        }
    };
    let name = normalize_name(name);
    workspace
        .as_object_mut()
        .ok_or_else(|| "The project workspace is invalid.".to_string())?
        .insert("name".into(), Value::String(name.clone()));
    write_workspace(root, workspace_id, &workspace)?;
    entry.name = name;
    entry.updated_at = Utc::now().to_rfc3339();
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

pub fn reorder(
    root: &Path,
    workspace_id: &str,
    target_workspace_id: &str,
    position: &str,
) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    validate_workspace_id(target_workspace_id)?;
    if !matches!(position, "before" | "after") {
        return Err("Project reorder position must be before or after.".into());
    }
    let (mut catalog, recovery) = load_or_rebuild_catalog(root, None, None)?;
    let source_index = catalog
        .entries
        .iter()
        .position(|entry| entry.id == workspace_id)
        .ok_or_else(|| "The project being reordered no longer exists.".to_string())?;
    if !catalog
        .entries
        .iter()
        .any(|entry| entry.id == target_workspace_id)
    {
        return Err("The reorder destination no longer exists.".into());
    }
    if workspace_id == target_workspace_id {
        return snapshot(root, catalog, recovery);
    }
    let entry = catalog.entries.remove(source_index);
    let target_index = catalog
        .entries
        .iter()
        .position(|candidate| candidate.id == target_workspace_id)
        .ok_or_else(|| "The reorder destination no longer exists.".to_string())?;
    let insert_index = if position == "after" {
        target_index + 1
    } else {
        target_index
    };
    catalog.entries.insert(insert_index, entry);
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

fn stored_snapshots(
    root: &Path,
    workspace_id: &str,
) -> Result<Vec<(WorkspaceSnapshotFile, u64, PathBuf)>, String> {
    let directory = workspace_snapshot_dir(root, workspace_id);
    let metadata = match fs::symlink_metadata(&directory) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.file_type().is_dir() {
        return Err("The project snapshot store is not a regular directory.".into());
    }
    let mut snapshots = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
        {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.len() > MAX_SNAPSHOT_BYTES {
            continue;
        }
        let name = entry.file_name();
        let Some(snapshot_id) = name.to_str().and_then(|name| name.strip_suffix(".json")) else {
            continue;
        };
        if validate_workspace_id(snapshot_id).is_err() {
            continue;
        }
        let bytes = fs::read(entry.path()).map_err(|error| error.to_string())?;
        if let Some(snapshot) = valid_snapshot_file(&bytes, workspace_id, snapshot_id) {
            snapshots.push((snapshot, metadata.len(), entry.path()));
        }
    }
    snapshots.sort_by(|left, right| {
        left.0
            .created_at
            .cmp(&right.0.created_at)
            .then(left.0.id.cmp(&right.0.id))
    });
    Ok(snapshots)
}

fn snapshot_entry(snapshot: &WorkspaceSnapshotFile, size_bytes: u64) -> WorkspaceSnapshotEntry {
    WorkspaceSnapshotEntry {
        id: snapshot.id.clone(),
        message: snapshot.message.clone(),
        created_at: snapshot.created_at.clone(),
        file_count: snapshot.file_count,
        size_bytes,
    }
}

pub fn list_snapshots(
    root: &Path,
    workspace_id: &str,
) -> Result<Vec<WorkspaceSnapshotEntry>, String> {
    validate_workspace_id(workspace_id)?;
    let (catalog, _) = load_or_rebuild_catalog(root, None, None)?;
    if !catalog.entries.iter().any(|entry| entry.id == workspace_id) {
        return Err("This local project no longer exists.".into());
    }
    Ok(stored_snapshots(root, workspace_id)?
        .into_iter()
        .rev()
        .take(MAX_SNAPSHOTS)
        .map(|(snapshot, size_bytes, _)| snapshot_entry(&snapshot, size_bytes))
        .collect())
}

pub fn create_snapshot(
    root: &Path,
    workspace_id: &str,
    message: &str,
) -> Result<WorkspaceSnapshotEntry, String> {
    validate_workspace_id(workspace_id)?;
    let message = normalize_snapshot_message(message)?;
    let workspace = read(root, workspace_id)?;
    let snapshot_id = format!("snapshot-{}", Uuid::new_v4());
    let snapshot = WorkspaceSnapshotFile {
        version: SNAPSHOT_VERSION,
        id: snapshot_id.clone(),
        workspace_id: workspace_id.into(),
        message,
        created_at: Utc::now().to_rfc3339(),
        file_count: workspace_file_count(&workspace),
        workspace: runtime_credentials::protect(workspace_id, &workspace)?,
    };
    ensure_workspace_snapshot_dir(root, workspace_id)?;
    let path = workspace_snapshot_path(root, workspace_id, &snapshot_id);
    let bytes = serde_json::to_vec_pretty(&snapshot).map_err(|error| error.to_string())?;
    if bytes.len() as u64 > MAX_SNAPSHOT_BYTES {
        return Err("The project snapshot exceeds the 100 MB storage limit.".into());
    }
    write_bytes_atomic(&path, &bytes)?;

    let mut snapshots = stored_snapshots(root, workspace_id)?;
    while snapshots.len() > MAX_SNAPSHOTS {
        let (_, _, oldest) = snapshots.remove(0);
        fs::remove_file(oldest).map_err(|error| error.to_string())?;
    }
    let size_bytes = fs::metadata(path).map_err(|error| error.to_string())?.len();
    Ok(snapshot_entry(&snapshot, size_bytes))
}

pub fn restore_snapshot(
    root: &Path,
    workspace_id: &str,
    snapshot_id: &str,
) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    validate_workspace_id(snapshot_id)?;
    let path = workspace_snapshot_path(root, workspace_id, snapshot_id);
    let metadata = fs::symlink_metadata(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "This project snapshot no longer exists.".to_string()
        } else {
            error.to_string()
        }
    })?;
    if !metadata.file_type().is_file() || metadata.len() > MAX_SNAPSHOT_BYTES {
        return Err("This project snapshot is not a valid regular file.".into());
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let snapshot = valid_snapshot_file(&bytes, workspace_id, snapshot_id)
        .ok_or_else(|| "This project snapshot is invalid.".to_string())?;
    let workspace = runtime_credentials::unprotect(workspace_id, &snapshot.workspace)?;
    save(root, workspace_id, &workspace)?;
    open(root, workspace_id)
}

pub fn delete(root: &Path, workspace_id: &str) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    let (mut catalog, recovery) = load_or_rebuild_catalog(root, None, None)?;
    if catalog.entries.len() <= 1 {
        return Err("The last local project cannot be deleted.".into());
    }
    let index = catalog
        .entries
        .iter()
        .position(|entry| entry.id == workspace_id)
        .ok_or_else(|| "This local project no longer exists.".to_string())?;
    let trash = root.join("trash");
    fs::create_dir_all(&trash).map_err(|error| error.to_string())?;
    let suffix = Utc::now().timestamp_millis();
    let snapshots = workspace_snapshot_dir(root, workspace_id);
    let has_snapshots = match fs::symlink_metadata(&snapshots) {
        Ok(metadata) if metadata.file_type().is_dir() => true,
        Ok(_) => return Err("The project snapshot store is not a regular directory.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(error.to_string()),
    };
    for records in [
        workspace_records_path(root, workspace_id),
        workspace_backup_records_path(root, workspace_id),
    ] {
        if path_present(&records)?
            && !fs::symlink_metadata(&records)
                .map_err(|error| error.to_string())?
                .file_type()
                .is_dir()
        {
            return Err("A project record store is not a regular directory.".into());
        }
    }
    write_json_atomic(
        &trash.join(format!("{workspace_id}-{suffix}.metadata.json")),
        &catalog.entries[index],
    )?;
    for (source, label) in [
        (workspace_path(root, workspace_id), "workspace"),
        (workspace_backup_path(root, workspace_id), "backup"),
        (
            root.join("vaults").join(format!("{workspace_id}.enc.json")),
            "vault",
        ),
    ] {
        if source.exists() {
            fs::rename(
                source,
                trash.join(format!("{workspace_id}-{suffix}.{label}.json")),
            )
            .map_err(|error| error.to_string())?;
        }
    }
    for (source, label) in [
        (workspace_records_path(root, workspace_id), "workspace"),
        (workspace_backup_records_path(root, workspace_id), "backup"),
    ] {
        if path_present(&source)? {
            let metadata = fs::symlink_metadata(&source).map_err(|error| error.to_string())?;
            if !metadata.file_type().is_dir() {
                return Err("A project record store is not a regular directory.".into());
            }
            fs::rename(source, trash_records_dir(root, workspace_id, suffix, label))
                .map_err(|error| error.to_string())?;
        }
    }
    if has_snapshots {
        fs::rename(&snapshots, trash_snapshot_dir(root, workspace_id, suffix))
            .map_err(|error| error.to_string())?;
    }
    catalog.entries.remove(index);
    if catalog.active_workspace_id == workspace_id {
        catalog.active_workspace_id = catalog.entries[index.min(catalog.entries.len() - 1)]
            .id
            .clone();
    }
    write_catalog(root, &catalog)?;
    snapshot(root, catalog, recovery)
}

pub fn list_trash(root: &Path) -> Result<Vec<WorkspaceTrashEntry>, String> {
    let mut entries = migrate_trash_workspaces(root)?
        .into_iter()
        .map(|((workspace_id, deleted_at), files)| {
            let primary = files.workspace.as_deref().and_then(|path| {
                files
                    .workspace_records
                    .as_deref()
                    .and_then(|records| read_valid_stored_workspace(path, records))
            });
            let backup = files.backup.as_deref().and_then(|path| {
                files
                    .backup_records
                    .as_deref()
                    .and_then(|records| read_valid_stored_workspace(path, records))
            });
            let metadata = files
                .metadata
                .as_deref()
                .and_then(|path| read_regular_bytes(path).ok().flatten())
                .as_deref()
                .and_then(|bytes| valid_trash_catalog_entry(bytes, &workspace_id));
            let status = if primary.is_some() {
                "ready"
            } else if backup.is_some() {
                "recoverable"
            } else {
                "unavailable"
            };
            let name = metadata
                .map(|entry| entry.name)
                .or_else(|| primary.as_ref().or(backup.as_ref()).map(workspace_name))
                .unwrap_or_else(|| workspace_id.clone());
            WorkspaceTrashEntry {
                workspace_id,
                name,
                deleted_at,
                status: status.into(),
                has_backup: files.backup.is_some(),
                has_vault: files.vault.is_some(),
                has_snapshots: files.snapshots.is_some(),
            }
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        right
            .deleted_at
            .cmp(&left.deleted_at)
            .then(left.workspace_id.cmp(&right.workspace_id))
    });
    entries.truncate(MAX_TRASH_ENTRIES);
    Ok(entries)
}

fn preserve_trashed_invalid(
    root: &Path,
    workspace_id: &str,
    deleted_at: i64,
    label: &str,
    source: &Path,
) {
    let recovery = root.join("recovery");
    if fs::create_dir_all(&recovery).is_err() {
        return;
    }
    let destination = recovery.join(format!(
        "{workspace_id}-{deleted_at}.deleted-{label}.invalid.json"
    ));
    if !destination.exists() {
        let _ = fs::rename(source, destination);
    }
}

fn preserve_trashed_invalid_store(
    root: &Path,
    workspace_id: &str,
    deleted_at: i64,
    label: &str,
    source: &Path,
    records: &Path,
) {
    preserve_trashed_invalid(root, workspace_id, deleted_at, label, source);
    if !path_present(records).unwrap_or(false) {
        return;
    }
    let recovery = root.join("recovery");
    if fs::create_dir_all(&recovery).is_err() {
        return;
    }
    let destination = recovery.join(format!(
        "{workspace_id}-{deleted_at}.deleted-{label}.invalid.records"
    ));
    if !destination.exists() {
        let _ = fs::rename(records, destination);
    }
}

pub fn restore_trash(
    root: &Path,
    workspace_id: &str,
    deleted_at: i64,
) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    if deleted_at < 0 {
        return Err("The deleted-project recovery timestamp is invalid.".into());
    }
    let primary_trash = trash_file_path(root, workspace_id, deleted_at, "workspace");
    let backup_trash = trash_file_path(root, workspace_id, deleted_at, "backup");
    let primary_records_trash = trash_records_dir(root, workspace_id, deleted_at, "workspace");
    let backup_records_trash = trash_records_dir(root, workspace_id, deleted_at, "backup");
    let vault_trash = trash_file_path(root, workspace_id, deleted_at, "vault");
    let metadata_trash = trash_file_path(root, workspace_id, deleted_at, "metadata");
    let snapshots_trash = trash_snapshot_dir(root, workspace_id, deleted_at);
    migrate_stored_workspace_copy(&primary_trash, &primary_records_trash, workspace_id)?;
    migrate_stored_workspace_copy(&backup_trash, &backup_records_trash, workspace_id)?;
    let primary_bytes = read_regular_bytes(&primary_trash)?;
    let backup_bytes = read_regular_bytes(&backup_trash)?;
    let vault_bytes = read_regular_bytes(&vault_trash)?;
    let metadata_bytes = read_regular_bytes(&metadata_trash)?;
    let has_snapshots = match fs::symlink_metadata(&snapshots_trash) {
        Ok(metadata) if metadata.file_type().is_dir() => true,
        Ok(_) => {
            return Err("The deleted project snapshot history is not a regular directory.".into())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(error.to_string()),
    };
    let primary_workspace = read_valid_stored_workspace(&primary_trash, &primary_records_trash);
    let backup_workspace = read_valid_stored_workspace(&backup_trash, &backup_records_trash);
    let workspace = primary_workspace
        .as_ref()
        .or(backup_workspace.as_ref())
        .cloned()
        .ok_or_else(|| {
            "This deleted project does not contain a valid workspace or backup.".to_string()
        })?;
    let catalog_entry = metadata_bytes
        .as_deref()
        .and_then(|bytes| valid_trash_catalog_entry(bytes, workspace_id))
        .map(|mut entry| {
            entry.name = workspace_name(&workspace);
            entry.last_opened_at = Utc::now().to_rfc3339();
            entry
        })
        .unwrap_or_else(|| new_entry(workspace_id.to_string(), &workspace));

    let (mut catalog, recovery) = load_or_rebuild_catalog(root, None, None)?;
    if catalog.entries.len() >= MAX_WORKSPACES {
        return Err(format!(
            "At most {MAX_WORKSPACES} local projects can be stored."
        ));
    }
    if catalog.entries.iter().any(|entry| entry.id == workspace_id) {
        return Err("A current local project already uses this deleted project's ID.".into());
    }

    let primary = workspace_path(root, workspace_id);
    let primary_records = workspace_records_path(root, workspace_id);
    let backup = workspace_backup_path(root, workspace_id);
    let backup_records = workspace_backup_records_path(root, workspace_id);
    let vault = root.join("vaults").join(format!("{workspace_id}.enc.json"));
    let snapshots = workspace_snapshot_dir(root, workspace_id);
    let snapshots_conflict = match fs::symlink_metadata(&snapshots) {
        Ok(_) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(error.to_string()),
    };
    if path_present(&primary)?
        || path_present(&backup)?
        || path_present(&primary_records)?
        || path_present(&backup_records)?
        || (vault_bytes.is_some() && vault.exists())
        || snapshots_conflict
    {
        return Err("Existing local files conflict with this deleted project restore.".into());
    }

    let mut created_paths = Vec::new();
    let mut moved_snapshots = false;
    let restore_result = (|| {
        created_paths.push(primary.clone());
        created_paths.push(primary_records.clone());
        write_physical_copy(&primary, &primary_records, &workspace)?;
        if let Some(value) = backup_workspace.as_ref() {
            created_paths.push(backup.clone());
            created_paths.push(backup_records.clone());
            write_physical_copy(&backup, &backup_records, value)?;
        }
        if let Some(bytes) = vault_bytes.as_deref() {
            fs::create_dir_all(
                vault
                    .parent()
                    .ok_or_else(|| "The project vault path is invalid.".to_string())?,
            )
            .map_err(|error| error.to_string())?;
            created_paths.push(vault.clone());
            write_bytes_atomic(&vault, bytes)?;
        }
        if has_snapshots {
            ensure_snapshot_root(root)?;
            fs::rename(&snapshots_trash, &snapshots).map_err(|error| error.to_string())?;
            moved_snapshots = true;
        }
        catalog.entries.push(catalog_entry.clone());
        catalog.active_workspace_id = workspace_id.into();
        write_catalog(root, &catalog)
    })();
    if let Err(error) = restore_result {
        if moved_snapshots {
            let _ = fs::rename(&snapshots, &snapshots_trash);
        }
        for path in created_paths {
            if path.is_dir() {
                let _ = fs::remove_dir_all(path);
            } else {
                let _ = fs::remove_file(path);
            }
        }
        return Err(error);
    }

    if primary_bytes.is_some() {
        if primary_workspace.is_some() {
            let _ = fs::remove_file(&primary_trash);
            let _ = fs::remove_dir_all(&primary_records_trash);
        } else {
            preserve_trashed_invalid_store(
                root,
                workspace_id,
                deleted_at,
                "workspace",
                &primary_trash,
                &primary_records_trash,
            );
        }
    }
    if backup_bytes.is_some() {
        if backup_workspace.is_some() {
            let _ = fs::remove_file(&backup_trash);
            let _ = fs::remove_dir_all(&backup_records_trash);
        } else {
            preserve_trashed_invalid_store(
                root,
                workspace_id,
                deleted_at,
                "backup",
                &backup_trash,
                &backup_records_trash,
            );
        }
    }
    if vault_bytes.is_some() {
        let _ = fs::remove_file(vault_trash);
    }
    if metadata_bytes.is_some() {
        if valid_trash_catalog_entry(metadata_bytes.as_deref().unwrap_or_default(), workspace_id)
            .is_some()
        {
            let _ = fs::remove_file(&metadata_trash);
        } else {
            preserve_trashed_invalid(root, workspace_id, deleted_at, "metadata", &metadata_trash);
        }
    }
    snapshot(root, catalog, recovery)
}

pub fn purge_trash(root: &Path, workspace_id: &str, deleted_at: i64) -> Result<(), String> {
    validate_workspace_id(workspace_id)?;
    if deleted_at < 0 {
        return Err("The deleted-project recovery timestamp is invalid.".into());
    }
    let mut paths = Vec::new();
    for label in ["workspace", "backup", "vault", "metadata"] {
        let path = trash_file_path(root, workspace_id, deleted_at, label);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_file() => paths.push(path),
            Ok(_) => return Err("A deleted-project recovery item is not a regular file.".into()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    let snapshots = trash_snapshot_dir(root, workspace_id, deleted_at);
    let has_snapshots = match fs::symlink_metadata(&snapshots) {
        Ok(metadata) if metadata.file_type().is_dir() => true,
        Ok(_) => return Err("A deleted-project recovery item is not a regular directory.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(error.to_string()),
    };
    let record_directories = [
        trash_records_dir(root, workspace_id, deleted_at, "workspace"),
        trash_records_dir(root, workspace_id, deleted_at, "backup"),
    ]
    .into_iter()
    .filter_map(|path| match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_dir() => Some(Ok(path)),
        Ok(_) => Some(Err(
            "A deleted-project recovery item is not a regular directory.".to_string(),
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => Some(Err(error.to_string())),
    })
    .collect::<Result<Vec<_>, _>>()?;
    if paths.is_empty() && record_directories.is_empty() && !has_snapshots {
        return Err("This deleted-project recovery copy no longer exists.".into());
    }
    for path in paths {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    for path in record_directories {
        fs::remove_dir_all(path).map_err(|error| error.to_string())?;
    }
    if has_snapshots {
        fs::remove_dir_all(snapshots).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn empty_trash(root: &Path) -> Result<usize, String> {
    let groups = collect_trash_files(root)?;
    let mut removed = 0;
    for files in groups.into_values() {
        for path in [files.workspace, files.backup, files.vault, files.metadata]
            .into_iter()
            .flatten()
        {
            fs::remove_file(path).map_err(|error| error.to_string())?;
            removed += 1;
        }
        for path in [files.workspace_records, files.backup_records]
            .into_iter()
            .flatten()
        {
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
            removed += 1;
        }
        if let Some(snapshots) = files.snapshots {
            fs::remove_dir_all(snapshots).map_err(|error| error.to_string())?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn restore_backup(root: &Path, workspace_id: &str) -> Result<WorkspaceCatalogSnapshot, String> {
    validate_workspace_id(workspace_id)?;
    let backup = workspace_backup_path(root, workspace_id);
    let backup_records = workspace_backup_records_path(root, workspace_id);
    migrate_stored_workspace_copy(&backup, &backup_records, workspace_id)?;
    let workspace = read_valid_stored_workspace(&backup, &backup_records)
        .ok_or_else(|| "This project does not have a valid backup to restore.".to_string())?;
    let primary = workspace_path(root, workspace_id);
    let primary_records = workspace_records_path(root, workspace_id);
    if (path_present(&primary)? || path_present(&primary_records)?)
        && read_valid_stored_workspace(&primary, &primary_records).is_none()
    {
        preserve_invalid_store(root, workspace_id, &primary, &primary_records)?;
    }
    write_physical_copy(&primary, &primary_records, &workspace)?;
    open(root, workspace_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn workspace(name: &str) -> Value {
        serde_json::json!({
            "format": "brunomnia",
            "version": 22,
            "name": name,
            "collections": []
        })
    }

    fn runtime_workspace(name: &str) -> Value {
        serde_json::json!({
            "format": "brunomnia",
            "version": 39,
            "name": name,
            "collections": [{
                "id": "collection-one",
                "requests": [{
                    "id": "request-one",
                    "auth": {
                        "type": "oauth2",
                        "code": "",
                        "codeVerifier": "",
                        "accessToken": "request-access",
                        "identityToken": "",
                        "refreshToken": "request-refresh",
                        "expiresAt": 123
                    }
                }],
                "folders": []
            }],
            "mcpClients": [{
                "id": "mcp-one",
                "authType": "oauth2",
                "token": "mcp-access",
                "oauthRefreshToken": "mcp-refresh",
                "oauthIdentityToken": "",
                "oauthExpiresAt": 456,
                "oauthRegisteredClientId": "registered-client",
                "oauthRegisteredClientSecret": "registered-secret",
                "oauthRegisteredClientIdIssuedAt": 0,
                "oauthRegisteredClientSecretExpiresAt": 0,
                "oauthRegisteredTokenEndpointAuthMethod": "client_secret_post"
            }]
        })
    }

    #[test]
    fn migrates_legacy_workspace_and_manages_multiple_projects() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let legacy = directory.path().join("workspace.json");
        fs::write(&legacy, serde_json::to_vec(&workspace("Legacy")).unwrap()).unwrap();

        let loaded = load(&root, Some(&legacy), &workspace("Default")).unwrap();
        assert_eq!(loaded.entries.len(), 1);
        assert_eq!(loaded.workspace["name"], "Legacy");
        assert_eq!(loaded.active_workspace_id, "local-workspace");

        let created = create(&root, "second", &workspace("Second")).unwrap();
        assert_eq!(created.entries.len(), 2);
        assert_eq!(created.active_workspace_id, "second");
        assert_eq!(created.workspace["name"], "Second");

        let reopened = open(&root, "local-workspace").unwrap();
        assert_eq!(reopened.workspace["name"], "Legacy");
        let renamed = rename(&root, "second", "Renamed").unwrap();
        assert_eq!(renamed.entries[1].name, "Renamed");
        let deleted_created_at = renamed.entries[1].created_at.clone();
        let deleted_updated_at = renamed.entries[1].updated_at.clone();
        let vault = root.join("vaults").join("second.enc.json");
        fs::create_dir_all(vault.parent().unwrap()).unwrap();
        fs::write(&vault, b"encrypted").unwrap();
        let remaining = delete(&root, "second").unwrap();
        assert_eq!(remaining.entries.len(), 1);
        assert!(!vault.exists());
        assert!(root
            .join("trash")
            .read_dir()
            .unwrap()
            .flatten()
            .any(|entry| entry.file_name().to_string_lossy().contains(".vault.json")));
        assert!(delete(&root, "local-workspace").is_err());

        let trashed = list_trash(&root).unwrap();
        assert_eq!(trashed.len(), 1);
        assert_eq!(trashed[0].workspace_id, "second");
        assert_eq!(trashed[0].name, "Renamed");
        assert_eq!(trashed[0].status, "ready");
        assert!(trashed[0].has_backup);
        assert!(trashed[0].has_vault);

        let restored = restore_trash(&root, "second", trashed[0].deleted_at).unwrap();
        assert_eq!(restored.active_workspace_id, "second");
        assert_eq!(restored.workspace["name"], "Renamed");
        assert_eq!(restored.entries.len(), 2);
        let restored_entry = restored
            .entries
            .iter()
            .find(|entry| entry.id == "second")
            .unwrap();
        assert_eq!(restored_entry.created_at, deleted_created_at);
        assert_eq!(restored_entry.updated_at, deleted_updated_at);
        assert_eq!(fs::read(vault).unwrap(), b"encrypted");
        assert!(list_trash(&root).unwrap().is_empty());
    }

    #[test]
    fn rotates_valid_backups_and_restores_corrupt_primary_files() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let initial = load(&root, None, &workspace("Initial")).unwrap();
        let id = initial.active_workspace_id;

        save(&root, &id, &workspace("Saved")).unwrap();
        fs::write(workspace_path(&root, &id), b"{ broken").unwrap();
        let recovered = open(&root, &id).unwrap();
        assert_eq!(recovered.workspace["name"], "Initial");
        assert_eq!(recovered.entries[0].status, "recoverable");
        assert_eq!(recovered.recovery.unwrap().kind, "workspace-backup");

        let restored = restore_backup(&root, &id).unwrap();
        assert_eq!(restored.entries[0].status, "ready");
        assert_eq!(restored.workspace["name"], "Initial");
        assert!(root.join("recovery").read_dir().unwrap().next().is_some());
    }

    #[test]
    fn recovers_when_one_authoritative_physical_record_is_corrupt() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let mut initial_workspace = workspace("Initial physical");
        initial_workspace["collections"] = serde_json::json!([{
            "id": "physical-collection",
            "name": "Physical collection",
            "requests": [],
            "folders": []
        }]);
        let initial = load(&root, None, &initial_workspace).unwrap();
        let id = initial.active_workspace_id;
        let mut saved_workspace = initial_workspace.clone();
        saved_workspace["name"] = Value::String("Saved physical".into());
        save(&root, &id, &saved_workspace).unwrap();

        let manifest = read_json(&workspace_path(&root, &id)).unwrap();
        let record_key = workspace_physical_store::record_keys(&manifest).remove(0);
        fs::write(
            workspace_records_path(&root, &id).join(record_key),
            b"{ broken",
        )
        .unwrap();

        let recovered = open(&root, &id).unwrap();
        assert_eq!(recovered.workspace["name"], "Initial physical");
        assert_eq!(recovered.entries[0].status, "recoverable");
        assert_eq!(recovered.recovery.unwrap().kind, "workspace-backup");

        let restored = restore_backup(&root, &id).unwrap();
        assert_eq!(restored.entries[0].status, "ready");
        assert_eq!(restored.workspace["name"], "Initial physical");
        assert!(workspace_physical_store::is_manifest(
            &read_json(&workspace_path(&root, &id)).unwrap()
        ));
    }

    #[test]
    fn refuses_deleted_project_restore_after_its_id_is_reused() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        load(&root, None, &workspace("Initial")).unwrap();
        create(&root, "second", &workspace("Deleted")).unwrap();
        delete(&root, "second").unwrap();
        let deleted_at = list_trash(&root).unwrap()[0].deleted_at;

        create(&root, "second", &workspace("Replacement")).unwrap();
        let error = restore_trash(&root, "second", deleted_at).unwrap_err();
        assert!(error.contains("already uses"));
        assert_eq!(
            open(&root, "second").unwrap().workspace["name"],
            "Replacement"
        );
        assert_eq!(list_trash(&root).unwrap().len(), 1);
    }

    #[test]
    fn permanently_purges_exact_or_all_recognized_deleted_projects() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        load(&root, None, &workspace("Initial")).unwrap();
        create(&root, "second", &workspace("Second")).unwrap();
        create_snapshot(&root, "second", "Second snapshot").unwrap();
        delete(&root, "second").unwrap();
        create(&root, "third", &workspace("Third")).unwrap();
        delete(&root, "third").unwrap();
        fs::write(root.join("trash").join("keep.txt"), b"keep").unwrap();

        let deleted = list_trash(&root).unwrap();
        assert_eq!(deleted.len(), 2);
        let second = deleted
            .iter()
            .find(|entry| entry.workspace_id == "second")
            .unwrap();
        assert!(second.has_snapshots);
        purge_trash(&root, "second", second.deleted_at).unwrap();
        assert_eq!(list_trash(&root).unwrap().len(), 1);
        assert!(purge_trash(&root, "second", second.deleted_at).is_err());
        assert!(restore_trash(&root, "second", second.deleted_at).is_err());

        assert!(empty_trash(&root).unwrap() > 0);
        assert!(list_trash(&root).unwrap().is_empty());
        assert_eq!(
            fs::read(root.join("trash").join("keep.txt")).unwrap(),
            b"keep"
        );
    }

    #[test]
    fn restores_valid_projects_when_optional_trash_metadata_is_corrupt() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        load(&root, None, &workspace("Initial")).unwrap();
        create(&root, "second", &workspace("Second")).unwrap();
        delete(&root, "second").unwrap();
        let deleted_at = list_trash(&root).unwrap()[0].deleted_at;
        fs::write(
            trash_file_path(&root, "second", deleted_at, "metadata"),
            b"{ broken",
        )
        .unwrap();

        let restored = restore_trash(&root, "second", deleted_at).unwrap();
        assert_eq!(restored.workspace["name"], "Second");
        assert!(root
            .join("recovery")
            .read_dir()
            .unwrap()
            .flatten()
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .contains("deleted-metadata.invalid.json")));
    }

    #[test]
    fn reads_inactive_projects_and_persists_manual_order() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let initial = load(&root, None, &workspace("Initial")).unwrap();
        let first_id = initial.active_workspace_id;
        create(&root, "second", &workspace("Second")).unwrap();
        create(&root, "third", &workspace("Third")).unwrap();
        open(&root, &first_id).unwrap();

        assert_eq!(read(&root, "second").unwrap()["name"], "Second");
        let reordered = reorder(&root, "third", &first_id, "before").unwrap();
        assert_eq!(
            reordered
                .entries
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            vec!["third", first_id.as_str(), "second"]
        );
        assert_eq!(reordered.active_workspace_id, first_id);
        assert_eq!(reordered.workspace["name"], "Initial");

        let reordered = reorder(&root, "third", "second", "after").unwrap();
        assert_eq!(
            reordered
                .entries
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            vec![first_id.as_str(), "second", "third"]
        );
        assert!(reorder(&root, "second", "third", "middle").is_err());
    }

    #[test]
    fn creates_restores_bounds_and_reparents_project_snapshots() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let initial = load(&root, None, &workspace("Initial")).unwrap();
        let workspace_id = initial.active_workspace_id;
        let baseline = create_snapshot(&root, &workspace_id, "Baseline").unwrap();
        assert_eq!(baseline.file_count, 0);
        save(&root, &workspace_id, &workspace("Changed")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        create_snapshot(&root, &workspace_id, "Changed version").unwrap();

        let history = list_snapshots(&root, &workspace_id).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].message, "Changed version");
        assert!(history.iter().all(|entry| entry.size_bytes > 0));
        assert_eq!(
            restore_snapshot(&root, &workspace_id, &baseline.id)
                .unwrap()
                .workspace["name"],
            "Initial"
        );

        create(&root, "other", &workspace("Other")).unwrap();
        open(&root, &workspace_id).unwrap();
        delete(&root, &workspace_id).unwrap();
        let deleted = list_trash(&root)
            .unwrap()
            .into_iter()
            .find(|entry| entry.workspace_id == workspace_id)
            .unwrap();
        assert!(deleted.has_snapshots);
        fs::create_dir_all(workspace_snapshot_dir(&root, &workspace_id)).unwrap();
        assert!(restore_trash(&root, &workspace_id, deleted.deleted_at)
            .unwrap_err()
            .contains("conflict"));
        fs::remove_dir(workspace_snapshot_dir(&root, &workspace_id)).unwrap();
        restore_trash(&root, &workspace_id, deleted.deleted_at).unwrap();
        assert_eq!(list_snapshots(&root, &workspace_id).unwrap().len(), 2);

        for index in 0..51 {
            create_snapshot(&root, &workspace_id, &format!("Retained {index}")).unwrap();
        }
        let retained = list_snapshots(&root, &workspace_id).unwrap();
        assert_eq!(retained.len(), MAX_SNAPSHOTS);
        assert!(!retained.iter().any(|entry| entry.message == "Baseline"));
    }

    #[cfg(unix)]
    #[test]
    fn refuses_snapshot_store_symlink_traversal() {
        use std::os::unix::fs::symlink;

        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let outside = directory.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        let loaded = load(&root, None, &workspace("Initial")).unwrap();
        symlink(&outside, root.join("snapshots")).unwrap();

        let error = create_snapshot(&root, &loaded.active_workspace_id, "Blocked").unwrap_err();
        assert!(error.contains("regular directory"));
        assert!(outside.read_dir().unwrap().next().is_none());
    }

    #[test]
    fn exposes_only_valid_saved_project_paths_for_cli_use() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let loaded = load(&root, None, &workspace("Initial")).unwrap();
        let expected =
            fs::canonicalize(workspace_path(&root, &loaded.active_workspace_id)).unwrap();

        assert_eq!(
            cli_path(&root, &loaded.active_workspace_id).unwrap(),
            expected.to_string_lossy()
        );
        assert!(cli_path(&root, "../escape").is_err());
        assert!(cli_path(&root, "missing").is_err());
    }

    #[test]
    fn rebuilds_a_missing_catalog_from_valid_project_files() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        fs::create_dir_all(&root).unwrap();
        write_json_atomic(&workspace_path(&root, "alpha"), &workspace("Alpha")).unwrap();
        write_json_atomic(&workspace_path(&root, "beta"), &workspace("Beta")).unwrap();

        let loaded = load(&root, None, &workspace("Default")).unwrap();
        assert_eq!(loaded.entries.len(), 2);
        assert_eq!(loaded.recovery.unwrap().kind, "catalog-rebuilt");
    }

    #[test]
    fn scopes_vault_files_and_migrates_only_the_legacy_project() {
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let legacy = directory.path().join("local-vault.enc.json");
        fs::write(&legacy, b"legacy-vault").unwrap();

        let migrated = project_vault_path(&root, &legacy, "local-workspace").unwrap();
        let separate = project_vault_path(&root, &legacy, "second").unwrap();
        assert_eq!(fs::read(migrated).unwrap(), b"legacy-vault");
        assert!(!separate.exists());
        assert_ne!(
            project_vault_path(&root, &legacy, "first").unwrap(),
            project_vault_path(&root, &legacy, "second").unwrap()
        );
    }

    #[test]
    fn protects_runtime_credentials_across_catalog_backup_and_trash_paths() {
        crate::runtime_credentials::set_test_master_key([42; 32]);
        let directory = tempdir().unwrap();
        let root = directory.path().join("workspaces");
        let legacy = directory.path().join("workspace.json");
        write_json_atomic(&legacy, &runtime_workspace("Protected")).unwrap();

        let loaded = load(&root, Some(&legacy), &workspace("Default")).unwrap();
        assert_eq!(loaded.active_workspace_id, "local-workspace");
        assert_eq!(
            loaded.workspace["collections"][0]["requests"][0]["auth"]["accessToken"],
            "request-access"
        );
        assert_eq!(loaded.workspace["mcpClients"][0]["token"], "mcp-access");
        let primary_manifest = read_json(&workspace_path(&root, "local-workspace")).unwrap();
        assert!(workspace_physical_store::is_manifest(&primary_manifest));
        let primary_record_keys = workspace_physical_store::record_keys(&primary_manifest);
        assert_eq!(primary_record_keys.len(), 2);
        assert!(primary_record_keys.iter().all(|key| {
            workspace_records_path(&root, "local-workspace")
                .join(key)
                .is_file()
        }));

        let stored_primary = read_valid_stored_workspace(
            &workspace_path(&root, "local-workspace"),
            &workspace_records_path(&root, "local-workspace"),
        )
        .unwrap();
        let stored_legacy = read_valid_workspace(&legacy).unwrap();
        for stored in [stored_primary, stored_legacy] {
            assert!(stored.get("protectedRuntimeCredentials").is_some());
            assert_eq!(
                stored["collections"][0]["requests"][0]["auth"]["accessToken"],
                ""
            );
            assert_eq!(stored["mcpClients"][0]["token"], "");
            let serialized = serde_json::to_string(&stored).unwrap();
            assert!(!serialized.contains("request-access"));
            assert!(!serialized.contains("mcp-access"));
            assert!(!serialized.contains("registered-secret"));
        }

        save(&root, "local-workspace", &loaded.workspace).unwrap();
        let backup = read_valid_stored_workspace(
            &workspace_backup_path(&root, "local-workspace"),
            &workspace_backup_records_path(&root, "local-workspace"),
        )
        .unwrap();
        assert!(backup.get("protectedRuntimeCredentials").is_some());
        assert_eq!(backup["mcpClients"][0]["oauthRegisteredClientSecret"], "");

        let snapshot = create_snapshot(&root, "local-workspace", "Protected snapshot").unwrap();
        let stored_snapshot = serde_json::from_slice::<WorkspaceSnapshotFile>(
            &fs::read(workspace_snapshot_path(
                &root,
                "local-workspace",
                &snapshot.id,
            ))
            .unwrap(),
        )
        .unwrap();
        assert!(stored_snapshot
            .workspace
            .get("protectedRuntimeCredentials")
            .is_some());
        let serialized_snapshot = serde_json::to_string(&stored_snapshot).unwrap();
        assert!(!serialized_snapshot.contains("request-access"));
        assert!(!serialized_snapshot.contains("mcp-access"));
        assert!(!serialized_snapshot.contains("registered-secret"));

        create(&root, "second", &workspace("Second")).unwrap();
        delete(&root, "local-workspace").unwrap();
        let deleted = list_trash(&root).unwrap();
        let entry = deleted
            .iter()
            .find(|entry| entry.workspace_id == "local-workspace")
            .unwrap();
        assert!(entry.has_snapshots);
        let trash = read_valid_stored_workspace(
            &trash_file_path(&root, "local-workspace", entry.deleted_at, "workspace"),
            &trash_records_dir(&root, "local-workspace", entry.deleted_at, "workspace"),
        )
        .unwrap();
        assert!(trash.get("protectedRuntimeCredentials").is_some());
        assert_eq!(trash["mcpClients"][0]["token"], "");

        let restored = restore_trash(&root, "local-workspace", entry.deleted_at).unwrap();
        assert_eq!(restored.workspace["mcpClients"][0]["token"], "mcp-access");
        assert_eq!(
            restored.workspace["collections"][0]["requests"][0]["auth"]["refreshToken"],
            "request-refresh"
        );
        assert_eq!(list_snapshots(&root, "local-workspace").unwrap().len(), 1);
    }
}
