use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
    process::{Command, Output},
};
use uuid::Uuid;

const PROJECT_FILE: &str = ".brunomnia/project.yaml";
const MANIFEST_FILE: &str = ".brunomnia/manifest.yaml";
const MAX_TEXT_OUTPUT: usize = 2_000_000;
const MANAGED_ROOTS: [&str; 6] = [
    ".brunomnia",
    "collections",
    "environments",
    "designs",
    "mocks",
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
pub struct GitStatusOutput {
    pub branch: String,
    pub upstream: String,
    pub ahead: usize,
    pub behind: usize,
    pub files: Vec<GitFileStatus>,
    pub branches: Vec<String>,
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

pub fn git_clone(remote: String, path: String) -> Result<GitStatusOutput, String> {
    if remote.trim().is_empty() {
        return Err("Enter a Git remote URL.".into());
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
    let output = Command::new("git")
        .arg("clone")
        .arg("--")
        .arg(remote.trim())
        .arg(&target)
        .output()
        .map_err(|error| format!("Unable to run Git clone: {error}"))?;
    require_success(output, "Git clone")?;
    let root = target.canonicalize().map_err(|error| error.to_string())?;
    git_status(root.to_string_lossy().into_owned())
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
    Ok(GitStatusOutput {
        branch,
        upstream,
        ahead,
        behind,
        files,
        branches: list_branches(&root),
        remotes: list_remotes(&root),
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

pub fn git_pull(input: GitPushPullInput) -> Result<GitOperationOutput, String> {
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
    let output = git_output(&root, &args)?;
    operation(&root, output, "Pull", true)
}

pub fn git_push(input: GitPushPullInput) -> Result<GitOperationOutput, String> {
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
    let branch = if input.branch.trim().is_empty() {
        git_status(input.path.clone())?.branch
    } else {
        input.branch.trim().into()
    };
    require_success(
        git_output(&root, &["check-ref-format", "--branch", &branch])?,
        "Validate branch name",
    )?;
    let output = git_output(&root, &["push", "-u", remote, &branch])?;
    operation(&root, output, "Push", false)
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
    fn writes_and_reads_split_yaml_without_touching_unmanaged_files() {
        let temporary = tempfile::tempdir().unwrap();
        fs::write(temporary.path().join("README.md"), "keep me").unwrap();
        let workspace = serde_json::json!({
            "format": "brunomnia", "version": 6, "name": "Example", "activeRequestId": "request", "activeEnvironmentId": "env",
            "collections": [{"id":"collection", "name":"Orders", "expanded":true, "requests":[]}],
            "environments": [{"id":"env", "name":"Development", "variables":[]}],
            "apiDesigns": [], "mockServers": []
        });
        let first = write_project(ProjectWriteInput {
            path: temporary.path().to_string_lossy().into_owned(),
            workspace,
        })
        .unwrap();
        assert!(first.files_written >= 4);
        let loaded = read_project(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(loaded["collections"][0]["name"], "Orders");
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
            "format": "brunomnia", "version": 6, "name": "Unsafe", "activeRequestId": "", "activeEnvironmentId": "",
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
}
