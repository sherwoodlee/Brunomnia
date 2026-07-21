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
            r#"{"name":"example-plugin","version":"1.2.3","main":"index.js","insomnia":{"displayName":"Example display","description":"Package description"}}"#,
        )
        .unwrap();
        fs::write(temporary.path().join("index.js"), "module.exports = {};").unwrap();
        let output = read_plugin_source(temporary.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(output.name, "Example display");
        assert_eq!(output.version, "1.2.3");
        assert_eq!(output.description, "Package description");
        assert_eq!(
            PathBuf::from(output.path),
            temporary.path().canonicalize().unwrap()
        );
        assert!(output.source.contains("module.exports"));
    }
}
