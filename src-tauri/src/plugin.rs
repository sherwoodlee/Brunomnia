use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

const MAX_PLUGIN_BYTES: u64 = 1_000_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSourceOutput {
    pub source: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub path: String,
}

fn source_file(path: &Path) -> Result<(PathBuf, Option<Value>), String> {
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to open plugin path: {error}"))?;
    if canonical.is_file() {
        return Ok((canonical, None));
    }
    if !canonical.is_dir() {
        return Err("The plugin path must be a JavaScript file or package folder.".into());
    }
    let package_path = canonical.join("package.json");
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
    Ok((entry, Some(package)))
}

pub fn read_plugin_source(path: String) -> Result<PluginSourceOutput, String> {
    if path.trim().is_empty() {
        return Err("Choose a plugin JavaScript file or package folder.".into());
    }
    let (entry, package) = source_file(&PathBuf::from(path.trim()))?;
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
    let fallback = entry
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Local plugin");
    let field = |name: &str, default: &str| {
        package
            .as_ref()
            .and_then(|value| value.get(name))
            .and_then(Value::as_str)
            .unwrap_or(default)
            .to_string()
    };
    Ok(PluginSourceOutput {
        source,
        name: field("name", fallback),
        version: field("version", "0.0.0-local"),
        description: field("description", "Local CommonJS plugin"),
        path: entry.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_a_commonjs_package_entry() {
        let temporary = tempfile::tempdir().unwrap();
        fs::write(
            temporary.path().join("package.json"),
            r#"{"name":"example-plugin","version":"1.2.3","main":"index.js"}"#,
        )
        .unwrap();
        fs::write(temporary.path().join("index.js"), "module.exports = {};").unwrap();
        let output = read_plugin_source(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(output.name, "example-plugin");
        assert_eq!(output.version, "1.2.3");
        assert!(output.source.contains("module.exports"));
    }
}
