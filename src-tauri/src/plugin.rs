use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

const MAX_PLUGIN_BYTES: u64 = 1_000_000;
const MAX_PACKAGE_BYTES: u64 = 5_000_000;
const MAX_PACKAGE_FILES: usize = 500;
const MAX_PACKAGE_ENTRIES: usize = 2_000;
const MAX_PACKAGE_DEPTH: usize = 32;
const MAX_DISCOVERED_PLUGINS: usize = 100;
const MAX_DISCOVERY_ENTRIES: usize = 1_000;
const MAX_DISCOVERY_DEPTH: usize = 4;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSourceOutput {
    pub source: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub path: String,
    pub module_files: BTreeMap<String, String>,
    pub entry_module_key: String,
    pub requested_modules: Vec<String>,
    pub module_warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDiscoveryOutput {
    pub plugins: Vec<PluginSourceOutput>,
    pub warnings: Vec<String>,
}

fn source_file(path: &Path) -> Result<(PathBuf, Option<Value>, PathBuf), String> {
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to open plugin path: {error}"))?;
    if canonical.is_file() {
        return Ok((canonical.clone(), None, canonical));
    }
    if !canonical.is_dir() {
        return Err("The plugin path must be a JavaScript file or package folder.".into());
    }
    let package_path = canonical.join("package.json");
    let package_metadata = fs::metadata(&package_path)
        .map_err(|error| format!("Unable to inspect plugin package.json: {error}"))?;
    if !package_metadata.is_file() || package_metadata.len() > MAX_PLUGIN_BYTES {
        return Err("The plugin package.json must be a regular file no larger than 1 MB.".into());
    }
    let package: Value = serde_json::from_str(
        &fs::read_to_string(&package_path)
            .map_err(|error| format!("Unable to read plugin package.json: {error}"))?,
    )
    .map_err(|error| format!("Invalid plugin package.json: {error}"))?;
    let main = package
        .get("main")
        .and_then(Value::as_str)
        .unwrap_or("main.js");
    let entry = canonical
        .join(main)
        .canonicalize()
        .map_err(|error| format!("Unable to open plugin entry '{main}': {error}"))?;
    if !entry.starts_with(&canonical) {
        return Err("The plugin entry must stay inside its package folder.".into());
    }
    Ok((entry, Some(package), canonical))
}

fn module_key(root: &Path, file: &Path) -> Result<String, String> {
    file.strip_prefix(root)
        .map_err(|_| "Plugin module escaped its package root.".to_string())?
        .components()
        .map(|component| {
            component
                .as_os_str()
                .to_str()
                .map(str::to_string)
                .ok_or_else(|| "Plugin module paths must be UTF-8.".to_string())
        })
        .collect::<Result<Vec<_>, _>>()
        .map(|parts| parts.join("/"))
}

fn collect_module_files(
    root: &Path,
    folder: &Path,
    depth: usize,
    total_bytes: &mut u64,
    output: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    if depth > MAX_PACKAGE_DEPTH {
        return Err(format!(
            "Plugin package nesting exceeds {MAX_PACKAGE_DEPTH} levels."
        ));
    }
    let mut entries = fs::read_dir(folder)
        .map_err(|error| format!("Unable to read plugin package folder: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Unable to inspect plugin package folder: {error}"))?;
    if entries.len() > MAX_PACKAGE_ENTRIES {
        return Err(format!(
            "Plugin package folders may contain at most {MAX_PACKAGE_ENTRIES} entries."
        ));
    }
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Unable to inspect plugin module: {error}"))?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name == "node_modules" || name.starts_with('.') {
                continue;
            }
            collect_module_files(root, &path, depth + 1, total_bytes, output)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        let extension = path.extension().and_then(|value| value.to_str());
        if !matches!(extension, Some("js" | "json")) {
            continue;
        }
        if metadata.len() > MAX_PLUGIN_BYTES {
            return Err(format!(
                "Plugin module '{}' exceeds the 1 MB local limit.",
                path.display()
            ));
        }
        *total_bytes = total_bytes.saturating_add(metadata.len());
        if *total_bytes > MAX_PACKAGE_BYTES {
            return Err("Plugin package modules exceed the 5 MB aggregate limit.".into());
        }
        if output.len() >= MAX_PACKAGE_FILES {
            return Err(format!(
                "Plugin package contains more than {MAX_PACKAGE_FILES} JavaScript/JSON files."
            ));
        }
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("Unable to open plugin module: {error}"))?;
        if !canonical.starts_with(root) {
            return Err("Plugin module escaped its package root.".into());
        }
        let key = module_key(root, &canonical)?;
        let source = fs::read_to_string(&canonical)
            .map_err(|error| format!("Plugin modules must be UTF-8 text: {error}"))?;
        output.insert(key, source);
    }
    Ok(())
}

fn package_modules(
    entry: &Path,
    package_root: Option<&Path>,
    source: &str,
) -> Result<(BTreeMap<String, String>, String), String> {
    let Some(root) = package_root else {
        return Ok((
            BTreeMap::from([("index.js".to_string(), source.to_string())]),
            "index.js".to_string(),
        ));
    };
    let entry_module_key = module_key(root, entry)?;
    if !matches!(
        entry.extension().and_then(|value| value.to_str()),
        Some("js")
    ) {
        return Err("Plugin package entries must be JavaScript files.".into());
    }
    let mut module_files = BTreeMap::new();
    let mut total_bytes = 0;
    collect_module_files(root, root, 0, &mut total_bytes, &mut module_files)?;
    if !module_files.contains_key(&entry_module_key) {
        return Err("Plugin package entry was not included in its bounded module map.".into());
    }
    Ok((module_files, entry_module_key))
}

fn package_requested_modules(package: Option<&Value>) -> (Vec<String>, Vec<String>) {
    let Some(insomnia) = package.and_then(|value| value.get("insomnia")) else {
        return (vec![], vec![]);
    };
    let Some(permissions) = insomnia.get("permissions") else {
        return (vec![], vec![]);
    };
    let Some(permissions) = permissions.as_object() else {
        return (
            vec![],
            vec!["insomnia.permissions must be an object; ignoring module grants.".into()],
        );
    };
    let Some(modules) = permissions.get("modules") else {
        return (vec![], vec![]);
    };
    let Some(modules) = modules.as_array() else {
        return (
            vec![],
            vec!["insomnia.permissions.modules must be an array of strings; ignoring it.".into()],
        );
    };
    let mut requested = Vec::new();
    let mut warnings = Vec::new();
    for module in modules.iter().take(100) {
        let Some(module) = module.as_str().map(str::trim) else {
            warnings.push(format!(
                "Ignoring non-string insomnia.permissions.modules entry {module}."
            ));
            continue;
        };
        if module.is_empty() || module.len() > 200 || module.contains('\0') {
            warnings.push("Ignoring an empty or oversized plugin module permission.".into());
            continue;
        }
        if !requested.iter().any(|candidate| candidate == module) {
            requested.push(module.to_string());
        }
    }
    if modules.len() > 100 {
        warnings.push("Only the first 100 plugin module permissions were inspected.".into());
    }
    (requested, warnings)
}

pub fn read_plugin_source(path: String) -> Result<PluginSourceOutput, String> {
    if path.trim().is_empty() {
        return Err("Choose a plugin JavaScript file or package folder.".into());
    }
    let (entry, package, source_path) = source_file(&PathBuf::from(path.trim()))?;
    let metadata =
        fs::metadata(&entry).map_err(|error| format!("Unable to inspect plugin entry: {error}"))?;
    if !metadata.is_file() {
        return Err("The plugin entry must be a file.".into());
    }
    if metadata.len() > MAX_PLUGIN_BYTES {
        return Err("The plugin entry exceeds the 1 MB local limit.".into());
    }
    let source = fs::read_to_string(&entry)
        .map_err(|error| format!("The plugin entry must be UTF-8 JavaScript: {error}"))?;
    let (module_files, entry_module_key) = package_modules(
        &entry,
        package.as_ref().map(|_| source_path.as_path()),
        &source,
    )?;
    let (requested_modules, module_warnings) = package_requested_modules(package.as_ref());
    let fallback = entry
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Local plugin");
    let field = |name: &str, default: &str| {
        package
            .as_ref()
            .and_then(|value| value.get(name))
            .and_then(Value::as_str)
            .or_else(|| {
                package
                    .as_ref()
                    .and_then(|value| value.get("insomnia"))
                    .and_then(|value| value.get(name))
                    .and_then(Value::as_str)
            })
            .unwrap_or(default)
            .to_string()
    };
    let package_name = field("name", fallback);
    let display_name = package
        .as_ref()
        .and_then(|value| value.get("insomnia"))
        .and_then(|value| value.get("displayName"))
        .and_then(Value::as_str)
        .unwrap_or(&package_name)
        .to_string();
    Ok(PluginSourceOutput {
        source,
        name: display_name,
        version: field("version", "0.0.0-local"),
        description: field("description", "Local CommonJS plugin"),
        path: source_path.to_string_lossy().into_owned(),
        module_files,
        entry_module_key,
        requested_modules,
        module_warnings,
    })
}

fn has_insomnia_manifest(path: &Path) -> bool {
    let package_path = path.join("package.json");
    fs::metadata(&package_path)
        .ok()
        .filter(|metadata| metadata.is_file() && metadata.len() <= MAX_PLUGIN_BYTES)
        .and_then(|_| fs::read_to_string(package_path).ok())
        .and_then(|contents| serde_json::from_str::<Value>(&contents).ok())
        .and_then(|package| package.get("insomnia").cloned())
        .is_some()
}

fn add_discovery_candidates(
    base: &Path,
    depth: usize,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if !base.is_dir() || candidates.len() >= MAX_DISCOVERED_PLUGINS {
        return Ok(());
    }
    if depth > MAX_DISCOVERY_DEPTH {
        return Err(format!(
            "Plugin discovery nesting exceeds {MAX_DISCOVERY_DEPTH} levels."
        ));
    }
    let mut entries = fs::read_dir(base)
        .map_err(|error| format!("Unable to read plugin discovery folder: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Unable to inspect plugin discovery folder: {error}"))?;
    if entries.len() > MAX_DISCOVERY_ENTRIES {
        return Err(format!(
            "Plugin discovery folders may contain at most {MAX_DISCOVERY_ENTRIES} entries."
        ));
    }
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Unable to inspect plugin discovery entry: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('@') {
            add_discovery_candidates(&path, depth + 1, candidates)?;
        } else if has_insomnia_manifest(&path) {
            candidates.push(path);
            if candidates.len() >= MAX_DISCOVERED_PLUGINS {
                return Ok(());
            }
        }
    }
    Ok(())
}

pub fn discover_plugin_sources(path: String) -> Result<PluginDiscoveryOutput, String> {
    if path.trim().is_empty() {
        return Err("Choose a plugin package or discovery folder.".into());
    }
    let canonical = PathBuf::from(path.trim())
        .canonicalize()
        .map_err(|error| format!("Unable to open plugin discovery path: {error}"))?;
    if canonical.is_file() {
        return read_plugin_source(canonical.to_string_lossy().into_owned()).map(|plugin| {
            PluginDiscoveryOutput {
                plugins: vec![plugin],
                warnings: vec![],
            }
        });
    }
    if !canonical.is_dir() {
        return Err("The plugin discovery path must be a file or directory.".into());
    }
    let mut candidates = Vec::new();
    if has_insomnia_manifest(&canonical) {
        candidates.push(canonical.clone());
    } else {
        add_discovery_candidates(&canonical, 0, &mut candidates)?;
        let node_modules = canonical.join("node_modules");
        if node_modules.is_dir() {
            add_discovery_candidates(&node_modules, 0, &mut candidates)?;
        }
    }
    let mut seen = BTreeSet::new();
    let mut plugins = Vec::new();
    let mut warnings = Vec::new();
    for candidate in candidates {
        if plugins.len() >= MAX_DISCOVERED_PLUGINS {
            warnings.push(format!(
                "Discovery stopped after {MAX_DISCOVERED_PLUGINS} plugin packages."
            ));
            break;
        }
        let canonical_candidate = match candidate.canonicalize() {
            Ok(path) => path,
            Err(error) => {
                warnings.push(format!(
                    "Unable to resolve '{}': {error}",
                    candidate.display()
                ));
                continue;
            }
        };
        if !seen.insert(canonical_candidate.clone()) {
            continue;
        }
        match read_plugin_source(canonical_candidate.to_string_lossy().into_owned()) {
            Ok(plugin) => plugins.push(plugin),
            Err(error) => warnings.push(format!("{}: {error}", canonical_candidate.display())),
        }
    }
    if plugins.is_empty() && warnings.is_empty() {
        warnings.push("No Insomnia plugin packages were found in that path.".into());
    }
    Ok(PluginDiscoveryOutput { plugins, warnings })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_a_commonjs_package_entry() {
        let temporary = tempfile::tempdir().unwrap();
        fs::write(
            temporary.path().join("package.json"),
            r#"{"name":"example-plugin","version":"1.2.3","main":"index.js","insomnia":{"displayName":"Example display","description":"Package description","permissions":{"modules":["events","uuid",42]}}}"#,
        )
        .unwrap();
        fs::create_dir(temporary.path().join("lib")).unwrap();
        fs::create_dir(temporary.path().join("node_modules")).unwrap();
        fs::write(
            temporary.path().join("index.js"),
            "module.exports = require('./lib/value');",
        )
        .unwrap();
        fs::write(
            temporary.path().join("lib/value.js"),
            "module.exports = {};",
        )
        .unwrap();
        fs::write(
            temporary.path().join("node_modules/ignored.js"),
            "throw new Error('ignored');",
        )
        .unwrap();
        let output = read_plugin_source(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(output.name, "Example display");
        assert_eq!(output.version, "1.2.3");
        assert_eq!(output.description, "Package description");
        assert_eq!(
            PathBuf::from(output.path),
            temporary.path().canonicalize().unwrap()
        );
        assert!(output.source.contains("module.exports"));
        assert_eq!(output.entry_module_key, "index.js");
        assert!(output.module_files.contains_key("lib/value.js"));
        assert!(!output.module_files.contains_key("node_modules/ignored.js"));
        assert_eq!(output.requested_modules, vec!["events", "uuid"]);
        assert_eq!(output.module_warnings.len(), 1);
    }

    #[test]
    fn validates_module_permission_manifest_shapes() {
        let invalid_permissions = serde_json::json!({ "insomnia": { "permissions": [] } });
        let (requested, warnings) = package_requested_modules(Some(&invalid_permissions));
        assert!(requested.is_empty());
        assert_eq!(
            warnings,
            vec!["insomnia.permissions must be an object; ignoring module grants."]
        );

        let invalid_modules =
            serde_json::json!({ "insomnia": { "permissions": { "modules": "events" } } });
        let (requested, warnings) = package_requested_modules(Some(&invalid_modules));
        assert!(requested.is_empty());
        assert_eq!(
            warnings,
            vec!["insomnia.permissions.modules must be an array of strings; ignoring it."]
        );
    }

    #[test]
    fn discovers_unscoped_and_scoped_insomnia_packages() {
        let temporary = tempfile::tempdir().unwrap();
        let packages = temporary.path().join("node_modules");
        let first = packages.join("insomnia-plugin-first");
        let second = packages.join("@example/second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir_all(&second).unwrap();
        fs::write(
            first.join("package.json"),
            r#"{"name":"insomnia-plugin-first","main":"index.js","insomnia":{}}"#,
        )
        .unwrap();
        fs::write(first.join("index.js"), "module.exports = {};").unwrap();
        fs::write(
            second.join("package.json"),
            r#"{"name":"@example/second","main":"main.js","insomnia":{"displayName":"Second"}}"#,
        )
        .unwrap();
        fs::write(second.join("main.js"), "module.exports = {};").unwrap();
        let output =
            discover_plugin_sources(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert!(output.warnings.is_empty());
        assert_eq!(
            output
                .plugins
                .iter()
                .map(|plugin| plugin.name.as_str())
                .collect::<Vec<_>>(),
            vec!["Second", "insomnia-plugin-first"]
        );
    }
}
