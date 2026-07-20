use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Output},
};
use url::Url;
use uuid::Uuid;

const PROJECT_FILE: &str = ".brunomnia/project.yaml";
const MANIFEST_FILE: &str = ".brunomnia/manifest.yaml";
const MAX_TEXT_OUTPUT: usize = 2_000_000;
const MANAGED_ROOTS: [&str; 7] = [
    ".brunomnia",
    "collections",
    "environments",
    "designs",
    "mocks",
    "mcp-clients",
    "tests",
];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWriteInput {
    pub path: String,
    pub workspace: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWriteOutput {
    pub path: String,
    pub files_written: usize,
    pub files_unchanged: usize,
    pub files_removed: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    pub staged: bool,
    pub conflicted: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteBranch {
    pub remote: String,
    pub branch: String,
    pub tracking_ref: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusOutput {
    pub branch: String,
    pub upstream: String,
    pub ahead: usize,
    pub behind: usize,
    pub can_push: bool,
    pub files: Vec<GitFileStatus>,
    pub branches: Vec<String>,
    pub remote_branches: Vec<GitRemoteBranch>,
    pub remotes: Vec<GitRemote>,
    pub merge_in_progress: bool,
    pub rebase_in_progress: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOperationOutput {
    pub summary: String,
    pub stdout: String,
    pub stderr: String,
    pub status: GitStatusOutput,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflict {
    pub path: String,
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub working: String,
    pub binary: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_at: String,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitPatch {
    pub oid: String,
    pub patch: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInput {
    pub path: String,
    pub message: String,
    #[serde(default)]
    pub author_name: String,
    #[serde(default)]
    pub author_email: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPushPullInput {
    pub path: String,
    #[serde(default = "default_remote")]
    pub remote: String,
    #[serde(default)]
    pub branch: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GitCredentialInput {
    pub provider: String,
    #[serde(default)]
    pub username: String,
    pub token: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositoryProbeOutput {
    pub default_branch: String,
    pub branches: Vec<String>,
    pub total_files: usize,
    pub brunomnia_files: usize,
    pub insomnia_files: usize,
    pub specification_files: usize,
    pub truncated: bool,
}

fn default_remote() -> String {
    "origin".into()
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
struct ProjectManifest {
    version: u32,
    files: Vec<String>,
}

fn project_root(path: &str, create: bool) -> Result<PathBuf, String> {
    let input = PathBuf::from(path.trim());
    if input.as_os_str().is_empty() {
        return Err("Choose a project folder.".into());
    }
    if create {
        fs::create_dir_all(&input)
            .map_err(|error| format!("Unable to create project folder: {error}"))?;
    }
    let root = input
        .canonicalize()
        .map_err(|error| format!("Unable to open project folder: {error}"))?;
    if !root.is_dir() {
        return Err("The project path must be a folder.".into());
    }
    Ok(root)
}

fn safe_relative(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if candidate.as_os_str().is_empty()
        || candidate.is_absolute()
        || candidate.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(format!("Unsafe project-relative path: {path}"));
    }
    Ok(candidate)
}

fn is_managed(path: &str) -> bool {
    safe_relative(path).is_ok()
        && MANAGED_ROOTS
            .iter()
            .any(|root| path == *root || path.starts_with(&format!("{root}/")))
}

fn fnv(value: &str) -> u64 {
    value
        .as_bytes()
        .iter()
        .fold(14695981039346656037u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(1099511628211)
        })
}

fn file_name(value: &Value, fallback: &str) -> String {
    let name = value
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or(fallback);
    let id = value.get("id").and_then(Value::as_str).unwrap_or(name);
    let mut slug = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    slug = slug.trim_matches('-').chars().take(48).collect();
    if slug.is_empty() {
        slug = fallback.into();
    }
    format!("{slug}-{:08x}.yaml", fnv(id) as u32)
}

fn yaml(value: &Value) -> Result<String, String> {
    serde_yaml::to_string(value)
        .map_err(|error| format!("Unable to serialize project YAML: {error}"))
}

fn ensure_directory(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err("Managed project directories must be relative.".into());
        };
        current.push(name);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Managed project directory cannot be a symlink: {}",
                    current.display()
                ));
            }
            Ok(metadata) if !metadata.is_dir() => {
                return Err(format!(
                    "Managed project path is not a directory: {}",
                    current.display()
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir(&current)
                .map_err(|error| format!("Unable to create project directory: {error}"))?,
            Err(error) => return Err(format!("Unable to inspect project directory: {error}")),
        }
    }
    Ok(current)
}

fn reject_symlink(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
            "Managed project file cannot be a symlink: {}",
            path.display()
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to inspect project file: {error}")),
    }
}

fn confined_existing(path: &Path, root: &Path) -> Result<PathBuf, String> {
    reject_symlink(path)?;
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to open {}: {error}", path.display()))?;
    if !canonical.starts_with(root) {
        return Err(format!(
            "Managed project path escapes the project root: {}",
            path.display()
        ));
    }
    Ok(canonical)
}

fn atomic_write(target: &Path, contents: &[u8]) -> Result<(), String> {
    reject_symlink(target)?;
    let parent = target
        .parent()
        .ok_or_else(|| "Managed file has no parent directory.".to_string())?;
    let temporary = parent.join(format!(".brunomnia-{}.tmp", Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| format!("Unable to create temporary project file: {error}"))?;
        file.write_all(contents)
            .map_err(|error| format!("Unable to write temporary project file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Unable to flush temporary project file: {error}"))?;
        fs::rename(&temporary, target)
            .map_err(|error| format!("Unable to replace project file: {error}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn write_if_changed(root: &Path, relative: &str, contents: &str) -> Result<bool, String> {
    let relative = safe_relative(relative)?;
    let target = root.join(&relative);
    let parent = relative.parent().unwrap_or_else(|| Path::new(""));
    ensure_directory(root, parent)?;
    reject_symlink(&target)?;
    if fs::read_to_string(&target).ok().as_deref() == Some(contents) {
        return Ok(false);
    }
    atomic_write(&target, contents.as_bytes())?;
    Ok(true)
}

fn read_manifest(root: &Path) -> ProjectManifest {
    let path = root.join(MANIFEST_FILE);
    confined_existing(&path, root)
        .ok()
        .and_then(|safe| fs::read_to_string(safe).ok())
        .and_then(|source| serde_yaml::from_str(&source).ok())
        .unwrap_or_default()
}

fn object_subset(workspace: &Map<String, Value>, keys: &[&str]) -> Value {
    Value::Object(
        keys.iter()
            .filter_map(|key| {
                workspace
                    .get(*key)
                    .cloned()
                    .map(|value| ((*key).into(), value))
            })
            .collect(),
    )
}

pub fn write_project(input: ProjectWriteInput) -> Result<ProjectWriteOutput, String> {
    let root = project_root(&input.path, true)?;
    let workspace = input
        .workspace
        .as_object()
        .ok_or_else(|| "The workspace must be an object.".to_string())?;
    let mut files = BTreeMap::<String, String>::new();
    let metadata = object_subset(
        workspace,
        &[
            "format",
            "version",
            "name",
            "activeRequestId",
            "activeEnvironmentId",
        ],
    );
    files.insert(PROJECT_FILE.into(), yaml(&metadata)?);
    for (key, directory, fallback) in [
        ("collections", "collections", "collection"),
        ("environments", "environments", "environment"),
        ("apiDesigns", "designs", "design"),
        ("mockServers", "mocks", "mock"),
        ("mcpClients", "mcp-clients", "mcp-client"),
    ] {
        for value in workspace
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            files.insert(
                format!("{directory}/{}", file_name(value, fallback)),
                yaml(value)?,
            );
        }
    }

    let previous = read_manifest(&root);
    let next_paths = files.keys().cloned().collect::<BTreeSet<_>>();
    let mut removed = 0;
    for relative in previous.files {
        if !next_paths.contains(&relative) && is_managed(&relative) {
            let target = root.join(safe_relative(&relative)?);
            if let Some(parent) = target.parent() {
                if parent.exists() {
                    confined_existing(parent, &root)?;
                }
            }
            reject_symlink(&target)?;
            if target.is_file() {
                fs::remove_file(target)
                    .map_err(|error| format!("Unable to remove stale managed file: {error}"))?;
                removed += 1;
            }
        }
    }

    let mut written = 0;
    let mut unchanged = 0;
    for (relative, contents) in &files {
        if write_if_changed(&root, relative, contents)? {
            written += 1;
        } else {
            unchanged += 1;
        }
    }
    let manifest = ProjectManifest {
        version: 1,
        files: next_paths.into_iter().collect(),
    };
    if write_if_changed(
        &root,
        MANIFEST_FILE,
        &serde_yaml::to_string(&manifest).map_err(|error| error.to_string())?,
    )? {
        written += 1;
    } else {
        unchanged += 1;
    }
    Ok(ProjectWriteOutput {
        path: root.to_string_lossy().into_owned(),
        files_written: written,
        files_unchanged: unchanged,
        files_removed: removed,
    })
}

fn read_yaml(path: &Path, root: &Path) -> Result<Value, String> {
    let safe = confined_existing(path, root)?;
    let source = fs::read_to_string(&safe)
        .map_err(|error| format!("Unable to read {}: {error}", path.display()))?;
    serde_yaml::from_str(&source)
        .map_err(|error| format!("Invalid YAML in {}: {error}", path.display()))
}

fn read_yaml_directory(root: &Path, directory: &str) -> Result<Vec<Value>, String> {
    let path = root.join(directory);
    if !path.exists() {
        return Ok(vec![]);
    }
    let path = confined_existing(&path, root)?;
    let mut entries = fs::read_dir(&path)
        .map_err(|error| format!("Unable to list {}: {error}", path.display()))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|entry| {
            matches!(
                entry.extension().and_then(|value| value.to_str()),
                Some("yaml" | "yml")
            )
        })
        .collect::<Vec<_>>();
    entries.sort();
    entries.iter().map(|entry| read_yaml(entry, root)).collect()
}

pub fn read_project(path: String) -> Result<Value, String> {
    let root = project_root(&path, false)?;
    let mut workspace = read_yaml(&root.join(PROJECT_FILE), &root)?
        .as_object()
        .cloned()
        .ok_or_else(|| "Project metadata must be an object.".to_string())?;
    workspace.insert(
        "collections".into(),
        read_yaml_directory(&root, "collections")?.into(),
    );
    workspace.insert(
        "environments".into(),
        read_yaml_directory(&root, "environments")?.into(),
    );
    workspace.insert(
        "apiDesigns".into(),
        read_yaml_directory(&root, "designs")?.into(),
    );
    workspace.insert(
        "mockServers".into(),
        read_yaml_directory(&root, "mocks")?.into(),
    );
    workspace.insert(
        "mcpClients".into(),
        read_yaml_directory(&root, "mcp-clients")?.into(),
    );
    Ok(Value::Object(workspace))
}

fn git_output(path: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|error| format!("Unable to run Git: {error}"))
}

const GIT_CREDENTIAL_HELPER: &str = "!f() { if test \"$1\" = get; then printf '%s\\n' \"username=$BRUNOMNIA_GIT_USERNAME\" \"password=$BRUNOMNIA_GIT_PASSWORD\"; fi; }; f";

fn validate_credential_field(value: &str, label: &str, limit: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("Enter the Git {label}."));
    }
    if value.len() > limit || value.chars().any(char::is_control) {
        return Err(format!("The Git {label} is invalid."));
    }
    Ok(value.to_string())
}

fn git_auth(
    remote: &str,
    credential: &GitCredentialInput,
) -> Result<(String, String, String), String> {
    let url = Url::parse(remote)
        .map_err(|_| "Token credentials require an HTTP(S) Git remote URL.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Token credentials require an HTTP(S) Git remote URL.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Git remote URLs cannot contain embedded credentials.".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "The Git remote URL has no host.".to_string())?;
    let token = validate_credential_field(&credential.token, "token", 65_536)?;
    let (username, password) = match credential.provider.as_str() {
        "github" => {
            if url.scheme() != "https" || !host.eq_ignore_ascii_case("github.com") {
                return Err("GitHub credentials can only be sent to https://github.com repositories. Use a custom credential for another host.".into());
            }
            (token, "x-oauth-basic".into())
        }
        "gitlab" => {
            if url.scheme() != "https" || !host.eq_ignore_ascii_case("gitlab.com") {
                return Err("GitLab credentials can only be sent to https://gitlab.com repositories. Use a custom credential for another host.".into());
            }
            ("oauth2".into(), token)
        }
        "custom" => (
            validate_credential_field(&credential.username, "username", 500)?,
            token,
        ),
        _ => return Err("Choose GitHub, GitLab, or custom Git credentials.".into()),
    };
    let origin = url.origin().ascii_serialization();
    Ok((origin, username, password))
}

fn authenticated_git_command(
    path: Option<&Path>,
    remote: &str,
    credential: Option<&GitCredentialInput>,
) -> Result<Command, String> {
    let mut command = Command::new("git");
    if let Some(path) = path {
        command.arg("-C").arg(path);
    }
    command.env("GIT_TERMINAL_PROMPT", "0");
    if let Some(credential) = credential {
        let (origin, username, password) = git_auth(remote, credential)?;
        command
            .arg("-c")
            .arg("credential.helper=")
            .arg("-c")
            .arg("credential.useHttpPath=false")
            .arg("-c")
            .arg(format!(
                "credential.{origin}.helper={GIT_CREDENTIAL_HELPER}"
            ))
            .env("BRUNOMNIA_GIT_USERNAME", username)
            .env("BRUNOMNIA_GIT_PASSWORD", password);
    }
    Ok(command)
}

fn authenticated_git_output(
    path: Option<&Path>,
    remote: &str,
    credential: Option<&GitCredentialInput>,
    args: &[&str],
) -> Result<Output, String> {
    authenticated_git_command(path, remote, credential)?
        .args(args)
        .output()
        .map_err(|error| format!("Unable to run Git: {error}"))
}

fn output_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_TEXT_OUTPUT)])
        .trim()
        .to_string()
}

fn require_success(output: Output, operation: &str) -> Result<Output, String> {
    if output.status.success() {
        Ok(output)
    } else {
        let stderr = output_text(&output.stderr);
        let stdout = output_text(&output.stdout);
        Err(format!(
            "{operation} failed: {}",
            if stderr.is_empty() { stdout } else { stderr }
        ))
    }
}

fn git_dir(root: &Path) -> PathBuf {
    let output = git_output(root, &["rev-parse", "--git-dir"]);
    match output.ok().filter(|output| output.status.success()) {
        Some(output) => {
            let value = output_text(&output.stdout);
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                root.join(path)
            }
        }
        None => root.join(".git"),
    }
}

pub fn git_init(path: String, default_branch: String) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, true)?;
    let branch = if default_branch.trim().is_empty() {
        "main"
    } else {
        default_branch.trim()
    };
    require_success(git_output(&root, &["init", "-b", branch])?, "Git init")?;
    git_status(root.to_string_lossy().into_owned())
}

#[cfg(test)]
pub fn git_clone(remote: String, path: String) -> Result<GitStatusOutput, String> {
    git_clone_authenticated(remote, path, None, None)
}

pub fn git_clone_authenticated(
    remote: String,
    path: String,
    branch: Option<String>,
    credential: Option<GitCredentialInput>,
) -> Result<GitStatusOutput, String> {
    if remote.trim().is_empty() {
        return Err("Enter a Git remote URL.".into());
    }
    if remote.trim().starts_with('-') {
        return Err("The Git remote URL cannot begin with a hyphen.".into());
    }
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("Choose a clone destination.".into());
    }
    if target.exists()
        && fs::read_dir(&target)
            .map_err(|error| error.to_string())?
            .next()
            .is_some()
    {
        return Err("The clone destination must be empty.".into());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create clone parent: {error}"))?;
    }
    let branch = branch.unwrap_or_default();
    if !branch.trim().is_empty() {
        require_success(
            Command::new("git")
                .args(["check-ref-format", "--branch", branch.trim()])
                .output()
                .map_err(|error| format!("Unable to validate clone branch: {error}"))?,
            "Validate clone branch",
        )?;
    }
    let mut command = authenticated_git_command(None, remote.trim(), credential.as_ref())?;
    command.arg("clone");
    if !branch.trim().is_empty() {
        command.args(["--branch", branch.trim(), "--single-branch"]);
    }
    let output = command
        .arg("--")
        .arg(remote.trim())
        .arg(&target)
        .output()
        .map_err(|error| format!("Unable to run Git clone: {error}"))?;
    require_success(output, "Git clone")?;
    let root = target.canonicalize().map_err(|error| error.to_string())?;
    git_status(root.to_string_lossy().into_owned())
}

fn parse_remote_refs(source: &str) -> (String, Vec<String>) {
    let mut default_branch = String::new();
    let mut branches = BTreeSet::new();
    for line in source.lines() {
        if let Some(reference) = line
            .strip_prefix("ref: ")
            .and_then(|value| value.split_once('\t'))
            .filter(|(_, destination)| *destination == "HEAD")
            .and_then(|(reference, _)| reference.strip_prefix("refs/heads/"))
        {
            default_branch = reference.to_string();
            continue;
        }
        if let Some(branch) = line
            .split_once('\t')
            .and_then(|(_, reference)| reference.strip_prefix("refs/heads/"))
        {
            branches.insert(branch.to_string());
        }
    }
    if default_branch.is_empty() && branches.contains("main") {
        default_branch = "main".into();
    } else if default_branch.is_empty() && branches.contains("master") {
        default_branch = "master".into();
    } else if default_branch.is_empty() {
        default_branch = branches.iter().next().cloned().unwrap_or_default();
    }
    (default_branch, branches.into_iter().collect())
}

fn scan_repository_paths(source: &str, truncated: bool) -> GitRepositoryProbeOutput {
    let mut total_files = 0;
    let mut brunomnia_files = 0;
    let mut insomnia_files = 0;
    let mut specification_files = 0;
    for path in source.lines().filter(|path| !path.is_empty()).take(50_000) {
        total_files += 1;
        let lower = path.to_ascii_lowercase();
        if lower == ".brunomnia/project.yaml"
            || MANAGED_ROOTS
                .iter()
                .any(|root| lower.starts_with(&format!("{root}/")))
        {
            brunomnia_files += 1;
        }
        if lower.starts_with(".insomnia/")
            || matches!(
                lower.rsplit('/').next().unwrap_or_default(),
                "insomnia.json" | "insomnia.yaml" | "insomnia.yml"
            )
        {
            insomnia_files += 1;
        }
        let file_name = lower.rsplit('/').next().unwrap_or_default();
        if file_name.starts_with("openapi.")
            || file_name.starts_with("swagger.")
            || matches!(
                file_name,
                "asyncapi.yaml" | "asyncapi.yml" | "asyncapi.json"
            )
        {
            specification_files += 1;
        }
    }
    GitRepositoryProbeOutput {
        default_branch: String::new(),
        branches: vec![],
        total_files,
        brunomnia_files,
        insomnia_files,
        specification_files,
        truncated: truncated || source.lines().count() > 50_000,
    }
}

pub fn git_repository_probe(
    remote: String,
    branch: Option<String>,
    credential: Option<GitCredentialInput>,
) -> Result<GitRepositoryProbeOutput, String> {
    let remote = remote.trim();
    if remote.is_empty() {
        return Err("Enter a Git remote URL.".into());
    }
    if remote.starts_with('-') {
        return Err("The Git remote URL cannot begin with a hyphen.".into());
    }
    let refs = require_success(
        authenticated_git_output(
            None,
            remote,
            credential.as_ref(),
            &[
                "ls-remote",
                "--symref",
                "--",
                remote,
                "HEAD",
                "refs/heads/*",
            ],
        )?,
        "Inspect Git repository",
    )?;
    let (default_branch, branches) = parse_remote_refs(&output_text(&refs.stdout));
    if branches.is_empty() {
        return Err("The Git repository has no discoverable branches.".into());
    }
    let requested_branch = branch.unwrap_or_default();
    let requested_branch = requested_branch.trim();
    if requested_branch.is_empty() {
        return Ok(GitRepositoryProbeOutput {
            default_branch,
            branches,
            total_files: 0,
            brunomnia_files: 0,
            insomnia_files: 0,
            specification_files: 0,
            truncated: false,
        });
    }
    if !branches.iter().any(|branch| branch == requested_branch) {
        return Err(format!(
            "Git branch '{requested_branch}' does not exist in the remote repository."
        ));
    }
    let temporary = tempfile::tempdir()
        .map_err(|error| format!("Unable to prepare repository scan: {error}"))?;
    let checkout = temporary.path().join("repository");
    let checkout_text = checkout.to_string_lossy().into_owned();
    require_success(
        authenticated_git_output(
            None,
            remote,
            credential.as_ref(),
            &[
                "clone",
                "--depth",
                "1",
                "--filter=blob:none",
                "--no-checkout",
                "--single-branch",
                "--branch",
                requested_branch,
                "--",
                remote,
                &checkout_text,
            ],
        )?,
        "Scan Git repository",
    )?;
    let tree = require_success(
        git_output(&checkout, &["ls-tree", "-r", "--name-only", "HEAD"])?,
        "Read Git repository tree",
    )?;
    let tree_truncated = tree.stdout.len() > MAX_TEXT_OUTPUT;
    let mut output = scan_repository_paths(&output_text(&tree.stdout), tree_truncated);
    output.default_branch = default_branch;
    output.branches = branches;
    Ok(output)
}

fn parse_branch_header(header: &str) -> (String, String, usize, usize) {
    let value = header.strip_prefix("## ").unwrap_or(header);
    let tracking_head = value
        .split_once("...")
        .map(|(head, _)| head)
        .unwrap_or(value);
    let branch = tracking_head
        .strip_prefix("No commits yet on ")
        .or_else(|| tracking_head.strip_prefix("Initial commit on "))
        .unwrap_or(tracking_head)
        .split([' ', '['])
        .next()
        .unwrap_or("HEAD")
        .trim()
        .to_string();
    let upstream = value
        .split_once("...")
        .map(|(_, tail)| {
            tail.split([' ', '['])
                .next()
                .unwrap_or_default()
                .to_string()
        })
        .unwrap_or_default();
    let ahead = value
        .split("ahead ")
        .nth(1)
        .and_then(|tail| {
            tail.split(|character: char| !character.is_ascii_digit())
                .next()
        })
        .and_then(|number| number.parse().ok())
        .unwrap_or(0);
    let behind = value
        .split("behind ")
        .nth(1)
        .and_then(|tail| {
            tail.split(|character: char| !character.is_ascii_digit())
                .next()
        })
        .and_then(|number| number.parse().ok())
        .unwrap_or(0);
    (branch, upstream, ahead, behind)
}

fn list_branches(root: &Path) -> Vec<String> {
    git_output(root, &["branch", "--format=%(refname:short)"])
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            output_text(&output.stdout)
                .lines()
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn list_remotes(root: &Path) -> Vec<GitRemote> {
    let output = git_output(root, &["remote", "-v"]).ok();
    let mut remotes = BTreeMap::<String, GitRemote>::new();
    if let Some(output) = output.filter(|output| output.status.success()) {
        for line in output_text(&output.stdout).lines() {
            let mut fields = line.split_whitespace();
            let name = fields.next().unwrap_or_default();
            let url = fields.next().unwrap_or_default();
            let kind = fields.next().unwrap_or_default();
            if name.is_empty() || url.is_empty() {
                continue;
            }
            let remote = remotes.entry(name.into()).or_insert(GitRemote {
                name: name.into(),
                fetch_url: String::new(),
                push_url: String::new(),
            });
            if kind.contains("push") {
                remote.push_url = url.into();
            } else {
                remote.fetch_url = url.into();
            }
        }
    }
    remotes.into_values().collect()
}

fn list_remote_branches(root: &Path, remotes: &[GitRemote]) -> Vec<GitRemoteBranch> {
    let output = git_output(
        root,
        &[
            "for-each-ref",
            "--format=%(refname:short)%00%(symref)",
            "refs/remotes",
        ],
    )
    .ok();
    let mut remote_names = remotes
        .iter()
        .map(|remote| remote.name.as_str())
        .collect::<Vec<_>>();
    remote_names.sort_by_key(|name| std::cmp::Reverse(name.len()));
    let mut branches = BTreeSet::new();
    if let Some(output) = output.filter(|output| output.status.success()) {
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let (tracking_ref, symbolic_target) = line.split_once('\0').unwrap_or((line, ""));
            if !symbolic_target.is_empty() {
                continue;
            }
            let Some(remote) = remote_names.iter().find(|remote| {
                tracking_ref
                    .strip_prefix(**remote)
                    .is_some_and(|tail| tail.starts_with('/') && tail.len() > 1)
            }) else {
                continue;
            };
            let branch = tracking_ref[remote.len() + 1..].to_string();
            branches.insert(((*remote).to_string(), branch, tracking_ref.to_string()));
        }
    }
    branches
        .into_iter()
        .map(|(remote, branch, tracking_ref)| GitRemoteBranch {
            remote,
            branch,
            tracking_ref,
        })
        .collect()
}

pub fn git_status(path: String) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    let output = require_success(
        git_output(
            &root,
            &["status", "--porcelain=v1", "-b", "--untracked-files=all"],
        )?,
        "Git status",
    )?;
    let source = output_text(&output.stdout);
    let mut lines = source.lines();
    let (branch, upstream, ahead, behind) = parse_branch_header(lines.next().unwrap_or("## HEAD"));
    let files = lines
        .filter(|line| line.len() >= 3)
        .map(|line| {
            let index_status = line[0..1].to_string();
            let worktree_status = line[1..2].to_string();
            let raw_path = line[3..].trim_matches('"');
            let path = raw_path
                .split(" -> ")
                .last()
                .unwrap_or(raw_path)
                .to_string();
            let conflicted = matches!(
                (index_status.as_str(), worktree_status.as_str()),
                ("D", "D")
                    | ("A", "U")
                    | ("U", "D")
                    | ("U", "A")
                    | ("D", "U")
                    | ("A", "A")
                    | ("U", "U")
            );
            GitFileStatus {
                path,
                staged: index_status != " " && index_status != "?",
                conflicted,
                index_status,
                worktree_status,
            }
        })
        .collect();
    let git = git_dir(&root);
    let remotes = list_remotes(&root);
    let remote_branches = list_remote_branches(&root, &remotes);
    let has_head = git_output(&root, &["rev-parse", "--verify", "HEAD"])
        .is_ok_and(|output| output.status.success());
    let can_push = branch != "HEAD"
        && !branch.is_empty()
        && !remotes.is_empty()
        && if upstream.is_empty() {
            has_head
        } else {
            ahead > 0
        };
    Ok(GitStatusOutput {
        branch,
        upstream,
        ahead,
        behind,
        can_push,
        files,
        branches: list_branches(&root),
        remote_branches,
        remotes,
        merge_in_progress: git.join("MERGE_HEAD").exists(),
        rebase_in_progress: git.join("rebase-merge").exists() || git.join("rebase-apply").exists(),
    })
}

fn operation(
    root: &Path,
    output: Output,
    summary: &str,
    accept_conflicts: bool,
) -> Result<GitOperationOutput, String> {
    let stdout = output_text(&output.stdout);
    let stderr = output_text(&output.stderr);
    if !output.status.success()
        && !(accept_conflicts && !git_conflicts(root.to_string_lossy().into_owned())?.is_empty())
    {
        return Err(format!(
            "{summary} failed: {}",
            if stderr.is_empty() { &stdout } else { &stderr }
        ));
    }
    Ok(GitOperationOutput {
        summary: summary.into(),
        stdout,
        stderr,
        status: git_status(root.to_string_lossy().into_owned())?,
    })
}

fn push_error(output: &Output) -> String {
    let stdout = output_text(&output.stdout);
    let stderr = output_text(&output.stderr);
    let detail = if stderr.is_empty() { stdout } else { stderr };
    let normalized = detail.to_ascii_lowercase();
    if normalized.contains("non-fast-forward")
        || normalized.contains("fetch first")
        || normalized.contains("remote contains work that you do not have locally")
    {
        return "Push rejected because the remote branch has newer commits. Pull and resolve remote changes before pushing again.".into();
    }
    if normalized.contains("authentication failed")
        || normalized.contains("could not read username")
        || normalized.contains("permission denied")
        || normalized.contains("publickey")
        || normalized.contains("write access")
        || normalized.contains("http 401")
        || normalized.contains("http 403")
    {
        return "Push requires valid Git authentication and write permission. Update the installed Git credential helper or SSH agent, then retry.".into();
    }
    if normalized.contains("repository not found") {
        return "The Git remote repository was not found or is not accessible with the installed credentials.".into();
    }
    format!(
        "Push failed: {}",
        if detail.is_empty() {
            "Git returned no error details."
        } else {
            &detail
        }
    )
}

pub fn git_stage(path: String, paths: Vec<String>) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    if paths.is_empty() {
        return Err("Select at least one file to stage.".into());
    }
    let safe = paths
        .iter()
        .map(|path| safe_relative(path))
        .collect::<Result<Vec<_>, _>>()?;
    let mut command = Command::new("git");
    command.arg("-C").arg(&root).arg("add").arg("--");
    safe.iter().for_each(|path| {
        command.arg(path);
    });
    require_success(
        command.output().map_err(|error| error.to_string())?,
        "Git stage",
    )?;
    git_status(root.to_string_lossy().into_owned())
}

pub fn git_unstage(path: String, paths: Vec<String>) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    if paths.is_empty() {
        return Err("Select at least one file to unstage.".into());
    }
    let safe = paths
        .iter()
        .map(|path| safe_relative(path))
        .collect::<Result<Vec<_>, _>>()?;
    let has_head = git_output(&root, &["rev-parse", "--verify", "HEAD"])
        .is_ok_and(|output| output.status.success());
    let mut command = Command::new("git");
    command.arg("-C").arg(&root);
    if has_head {
        command.args(["restore", "--staged", "--"]);
    } else {
        command.args(["rm", "--cached", "--"]);
    }
    safe.iter().for_each(|path| {
        command.arg(path);
    });
    require_success(
        command.output().map_err(|error| error.to_string())?,
        "Git unstage",
    )?;
    git_status(root.to_string_lossy().into_owned())
}

pub fn git_discard(path: String, paths: Vec<String>) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    if paths.is_empty() {
        return Err("Select at least one unstaged file to discard.".into());
    }
    let status = git_status(root.to_string_lossy().into_owned())?;
    if status.merge_in_progress
        || status.rebase_in_progress
        || status.files.iter().any(|file| file.conflicted)
    {
        return Err("Resolve or abort the active Git operation before discarding files.".into());
    }
    let mut tracked = BTreeSet::<PathBuf>::new();
    let mut untracked = BTreeSet::<PathBuf>::new();
    for path in paths {
        let safe = safe_relative(&path)?;
        let Some(file) = status.files.iter().find(|file| file.path == path) else {
            return Err(format!("'{path}' no longer has an unstaged Git change."));
        };
        if file.index_status == "?" && file.worktree_status == "?" {
            untracked.insert(safe);
        } else if file.worktree_status != " " {
            tracked.insert(safe);
        } else {
            return Err(format!("'{path}' has no unstaged Git change to discard."));
        }
    }
    if !tracked.is_empty() {
        let mut command = Command::new("git");
        command
            .arg("-C")
            .arg(&root)
            .args(["restore", "--worktree", "--"]);
        tracked.iter().for_each(|path| {
            command.arg(path);
        });
        require_success(
            command.output().map_err(|error| error.to_string())?,
            "Discard tracked changes",
        )?;
    }
    if !untracked.is_empty() {
        let mut command = Command::new("git");
        command.arg("-C").arg(&root).args(["clean", "-f", "--"]);
        untracked.iter().for_each(|path| {
            command.arg(path);
        });
        require_success(
            command.output().map_err(|error| error.to_string())?,
            "Discard untracked files",
        )?;
    }
    git_status(root.to_string_lossy().into_owned())
}

pub fn git_diff(path: String, staged: bool) -> Result<String, String> {
    let root = project_root(&path, false)?;
    let args = if staged {
        vec!["diff", "--cached", "--no-ext-diff", "--unified=3"]
    } else {
        vec!["diff", "--no-ext-diff", "--unified=3"]
    };
    let output = require_success(git_output(&root, &args)?, "Git diff")?;
    Ok(output_text(&output.stdout))
}

pub fn git_file_diff(path: String, staged: bool, file: String) -> Result<String, String> {
    let root = project_root(&path, false)?;
    let relative = safe_relative(&file)?;
    let status = git_status(root.to_string_lossy().into_owned())?;
    let Some(changed) = status.files.iter().find(|changed| changed.path == file) else {
        return Err(format!("'{file}' is not a current Git change."));
    };
    if staged && !changed.staged {
        return Err(format!("'{file}' has no staged Git change."));
    }
    if !staged && changed.worktree_status == " " {
        return Err(format!("'{file}' has no unstaged Git change."));
    }
    if changed.index_status == "?" && changed.worktree_status == "?" {
        let target = confined_existing(&root.join(relative), &root)?;
        let prefix = format!("Untracked file: {file}\n\n");
        let available = MAX_TEXT_OUTPUT.saturating_sub(prefix.len());
        let mut bytes = Vec::new();
        fs::File::open(&target)
            .map_err(|error| format!("Unable to preview {file}: {error}"))?
            .take((available + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Unable to preview {file}: {error}"))?;
        if bytes.len() > available {
            return Ok(format!(
                "Untracked file: {file}\n\nPreview unavailable because this file exceeds the 2 MB Git text limit."
            ));
        }
        let source = String::from_utf8(bytes).map_err(|_| {
            format!("Untracked file '{file}' is binary and cannot be previewed as text.")
        })?;
        return Ok(format!("{prefix}{source}"));
    }
    let args = if staged {
        vec![
            "diff",
            "--cached",
            "--no-ext-diff",
            "--unified=3",
            "--",
            &file,
        ]
    } else {
        vec!["diff", "--no-ext-diff", "--unified=3", "--", &file]
    };
    let output = require_success(git_output(&root, &args)?, "Git file diff")?;
    Ok(output_text(&output.stdout))
}

fn parse_git_history(bytes: &[u8]) -> Vec<GitCommitSummary> {
    String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_TEXT_OUTPUT)])
        .split('\u{001e}')
        .filter_map(|record| {
            let fields = record
                .trim_matches(['\r', '\n'])
                .split('\0')
                .collect::<Vec<_>>();
            if fields.len() != 8 || fields[0].len() < 7 {
                return None;
            }
            Some(GitCommitSummary {
                oid: fields[0].to_string(),
                short_oid: fields[1].to_string(),
                author_name: fields[2].to_string(),
                author_email: fields[3].to_string(),
                authored_at: fields[4].to_string(),
                message: fields[5].to_string(),
                parents: fields[6].split_whitespace().map(str::to_string).collect(),
                refs: fields[7]
                    .split(", ")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
                    .collect(),
            })
        })
        .collect()
}

pub fn git_history(path: String, limit: Option<usize>) -> Result<Vec<GitCommitSummary>, String> {
    let root = project_root(&path, false)?;
    let head = git_output(&root, &["rev-parse", "--verify", "--quiet", "HEAD"])?;
    if !head.status.success() {
        return Ok(vec![]);
    }
    let max_count = limit.unwrap_or(35).clamp(1, 100).to_string();
    let output = require_success(
        git_output(
            &root,
            &[
                "log",
                "--no-show-signature",
                "--decorate=short",
                "--date=iso-strict",
                &format!("--max-count={max_count}"),
                "--pretty=format:%H%x00%h%x00%an%x00%ae%x00%aI%x00%s%x00%P%x00%D%x1e",
                "HEAD",
                "--",
            ],
        )?,
        "Git history",
    )?;
    Ok(parse_git_history(&output.stdout))
}

fn valid_commit_oid(oid: &str) -> bool {
    matches!(oid.len(), 40 | 64) && oid.bytes().all(|byte| byte.is_ascii_hexdigit())
}

pub fn git_commit_patch(path: String, oid: String) -> Result<GitCommitPatch, String> {
    let root = project_root(&path, false)?;
    let oid = oid.trim().to_ascii_lowercase();
    if !valid_commit_oid(&oid) {
        return Err("Choose a full Git commit identifier from history.".into());
    }
    let commit_object = format!("{oid}^{{commit}}");
    require_success(
        git_output(&root, &["cat-file", "-e", &commit_object])?,
        "Resolve Git commit",
    )?;
    let output = require_success(
        git_output(
            &root,
            &[
                "show",
                "--no-ext-diff",
                "--no-color",
                "--format=fuller",
                "--stat",
                "--patch",
                "--find-renames",
                "--find-copies",
                "--unified=3",
                &oid,
                "--",
            ],
        )?,
        "Read Git commit",
    )?;
    Ok(GitCommitPatch {
        oid,
        patch: output_text(&output.stdout),
    })
}

pub fn git_commit(input: GitCommitInput) -> Result<GitOperationOutput, String> {
    if input.message.trim().is_empty() {
        return Err("Enter a commit message.".into());
    }
    let root = project_root(&input.path, false)?;
    let mut command = Command::new("git");
    command.arg("-C").arg(&root);
    if !input.author_name.trim().is_empty() {
        command.args(["-c", &format!("user.name={}", input.author_name.trim())]);
    }
    if !input.author_email.trim().is_empty() {
        command.args(["-c", &format!("user.email={}", input.author_email.trim())]);
    }
    let output = command
        .args(["commit", "-m", input.message.trim()])
        .output()
        .map_err(|error| error.to_string())?;
    operation(&root, output, "Commit", false)
}

pub fn git_checkout(
    path: String,
    branch: String,
    create: bool,
) -> Result<GitOperationOutput, String> {
    if branch.trim().is_empty() {
        return Err("Enter a branch name.".into());
    }
    let root = project_root(&path, false)?;
    require_success(
        git_output(&root, &["check-ref-format", "--branch", branch.trim()])?,
        "Validate branch name",
    )?;
    let args = if create {
        vec!["checkout", "-b", branch.trim()]
    } else {
        vec!["checkout", branch.trim()]
    };
    let output = git_output(&root, &args)?;
    operation(
        &root,
        output,
        if create {
            "Create branch"
        } else {
            "Switch branch"
        },
        false,
    )
}

pub fn git_delete_branch(path: String, branch: String) -> Result<GitOperationOutput, String> {
    if branch.trim().is_empty() {
        return Err("Choose a local branch to delete.".into());
    }
    let root = project_root(&path, false)?;
    let branch = branch.trim();
    require_success(
        git_output(&root, &["check-ref-format", "--branch", branch])?,
        "Validate branch name",
    )?;
    let status = git_status(root.to_string_lossy().into_owned())?;
    if status.branch == branch {
        return Err("Switch branches before deleting the current branch.".into());
    }
    if !status.branches.iter().any(|candidate| candidate == branch) {
        return Err(format!("Local branch '{branch}' does not exist."));
    }
    let output = git_output(&root, &["branch", "-d", "--", branch])?;
    operation(&root, output, "Delete local branch", false)
}

fn require_remote(root: &Path, name: &str) -> Result<String, String> {
    let name = if name.trim().is_empty() {
        "origin"
    } else {
        name.trim()
    };
    if name.starts_with('-') || !list_remotes(root).iter().any(|remote| remote.name == name) {
        return Err(format!("Git remote '{name}' does not exist."));
    }
    Ok(name.to_string())
}

fn remote_url(root: &Path, name: &str, push: bool) -> Result<String, String> {
    let remote = list_remotes(root)
        .into_iter()
        .find(|remote| remote.name == name)
        .ok_or_else(|| format!("Git remote '{name}' does not exist."))?;
    let url = if push && !remote.push_url.is_empty() {
        remote.push_url
    } else {
        remote.fetch_url
    };
    if url.is_empty() {
        return Err(format!("Git remote '{name}' has no usable URL."));
    }
    Ok(url)
}

#[cfg(test)]
pub fn git_fetch(path: String, remote: String) -> Result<GitOperationOutput, String> {
    git_fetch_authenticated(path, remote, None)
}

pub fn git_fetch_authenticated(
    path: String,
    remote: String,
    credential: Option<GitCredentialInput>,
) -> Result<GitOperationOutput, String> {
    let root = project_root(&path, false)?;
    let remote = require_remote(&root, &remote)?;
    let url = remote_url(&root, &remote, false)?;
    let output = authenticated_git_output(
        Some(&root),
        &url,
        credential.as_ref(),
        &["fetch", "--prune", "--no-tags", "--", &remote],
    )?;
    operation(&root, output, "Fetch", false)
}

#[cfg(test)]
pub fn git_checkout_remote(
    path: String,
    remote: String,
    branch: String,
) -> Result<GitOperationOutput, String> {
    git_checkout_remote_authenticated(path, remote, branch, None)
}

pub fn git_checkout_remote_authenticated(
    path: String,
    remote: String,
    branch: String,
    credential: Option<GitCredentialInput>,
) -> Result<GitOperationOutput, String> {
    if branch.trim().is_empty() {
        return Err("Choose a remote branch to check out.".into());
    }
    let root = project_root(&path, false)?;
    let remote = require_remote(&root, &remote)?;
    let url = remote_url(&root, &remote, false)?;
    let branch = branch.trim();
    require_success(
        git_output(&root, &["check-ref-format", "--branch", branch])?,
        "Validate branch name",
    )?;
    if list_branches(&root)
        .iter()
        .any(|candidate| candidate == branch)
    {
        return Err(format!(
            "Local branch '{branch}' already exists. Switch to it from Local Branches."
        ));
    }
    require_success(
        authenticated_git_output(
            Some(&root),
            &url,
            credential.as_ref(),
            &["fetch", "--no-tags", "--", &remote, branch],
        )?,
        "Fetch remote branch",
    )?;
    let tracking_ref = format!("{remote}/{branch}");
    let full_tracking_ref = format!("refs/remotes/{tracking_ref}");
    require_success(
        git_output(
            &root,
            &["show-ref", "--verify", "--quiet", &full_tracking_ref],
        )?,
        "Resolve remote branch",
    )?;
    let output = git_output(&root, &["checkout", "--track", "-b", branch, &tracking_ref])?;
    operation(&root, output, "Fetch and checkout remote branch", false)
}

pub fn git_set_remote(path: String, name: String, url: String) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    let name = if name.trim().is_empty() {
        "origin"
    } else {
        name.trim()
    };
    if url.trim().is_empty() {
        return Err("Enter a remote URL.".into());
    }
    if name.starts_with('-')
        || !name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_.".contains(character))
    {
        return Err("The remote name contains unsupported characters.".into());
    }
    if url.trim().starts_with('-') {
        return Err("The remote URL cannot begin with a hyphen.".into());
    }
    let exists = list_remotes(&root).iter().any(|remote| remote.name == name);
    let args = if exists {
        vec!["remote", "set-url", name, url.trim()]
    } else {
        vec!["remote", "add", name, url.trim()]
    };
    require_success(git_output(&root, &args)?, "Set Git remote")?;
    git_status(root.to_string_lossy().into_owned())
}

pub fn git_pull_authenticated(
    input: GitPushPullInput,
    credential: Option<GitCredentialInput>,
) -> Result<GitOperationOutput, String> {
    let root = project_root(&input.path, false)?;
    let remote = if input.remote.trim().is_empty() {
        "origin"
    } else {
        input.remote.trim()
    };
    if !list_remotes(&root)
        .iter()
        .any(|candidate| candidate.name == remote)
    {
        return Err(format!("Git remote '{remote}' does not exist."));
    }
    let url = remote_url(&root, remote, false)?;
    let mut args = vec!["pull", "--no-rebase", "--no-edit", remote];
    if !input.branch.trim().is_empty() {
        require_success(
            git_output(
                &root,
                &["check-ref-format", "--branch", input.branch.trim()],
            )?,
            "Validate branch name",
        )?;
        args.push(input.branch.trim());
    }
    let output = authenticated_git_output(Some(&root), &url, credential.as_ref(), &args)?;
    operation(&root, output, "Pull", true)
}

#[cfg(test)]
pub fn git_push(input: GitPushPullInput) -> Result<GitOperationOutput, String> {
    git_push_authenticated(input, None)
}

pub fn git_push_authenticated(
    input: GitPushPullInput,
    credential: Option<GitCredentialInput>,
) -> Result<GitOperationOutput, String> {
    let root = project_root(&input.path, false)?;
    let remote = if input.remote.trim().is_empty() {
        "origin"
    } else {
        input.remote.trim()
    };
    if !list_remotes(&root)
        .iter()
        .any(|candidate| candidate.name == remote)
    {
        return Err(format!("Git remote '{remote}' does not exist."));
    }
    let url = remote_url(&root, remote, true)?;
    let branch = if input.branch.trim().is_empty() {
        git_status(input.path.clone())?.branch
    } else {
        input.branch.trim().into()
    };
    require_success(
        git_output(&root, &["check-ref-format", "--branch", &branch])?,
        "Validate branch name",
    )?;
    let status = git_status(input.path.clone())?;
    let tracks_remote = status
        .upstream
        .strip_prefix(remote)
        .is_some_and(|tail| tail.starts_with('/') && tail.len() > 1);
    if branch == status.branch && !status.can_push && (status.upstream.is_empty() || tracks_remote)
    {
        return Err("Nothing to push from the current branch.".into());
    }
    let output = authenticated_git_output(
        Some(&root),
        &url,
        credential.as_ref(),
        &["push", "-u", remote, &branch],
    )?;
    if !output.status.success() {
        return Err(push_error(&output));
    }
    operation(&root, output, "Push", false)
}

#[cfg(test)]
pub fn git_validate_remote_access(path: String, remote: String) -> Result<(), String> {
    git_validate_remote_access_authenticated(path, remote, None)
}

pub fn git_validate_remote_access_authenticated(
    path: String,
    remote: String,
    credential: Option<GitCredentialInput>,
) -> Result<(), String> {
    let root = project_root(&path, false)?;
    let remote = if remote.trim().is_empty() {
        "origin"
    } else {
        remote.trim()
    };
    if !list_remotes(&root)
        .iter()
        .any(|candidate| candidate.name == remote)
    {
        return Err(format!("Git remote '{remote}' does not exist."));
    }
    let url = remote_url(&root, remote, false)?;
    require_success(
        authenticated_git_output(
            Some(&root),
            &url,
            credential.as_ref(),
            &["ls-remote", "--heads", "--", remote],
        )?,
        "Validate Git remote access",
    )?;
    Ok(())
}

pub fn git_merge(path: String, branch: String) -> Result<GitOperationOutput, String> {
    if branch.trim().is_empty() {
        return Err("Choose a branch to merge.".into());
    }
    let root = project_root(&path, false)?;
    if !list_branches(&root)
        .iter()
        .any(|candidate| candidate == branch.trim())
    {
        return Err("Choose an existing local branch to merge.".into());
    }
    let status = git_status(path.clone())?;
    if status.merge_in_progress || status.rebase_in_progress {
        return Err(
            "Finish or abort the current merge or rebase before starting another merge.".into(),
        );
    }
    if !status.files.is_empty() {
        return Err(
            "Commit or discard all staged and unstaged changes before merging another branch."
                .into(),
        );
    }
    let output = git_output(&root, &["merge", "--no-commit", "--no-ff", branch.trim()])?;
    operation(&root, output, "Merge", true)
}

pub fn git_abort_merge(path: String) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    require_success(git_output(&root, &["merge", "--abort"])?, "Abort merge")?;
    git_status(root.to_string_lossy().into_owned())
}

fn stage_text(root: &Path, stage: &str, path: &str) -> (String, bool) {
    let specification = format!(":{stage}:{path}");
    match git_output(root, &["show", &specification]) {
        Ok(output) if output.status.success() => match String::from_utf8(output.stdout) {
            Ok(value) => (value, false),
            Err(_) => (String::new(), true),
        },
        _ => (String::new(), false),
    }
}

pub fn git_conflicts(path: String) -> Result<Vec<GitConflict>, String> {
    let root = project_root(&path, false)?;
    let output = git_output(&root, &["diff", "--name-only", "--diff-filter=U", "-z"])?;
    if !output.status.success() {
        return Ok(vec![]);
    }
    output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
        .map(|bytes| {
            let path = String::from_utf8_lossy(bytes).into_owned();
            safe_relative(&path)?;
            let (base, base_binary) = stage_text(&root, "1", &path);
            let (ours, ours_binary) = stage_text(&root, "2", &path);
            let (theirs, theirs_binary) = stage_text(&root, "3", &path);
            let working_bytes = fs::read(root.join(&path)).unwrap_or_default();
            let (working, working_binary) = match String::from_utf8(working_bytes) {
                Ok(value) => (value, false),
                Err(_) => (String::new(), true),
            };
            Ok(GitConflict {
                path,
                base,
                ours,
                theirs,
                working,
                binary: base_binary || ours_binary || theirs_binary || working_binary,
            })
        })
        .collect()
}

pub fn git_resolve_conflict(
    path: String,
    file: String,
    contents: String,
) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    let relative = safe_relative(&file)?;
    if !git_conflicts(path.clone())?
        .iter()
        .any(|conflict| conflict.path == file)
    {
        return Err("The selected file is not an active Git conflict.".into());
    }
    let target = root.join(&relative);
    let parent = target
        .parent()
        .ok_or_else(|| "The conflict path has no parent directory.".to_string())?;
    confined_existing(parent, &root)?;
    atomic_write(&target, contents.as_bytes())?;
    require_success(
        git_output(&root, &["add", "--", &file])?,
        "Stage conflict resolution",
    )?;
    git_status(root.to_string_lossy().into_owned())
}

pub fn git_resolve_conflict_side(
    path: String,
    file: String,
    side: String,
) -> Result<GitStatusOutput, String> {
    let root = project_root(&path, false)?;
    safe_relative(&file)?;
    if !git_conflicts(path.clone())?
        .iter()
        .any(|conflict| conflict.path == file)
    {
        return Err("The selected file is not an active Git conflict.".into());
    }
    let stage = match side.as_str() {
        "ours" => "2",
        "theirs" => "3",
        _ => return Err("Choose either the ours or theirs conflict side.".into()),
    };
    let exists_on_side = git_output(&root, &["cat-file", "-e", &format!(":{stage}:{file}")])?
        .status
        .success();
    if exists_on_side {
        require_success(
            git_output(&root, &["checkout", &format!("--{side}"), "--", &file])?,
            "Choose conflict side",
        )?;
        require_success(
            git_output(&root, &["add", "--", &file])?,
            "Stage conflict resolution",
        )?;
    } else {
        require_success(
            git_output(&root, &["rm", "-f", "--", &file])?,
            "Resolve deleted conflict side",
        )?;
    }
    git_status(root.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git(root: &Path, args: &[&str]) {
        let output = git_output(root, args).unwrap();
        assert!(output.status.success(), "{}", output_text(&output.stderr));
    }

    #[test]
    fn parses_dotted_and_initial_branch_names() {
        assert_eq!(
            parse_branch_header("## release.1...origin/release.1 [ahead 2]").0,
            "release.1"
        );
        assert_eq!(parse_branch_header("## No commits yet on main").0, "main");
    }

    #[test]
    fn scopes_provider_credentials_to_the_expected_remote_host() {
        let github = GitCredentialInput {
            provider: "github".into(),
            username: String::new(),
            token: "github-secret".into(),
        };
        assert_eq!(
            git_auth("https://github.com/acme/orders.git", &github).unwrap(),
            (
                "https://github.com".into(),
                "github-secret".into(),
                "x-oauth-basic".into()
            )
        );
        assert!(git_auth("https://git.example.com/acme/orders.git", &github)
            .unwrap_err()
            .contains("only be sent"));
        let custom = GitCredentialInput {
            provider: "custom".into(),
            username: "developer".into(),
            token: "custom-secret".into(),
        };
        let command = authenticated_git_command(
            None,
            "https://git.example.com/acme/orders.git",
            Some(&custom),
        )
        .unwrap();
        let arguments = command
            .get_args()
            .map(|argument| argument.to_string_lossy())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(!arguments.contains("developer"));
        assert!(!arguments.contains("custom-secret"));
        assert!(arguments.contains("credential.https://git.example.com.helper"));
    }

    #[test]
    fn parses_remote_head_and_sorted_branches() {
        let (default_branch, branches) = parse_remote_refs(
            "ref: refs/heads/release\tHEAD\nabc\trefs/heads/release\ndef\trefs/heads/feature/api\n",
        );
        assert_eq!(default_branch, "release");
        assert_eq!(branches, vec!["feature/api", "release"]);
    }

    #[test]
    fn probes_a_selected_remote_branch_without_a_worktree_checkout() {
        let remote = tempfile::tempdir().unwrap();
        git(remote.path(), &["init", "--bare", "-b", "main"]);
        let source = tempfile::tempdir().unwrap();
        git(source.path(), &["init", "-b", "main"]);
        git(source.path(), &["config", "user.name", "Probe Test"]);
        git(
            source.path(),
            &["config", "user.email", "probe@example.com"],
        );
        fs::create_dir_all(source.path().join(".brunomnia")).unwrap();
        fs::create_dir_all(source.path().join(".insomnia/Request")).unwrap();
        fs::write(
            source.path().join(".brunomnia/project.yaml"),
            "name: Probe\n",
        )
        .unwrap();
        fs::write(
            source.path().join(".insomnia/Request/request.yml"),
            "name: Request\n",
        )
        .unwrap();
        fs::write(source.path().join("openapi.yaml"), "openapi: 3.0.0\n").unwrap();
        git(source.path(), &["add", "."]);
        git(source.path(), &["commit", "-m", "probe files"]);
        let remote_path = remote.path().to_string_lossy().into_owned();
        git(source.path(), &["remote", "add", "origin", &remote_path]);
        git(source.path(), &["push", "-u", "origin", "main"]);

        let branches = git_repository_probe(remote_path.clone(), None, None).unwrap();
        assert_eq!(branches.default_branch, "main");
        assert_eq!(branches.branches, vec!["main"]);
        assert_eq!(branches.total_files, 0);

        let scan = git_repository_probe(remote_path, Some("main".into()), None).unwrap();
        assert_eq!(scan.total_files, 3);
        assert_eq!(scan.brunomnia_files, 1);
        assert_eq!(scan.insomnia_files, 1);
        assert_eq!(scan.specification_files, 1);
        assert!(!scan.truncated);
    }

    #[test]
    fn writes_and_reads_split_yaml_without_touching_unmanaged_files() {
        let temporary = tempfile::tempdir().unwrap();
        fs::write(temporary.path().join("README.md"), "keep me").unwrap();
        let workspace = serde_json::json!({
            "format": "brunomnia", "version": 11, "name": "Example", "activeRequestId": "request", "activeEnvironmentId": "env",
            "collections": [{"id":"collection", "name":"Orders", "expanded":true, "requests":[]}],
            "environments": [{"id":"env", "name":"Development", "variables":[]}],
            "apiDesigns": [], "mockServers": [],
            "mcpClients": [{"id":"mcp-one", "name":"Tools", "enabled":false, "transport":"stdio", "url":"", "command":"/usr/bin/tools", "args":[], "env":[{"id":"env-one", "name":"MODE", "value":"review", "enabled":true}], "headers":[], "authType":"none", "token":"", "username":"", "password":"", "roots":[], "tools":[], "prompts":[], "resources":[], "resourceTemplates":[]}]
        });
        let first = write_project(ProjectWriteInput {
            path: temporary.path().to_string_lossy().into_owned(),
            workspace,
        })
        .unwrap();
        assert!(first.files_written >= 4);
        let loaded = read_project(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(loaded["collections"][0]["name"], "Orders");
        assert_eq!(loaded["mcpClients"][0]["name"], "Tools");
        assert_eq!(loaded["mcpClients"][0]["env"][0]["value"], "review");
        assert_eq!(
            fs::read_to_string(temporary.path().join("README.md")).unwrap(),
            "keep me"
        );
    }

    #[cfg(unix)]
    #[test]
    fn refuses_managed_directories_that_escape_through_symlinks() {
        use std::os::unix::fs::symlink;

        let temporary = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        symlink(external.path(), temporary.path().join("collections")).unwrap();
        let workspace = serde_json::json!({
            "format": "brunomnia", "version": 11, "name": "Unsafe", "activeRequestId": "", "activeEnvironmentId": "",
            "collections": [{"id":"collection", "name":"Orders", "expanded":true, "requests":[]}],
            "environments": [], "apiDesigns": [], "mockServers": []
        });
        let error = write_project(ProjectWriteInput {
            path: temporary.path().to_string_lossy().into_owned(),
            workspace,
        })
        .unwrap_err();
        assert!(error.contains("symlink"));
        assert!(fs::read_dir(external.path()).unwrap().next().is_none());
    }

    #[test]
    fn reports_and_resolves_three_way_conflicts_without_discarding_versions() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Test"]);
        git(root, &["config", "user.email", "test@example.com"]);
        fs::write(root.join("request.yaml"), "value: base\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "base"]);
        git(root, &["checkout", "-b", "feature"]);
        fs::write(root.join("request.yaml"), "value: feature\n").unwrap();
        git(root, &["commit", "-am", "feature"]);
        git(root, &["checkout", "main"]);
        fs::write(root.join("request.yaml"), "value: main\n").unwrap();
        git(root, &["commit", "-am", "main"]);
        let merge = git_merge(root.to_string_lossy().into_owned(), "feature".into()).unwrap();
        assert!(merge.status.merge_in_progress);
        let conflicts = git_conflicts(root.to_string_lossy().into_owned()).unwrap();
        assert_eq!(conflicts.len(), 1);
        assert!(conflicts[0].base.contains("base"));
        assert!(conflicts[0].ours.contains("main"));
        assert!(conflicts[0].theirs.contains("feature"));
        let status = git_resolve_conflict(
            root.to_string_lossy().into_owned(),
            "request.yaml".into(),
            "value: resolved\n".into(),
        )
        .unwrap();
        assert!(status.files.iter().all(|file| !file.conflicted));
    }

    #[test]
    fn refuses_branch_merges_with_staged_or_unstaged_work() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Merge Guard Test"]);
        git(root, &["config", "user.email", "merge-guard@example.com"]);
        fs::write(root.join("request.yaml"), "value: base\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "base request"]);
        git(root, &["checkout", "-b", "feature"]);
        fs::write(root.join("feature.yaml"), "feature: true\n").unwrap();
        git(root, &["add", "feature.yaml"]);
        git(root, &["commit", "-m", "feature request"]);
        git(root, &["checkout", "main"]);

        fs::write(root.join("request.yaml"), "value: local\n").unwrap();
        let unstaged_error =
            git_merge(root.to_string_lossy().into_owned(), "feature".into()).unwrap_err();
        assert!(unstaged_error.contains("Commit or discard"));
        assert_eq!(
            fs::read_to_string(root.join("request.yaml")).unwrap(),
            "value: local\n"
        );
        assert!(!root.join(".git/MERGE_HEAD").exists());

        git(root, &["add", "request.yaml"]);
        let staged_error =
            git_merge(root.to_string_lossy().into_owned(), "feature".into()).unwrap_err();
        assert!(staged_error.contains("Commit or discard"));
        assert!(git_diff(root.to_string_lossy().into_owned(), true)
            .unwrap()
            .contains("+value: local"));
        assert!(!root.join(".git/MERGE_HEAD").exists());
    }

    #[test]
    fn lists_bounded_commit_history_and_reads_a_validated_patch() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "History Test"]);
        git(root, &["config", "user.email", "history@example.com"]);
        fs::write(root.join("request.yaml"), "value: one\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "first request"]);
        fs::write(root.join("request.yaml"), "value: two\n").unwrap();
        git(root, &["commit", "-am", "second request"]);

        let history = git_history(root.to_string_lossy().into_owned(), Some(1)).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].message, "second request");
        assert_eq!(history[0].author_name, "History Test");
        assert_eq!(history[0].author_email, "history@example.com");
        assert_eq!(history[0].parents.len(), 1);
        assert!(history[0]
            .refs
            .iter()
            .any(|reference| reference.contains("main")));

        let patch =
            git_commit_patch(root.to_string_lossy().into_owned(), history[0].oid.clone()).unwrap();
        assert_eq!(patch.oid, history[0].oid);
        assert!(patch.patch.contains("second request"));
        assert!(patch.patch.contains("-value: one"));
        assert!(patch.patch.contains("+value: two"));
        assert!(git_commit_patch(
            root.to_string_lossy().into_owned(),
            "HEAD; touch escaped".into(),
        )
        .unwrap_err()
        .contains("full Git commit identifier"));
    }

    #[test]
    fn returns_empty_history_for_an_unborn_repository() {
        let temporary = tempfile::tempdir().unwrap();
        git(temporary.path(), &["init", "-b", "main"]);
        assert!(
            git_history(temporary.path().to_string_lossy().into_owned(), None,)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn fetches_remote_branches_and_checks_out_an_explicit_tracking_branch() {
        let remote = tempfile::tempdir().unwrap();
        git(remote.path(), &["init", "--bare", "-b", "main"]);

        let source = tempfile::tempdir().unwrap();
        git(source.path(), &["init", "-b", "main"]);
        git(source.path(), &["config", "user.name", "Remote Test"]);
        git(
            source.path(),
            &["config", "user.email", "remote@example.com"],
        );
        fs::write(source.path().join("request.yaml"), "value: main\n").unwrap();
        git(source.path(), &["add", "request.yaml"]);
        git(source.path(), &["commit", "-m", "main request"]);
        let remote_path = remote.path().to_string_lossy().into_owned();
        git(source.path(), &["remote", "add", "origin", &remote_path]);
        git(source.path(), &["push", "-u", "origin", "main"]);

        let clone_parent = tempfile::tempdir().unwrap();
        let clone_path = clone_parent.path().join("project");
        git_clone(remote_path, clone_path.to_string_lossy().into_owned()).unwrap();

        git(source.path(), &["checkout", "-b", "feature/remote"]);
        fs::write(source.path().join("request.yaml"), "value: remote\n").unwrap();
        git(source.path(), &["commit", "-am", "remote request"]);
        git(source.path(), &["push", "-u", "origin", "feature/remote"]);
        git(source.path(), &["checkout", "-b", "stale"]);
        git(source.path(), &["push", "-u", "origin", "stale"]);
        git(source.path(), &["checkout", "feature/remote"]);

        let mut fetched = git_fetch(clone_path.to_string_lossy().into_owned(), "origin".into())
            .unwrap()
            .status;
        assert!(fetched.remote_branches.iter().any(|branch| {
            branch.remote == "origin"
                && branch.branch == "feature/remote"
                && branch.tracking_ref == "origin/feature/remote"
        }));
        assert!(fetched
            .remote_branches
            .iter()
            .all(|branch| branch.branch != "HEAD"));
        assert!(fetched
            .remote_branches
            .iter()
            .any(|branch| branch.branch == "stale"));
        git(source.path(), &["push", "origin", "--delete", "stale"]);
        fetched = git_fetch(clone_path.to_string_lossy().into_owned(), "origin".into())
            .unwrap()
            .status;
        assert!(fetched
            .remote_branches
            .iter()
            .all(|branch| branch.branch != "stale"));

        let checked_out = git_checkout_remote(
            clone_path.to_string_lossy().into_owned(),
            "origin".into(),
            "feature/remote".into(),
        )
        .unwrap();
        assert_eq!(checked_out.status.branch, "feature/remote");
        assert_eq!(checked_out.status.upstream, "origin/feature/remote");
        assert!(git_checkout_remote(
            clone_path.to_string_lossy().into_owned(),
            "origin".into(),
            "feature/remote".into(),
        )
        .unwrap_err()
        .contains("already exists"));
        assert!(git_fetch(
            clone_path.to_string_lossy().into_owned(),
            "--upload-pack=unsafe".into(),
        )
        .unwrap_err()
        .contains("does not exist"));
    }

    #[test]
    fn validates_configured_remote_access_without_mutating_the_repository() {
        let remote = tempfile::tempdir().unwrap();
        git(remote.path(), &["init", "--bare", "-b", "main"]);

        let local = tempfile::tempdir().unwrap();
        let root = local.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Remote Validation Test"]);
        git(
            root,
            &["config", "user.email", "remote-validation@example.com"],
        );
        fs::write(root.join("request.yaml"), "value: local\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "local request"]);
        let remote_path = remote.path().to_string_lossy().into_owned();
        git(root, &["remote", "add", "origin", &remote_path]);

        let head_before =
            require_success(git_output(root, &["rev-parse", "HEAD"]).unwrap(), "HEAD")
                .map(|output| output_text(&output.stdout))
                .unwrap();
        git_validate_remote_access(root.to_string_lossy().into_owned(), "origin".into()).unwrap();
        assert_eq!(
            require_success(git_output(root, &["rev-parse", "HEAD"]).unwrap(), "HEAD")
                .map(|output| output_text(&output.stdout))
                .unwrap(),
            head_before
        );
        assert!(git_status(root.to_string_lossy().into_owned())
            .unwrap()
            .files
            .is_empty());
        assert!(
            git_validate_remote_access(root.to_string_lossy().into_owned(), "missing".into(),)
                .unwrap_err()
                .contains("does not exist")
        );
    }

    #[test]
    fn reports_when_the_current_branch_has_a_tip_ready_to_push() {
        let remote = tempfile::tempdir().unwrap();
        git(remote.path(), &["init", "--bare", "-b", "main"]);

        let local = tempfile::tempdir().unwrap();
        let root = local.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Push Readiness Test"]);
        git(root, &["config", "user.email", "push-ready@example.com"]);
        fs::write(root.join("request.yaml"), "value: one\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "first request"]);
        assert!(
            !git_status(root.to_string_lossy().into_owned())
                .unwrap()
                .can_push
        );

        let remote_path = remote.path().to_string_lossy().into_owned();
        git(root, &["remote", "add", "origin", &remote_path]);
        assert!(
            git_status(root.to_string_lossy().into_owned())
                .unwrap()
                .can_push
        );
        git(root, &["push", "-u", "origin", "main"]);
        assert!(
            !git_status(root.to_string_lossy().into_owned())
                .unwrap()
                .can_push
        );

        fs::write(root.join("request.yaml"), "value: two\n").unwrap();
        git(root, &["commit", "-am", "second request"]);
        let status = git_status(root.to_string_lossy().into_owned()).unwrap();
        assert_eq!(status.ahead, 1);
        assert!(status.can_push);
        let pushed = git_push(GitPushPullInput {
            path: root.to_string_lossy().into_owned(),
            remote: "origin".into(),
            branch: "main".into(),
        })
        .unwrap();
        assert!(!pushed.status.can_push);
        assert!(git_push(GitPushPullInput {
            path: root.to_string_lossy().into_owned(),
            remote: "origin".into(),
            branch: "main".into(),
        })
        .unwrap_err()
        .contains("Nothing to push"));
    }

    #[test]
    fn explains_non_fast_forward_push_rejections_without_rewriting_local_work() {
        let remote = tempfile::tempdir().unwrap();
        git(remote.path(), &["init", "--bare", "-b", "main"]);

        let primary = tempfile::tempdir().unwrap();
        let root = primary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Primary Push Test"]);
        git(root, &["config", "user.email", "primary-push@example.com"]);
        fs::write(root.join("request.yaml"), "value: base\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "base request"]);
        let remote_path = remote.path().to_string_lossy().into_owned();
        git(root, &["remote", "add", "origin", &remote_path]);
        git(root, &["push", "-u", "origin", "main"]);

        let secondary_parent = tempfile::tempdir().unwrap();
        let secondary = secondary_parent.path().join("secondary");
        git(
            secondary_parent.path(),
            &["clone", &remote_path, secondary.to_string_lossy().as_ref()],
        );
        git(&secondary, &["config", "user.name", "Secondary Push Test"]);
        git(
            &secondary,
            &["config", "user.email", "secondary-push@example.com"],
        );
        fs::write(secondary.join("remote.yaml"), "remote: newer\n").unwrap();
        git(&secondary, &["add", "remote.yaml"]);
        git(&secondary, &["commit", "-m", "remote request"]);
        git(&secondary, &["push", "origin", "main"]);

        fs::write(root.join("local.yaml"), "local: pending\n").unwrap();
        git(root, &["add", "local.yaml"]);
        git(root, &["commit", "-m", "local request"]);
        let error = git_push(GitPushPullInput {
            path: root.to_string_lossy().into_owned(),
            remote: "origin".into(),
            branch: "main".into(),
        })
        .unwrap_err();
        assert!(error.contains("remote branch has newer commits"));
        assert!(error.contains("Pull and resolve"));
        assert_eq!(
            output_text(
                &require_success(
                    git_output(root, &["log", "-1", "--format=%s"]).unwrap(),
                    "Read local tip",
                )
                .unwrap()
                .stdout,
            ),
            "local request"
        );
        assert!(
            git_status(root.to_string_lossy().into_owned())
                .unwrap()
                .can_push
        );
    }

    #[test]
    fn deletes_only_existing_non_current_fully_merged_local_branches() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Branch Test"]);
        git(root, &["config", "user.email", "branch@example.com"]);
        fs::write(root.join("request.yaml"), "value: main\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "main request"]);

        git(root, &["checkout", "-b", "merged"]);
        fs::write(root.join("request.yaml"), "value: merged\n").unwrap();
        git(root, &["commit", "-am", "merged request"]);
        assert!(
            git_delete_branch(root.to_string_lossy().into_owned(), "merged".into(),)
                .unwrap_err()
                .contains("current branch")
        );
        git(root, &["checkout", "main"]);
        git(root, &["merge", "--ff-only", "merged"]);
        let deleted =
            git_delete_branch(root.to_string_lossy().into_owned(), "merged".into()).unwrap();
        assert!(!deleted
            .status
            .branches
            .iter()
            .any(|branch| branch == "merged"));

        git(root, &["checkout", "-b", "unmerged"]);
        fs::write(root.join("request.yaml"), "value: unmerged\n").unwrap();
        git(root, &["commit", "-am", "unmerged request"]);
        git(root, &["checkout", "main"]);
        assert!(
            git_delete_branch(root.to_string_lossy().into_owned(), "unmerged".into(),).is_err()
        );
        assert!(git_status(root.to_string_lossy().into_owned())
            .unwrap()
            .branches
            .iter()
            .any(|branch| branch == "unmerged"));
        assert!(git_delete_branch(root.to_string_lossy().into_owned(), "--force".into(),).is_err());
    }

    #[test]
    fn discards_only_selected_unstaged_changes_and_preserves_the_index() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Discard Test"]);
        git(root, &["config", "user.email", "discard@example.com"]);
        fs::write(root.join("request.yaml"), "value: base\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "base request"]);

        fs::write(root.join("request.yaml"), "value: staged\n").unwrap();
        git(root, &["add", "request.yaml"]);
        fs::write(root.join("request.yaml"), "value: working\n").unwrap();
        fs::write(root.join("temporary.yaml"), "temporary: true\n").unwrap();

        let status = git_discard(
            root.to_string_lossy().into_owned(),
            vec!["request.yaml".into(), "temporary.yaml".into()],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(root.join("request.yaml")).unwrap(),
            "value: staged\n"
        );
        assert!(!root.join("temporary.yaml").exists());
        assert!(status.files.iter().any(|file| {
            file.path == "request.yaml" && file.index_status == "M" && file.worktree_status == " "
        }));
        assert!(git_diff(root.to_string_lossy().into_owned(), false)
            .unwrap()
            .is_empty());
        assert!(git_diff(root.to_string_lossy().into_owned(), true)
            .unwrap()
            .contains("+value: staged"));
        assert!(git_discard(
            root.to_string_lossy().into_owned(),
            vec!["request.yaml".into()],
        )
        .unwrap_err()
        .contains("no unstaged Git change"));
        assert!(git_discard(
            root.to_string_lossy().into_owned(),
            vec!["../outside.yaml".into()],
        )
        .unwrap_err()
        .contains("Unsafe project-relative path"));
    }

    #[test]
    fn stages_and_unstages_multiple_files_as_one_selection() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Bulk Stage Test"]);
        git(root, &["config", "user.email", "bulk-stage@example.com"]);
        fs::write(root.join("first.yaml"), "value: first base\n").unwrap();
        fs::write(root.join("second.yaml"), "value: second base\n").unwrap();
        git(root, &["add", "first.yaml", "second.yaml"]);
        git(root, &["commit", "-m", "base files"]);

        fs::write(root.join("first.yaml"), "value: first working\n").unwrap();
        fs::write(root.join("second.yaml"), "value: second working\n").unwrap();
        let staged = git_stage(
            root.to_string_lossy().into_owned(),
            vec!["first.yaml".into(), "second.yaml".into()],
        )
        .unwrap();
        assert!(staged.files.iter().all(|file| file.staged));
        let staged_diff = git_diff(root.to_string_lossy().into_owned(), true).unwrap();
        assert!(staged_diff.contains("+value: first working"));
        assert!(staged_diff.contains("+value: second working"));

        let unstaged = git_unstage(
            root.to_string_lossy().into_owned(),
            vec!["first.yaml".into(), "second.yaml".into()],
        )
        .unwrap();
        assert!(unstaged.files.iter().all(|file| !file.staged));
        assert!(git_diff(root.to_string_lossy().into_owned(), true)
            .unwrap()
            .is_empty());
        let working_diff = git_diff(root.to_string_lossy().into_owned(), false).unwrap();
        assert!(working_diff.contains("+value: first working"));
        assert!(working_diff.contains("+value: second working"));
    }

    #[test]
    fn creates_ordered_commits_from_reviewed_file_groups() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Grouped Commit Test"]);
        git(
            root,
            &["config", "user.email", "grouped-commit@example.com"],
        );
        fs::write(root.join("first.yaml"), "value: first base\n").unwrap();
        fs::write(root.join("second.yaml"), "value: second base\n").unwrap();
        git(root, &["add", "first.yaml", "second.yaml"]);
        git(root, &["commit", "-m", "base files"]);

        fs::write(root.join("first.yaml"), "value: first grouped\n").unwrap();
        fs::write(root.join("second.yaml"), "value: second grouped\n").unwrap();
        git_stage(
            root.to_string_lossy().into_owned(),
            vec!["first.yaml".into(), "second.yaml".into()],
        )
        .unwrap();
        git_unstage(
            root.to_string_lossy().into_owned(),
            vec!["first.yaml".into(), "second.yaml".into()],
        )
        .unwrap();

        git_stage(
            root.to_string_lossy().into_owned(),
            vec!["first.yaml".into()],
        )
        .unwrap();
        git_commit(GitCommitInput {
            path: root.to_string_lossy().into_owned(),
            message: "feat: first group".into(),
            author_name: String::new(),
            author_email: String::new(),
        })
        .unwrap();
        git_stage(
            root.to_string_lossy().into_owned(),
            vec!["second.yaml".into()],
        )
        .unwrap();
        git_commit(GitCommitInput {
            path: root.to_string_lossy().into_owned(),
            message: "test: second group".into(),
            author_name: String::new(),
            author_email: String::new(),
        })
        .unwrap();

        let messages = output_text(
            &require_success(
                git_output(root, &["log", "-2", "--format=%s"]).unwrap(),
                "Read grouped history",
            )
            .unwrap()
            .stdout,
        );
        assert_eq!(messages, "test: second group\nfeat: first group");
        assert_eq!(
            output_text(
                &require_success(
                    git_output(root, &["show", "HEAD^:first.yaml"]).unwrap(),
                    "Read first group",
                )
                .unwrap()
                .stdout,
            ),
            "value: first grouped"
        );
        assert_eq!(
            output_text(
                &require_success(
                    git_output(root, &["show", "HEAD^:second.yaml"]).unwrap(),
                    "Read uncommitted second group",
                )
                .unwrap()
                .stdout,
            ),
            "value: second base"
        );
        assert!(git_status(root.to_string_lossy().into_owned())
            .unwrap()
            .files
            .is_empty());
    }

    #[test]
    fn returns_confined_per_file_diffs_including_untracked_text() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        git(root, &["init", "-b", "main"]);
        git(root, &["config", "user.name", "Diff Test"]);
        git(root, &["config", "user.email", "diff@example.com"]);
        fs::write(root.join("request.yaml"), "value: base\n").unwrap();
        git(root, &["add", "request.yaml"]);
        git(root, &["commit", "-m", "base request"]);

        fs::write(root.join("request.yaml"), "value: working\n").unwrap();
        fs::write(root.join("new.yaml"), "value: new\n").unwrap();
        fs::write(root.join("binary.bin"), [0xff, 0x00]).unwrap();
        let working = git_file_diff(
            root.to_string_lossy().into_owned(),
            false,
            "request.yaml".into(),
        )
        .unwrap();
        assert!(working.contains("-value: base"));
        assert!(working.contains("+value: working"));
        let untracked = git_file_diff(
            root.to_string_lossy().into_owned(),
            false,
            "new.yaml".into(),
        )
        .unwrap();
        assert!(untracked.starts_with("Untracked file: new.yaml"));
        assert!(untracked.contains("value: new"));
        assert!(git_file_diff(
            root.to_string_lossy().into_owned(),
            false,
            "binary.bin".into(),
        )
        .unwrap_err()
        .contains("binary"));

        git(root, &["add", "request.yaml"]);
        let staged = git_file_diff(
            root.to_string_lossy().into_owned(),
            true,
            "request.yaml".into(),
        )
        .unwrap();
        assert!(staged.contains("-value: base"));
        assert!(staged.contains("+value: working"));
        assert!(
            git_file_diff(root.to_string_lossy().into_owned(), true, "new.yaml".into(),)
                .unwrap_err()
                .contains("no staged Git change")
        );
        assert!(git_file_diff(
            root.to_string_lossy().into_owned(),
            false,
            "../outside.yaml".into(),
        )
        .unwrap_err()
        .contains("Unsafe project-relative path"));
    }
}
