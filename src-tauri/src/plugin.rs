use flate2::read::GzDecoder;
use futures_util::StreamExt;
use reqwest::{redirect::Policy, Certificate, Client, Proxy, Url};
use ring::digest::{digest, SHA1_FOR_LEGACY_USE_ONLY};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};

const MAX_PLUGIN_BYTES: u64 = 1_000_000;
const MAX_PACKAGE_BYTES: u64 = 5_000_000;
const MAX_PACKAGE_FILES: usize = 500;
const MAX_PACKAGE_ENTRIES: usize = 2_000;
const MAX_PACKAGE_DEPTH: usize = 32;
const MAX_DISCOVERED_PLUGINS: usize = 100;
const MAX_DISCOVERY_ENTRIES: usize = 1_000;
const MAX_DISCOVERY_DEPTH: usize = 4;
const MAX_REGISTRY_METADATA_BYTES: usize = 1_000_000;
const MAX_REGISTRY_TARBALL_BYTES: usize = 10_000_000;
const MAX_REGISTRY_ARCHIVE_BYTES: u64 = 20_000_000;
const MAX_REGISTRY_ARCHIVE_ENTRIES: usize = 2_000;
const MAX_REGISTRY_REDIRECTS: usize = 5;
const DEFAULT_PLUGIN_REGISTRY: &str = "https://registry.npmjs.org/";
const DEFAULT_TARBALL_HOSTS: [&str; 2] = ["registry.npmjs.org", "npm.pkg.github.com"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistryInstallInput {
    pub package_name: String,
    pub registry_url: String,
    pub validate_certificates: bool,
    pub ca_certificate_pem: String,
    pub proxy_enabled: bool,
    pub http_proxy: String,
    pub https_proxy: String,
    pub no_proxy: String,
}

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

fn plugin_source_output(
    source: String,
    path: String,
    module_files: BTreeMap<String, String>,
    entry_module_key: String,
    package: Option<&Value>,
    fallback: &str,
) -> PluginSourceOutput {
    let field = |name: &str, default: &str| {
        package
            .and_then(|value| value.get(name))
            .and_then(Value::as_str)
            .or_else(|| {
                package
                    .and_then(|value| value.get("insomnia"))
                    .and_then(|value| value.get(name))
                    .and_then(Value::as_str)
            })
            .unwrap_or(default)
            .to_string()
    };
    let package_name = field("name", fallback);
    let display_name = package
        .and_then(|value| value.get("insomnia"))
        .and_then(|value| value.get("displayName"))
        .and_then(Value::as_str)
        .unwrap_or(&package_name)
        .to_string();
    let (requested_modules, module_warnings) = package_requested_modules(package);
    PluginSourceOutput {
        source,
        name: display_name,
        version: field("version", "0.0.0-local"),
        description: field("description", "Local CommonJS plugin"),
        path,
        module_files,
        entry_module_key,
        requested_modules,
        module_warnings,
    }
}

fn validate_registry_plugin_name(plugin_name: &str) -> Result<(), String> {
    let suffix = plugin_name
        .strip_prefix("insomnia-plugin-")
        .unwrap_or(plugin_name);
    if suffix.trim().is_empty() || suffix.len() > 214 {
        return Err("Plugin name must not be empty or too long".into());
    }
    if suffix.contains("..") || suffix.contains('/') || suffix.contains('\\') {
        return Err("Plugin name must not contain path traversal characters".into());
    }
    if suffix.chars().any(|character| "|;&$`".contains(character)) {
        return Err("Plugin name must not contain shell metacharacters".into());
    }
    if suffix == "-" {
        return Err("Plugin name must not be a single dash".into());
    }
    if suffix.starts_with('-') {
        return Err("Plugin name must not start with a dash".into());
    }
    if suffix.ends_with('-') {
        return Err("Plugin name must not end with a dash".into());
    }
    if suffix.contains("--") {
        return Err("Plugin name must not contain consecutive dashes".into());
    }
    if suffix.starts_with('.') {
        return Err("Plugin name cannot start with a period".into());
    }
    if suffix.starts_with('_') {
        return Err("Plugin name cannot start with an underscore".into());
    }
    if suffix.trim() != suffix {
        return Err("Plugin name cannot contain leading or trailing spaces".into());
    }
    if !suffix
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.'))
    {
        return Err("Plugin name must be lowercase, alphanumeric, and dash-separated.".into());
    }
    if ["con", "prn", "aux", "nul"].contains(&suffix.to_ascii_lowercase().as_str()) {
        return Err("Plugin name is not allowed".into());
    }
    if !plugin_name.starts_with("insomnia-plugin-") {
        return Err("Plugin name must start with \"insomnia-plugin-\"".into());
    }
    Ok(())
}

fn normalized_registry_url(raw: &str) -> Result<Url, String> {
    let value = if raw.trim().is_empty() {
        DEFAULT_PLUGIN_REGISTRY
    } else {
        raw.trim()
    };
    let mut url =
        Url::parse(value).map_err(|_| "The plugin registry URL is invalid.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("The plugin registry URL must use HTTP or HTTPS.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("The plugin registry URL cannot contain credentials.".into());
    }
    if url.host_str().is_none() || url.query().is_some() || url.fragment().is_some() {
        return Err("The plugin registry URL must contain only an HTTP(S) origin and path.".into());
    }
    if !url.path().ends_with('/') {
        let path = format!("{}/", url.path());
        url.set_path(&path);
    }
    Ok(url)
}

fn same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn redacted_url(url: &Url) -> String {
    let mut redacted = url.clone();
    redacted.set_query(None);
    redacted.set_fragment(None);
    redacted.to_string()
}

fn validate_tarball_url(url: &Url, registry: &Url) -> Result<(), String> {
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Plugin tarball URLs cannot contain credentials.".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Plugin tarball URL has no host.".to_string())?;
    let mut allowed = BTreeSet::from(DEFAULT_TARBALL_HOSTS.map(str::to_string));
    if let Some(registry_host) = registry.host_str() {
        allowed.insert(registry_host.to_string());
    }
    if !allowed.contains(host) {
        return Err(format!(
            "Tarball must come from an allowed host. Got: {host}"
        ));
    }
    let own_http_registry = registry.scheme() == "http"
        && url.scheme() == "http"
        && registry.host() == url.host()
        && registry.port_or_known_default() == url.port_or_known_default();
    if url.scheme() != "https" && !own_http_registry {
        return Err(format!(
            "Tarball must be served over https. Got: {}",
            redacted_url(url)
        ));
    }
    Ok(())
}

fn registry_client(input: &PluginRegistryInstallInput) -> Result<Client, String> {
    let mut builder = Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(60))
        .danger_accept_invalid_certs(!input.validate_certificates)
        .user_agent("brunomnia/0.1.0");
    if input.validate_certificates && !input.ca_certificate_pem.trim().is_empty() {
        let certificates = Certificate::from_pem_bundle(input.ca_certificate_pem.as_bytes())
            .map_err(|error| format!("Invalid plugin registry CA certificate PEM: {error}"))?;
        if certificates.is_empty() {
            return Err("The plugin registry CA certificate PEM contains no certificates.".into());
        }
        for certificate in certificates {
            builder = builder.add_root_certificate(certificate);
        }
    }
    if input.proxy_enabled {
        builder = builder.no_proxy();
        let no_proxy = reqwest::NoProxy::from_string(input.no_proxy.trim());
        if !input.http_proxy.trim().is_empty() {
            builder = builder.proxy(
                Proxy::http(input.http_proxy.trim())
                    .map_err(|error| format!("Invalid HTTP plugin registry proxy: {error}"))?
                    .no_proxy(no_proxy.clone()),
            );
        }
        if !input.https_proxy.trim().is_empty() {
            builder = builder.proxy(
                Proxy::https(input.https_proxy.trim())
                    .map_err(|error| format!("Invalid HTTPS plugin registry proxy: {error}"))?
                    .no_proxy(no_proxy),
            );
        }
    }
    builder.build().map_err(|error| error.to_string())
}

async fn fetch_registry_bytes<F>(
    client: &Client,
    start: Url,
    limit: usize,
    label: &str,
    validate: F,
) -> Result<(Vec<u8>, Url), String>
where
    F: Fn(&Url) -> Result<(), String>,
{
    let mut current = start;
    for redirect in 0..=MAX_REGISTRY_REDIRECTS {
        validate(&current)?;
        let response = client
            .get(current.clone())
            .header("accept", "application/json, application/octet-stream;q=0.9")
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .send()
            .await
            .map_err(|error| {
                format!(
                    "Unable to fetch plugin {label} '{}': {error}",
                    redacted_url(&current)
                )
            })?;
        if response.status().is_redirection() {
            if redirect == MAX_REGISTRY_REDIRECTS {
                return Err(format!(
                    "Plugin {label} exceeded {MAX_REGISTRY_REDIRECTS} redirects."
                ));
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| format!("Plugin {label} redirect omitted Location."))?;
            current = current
                .join(location)
                .map_err(|_| format!("Plugin {label} returned an invalid redirect."))?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!(
                "Plugin {label} '{}' returned {}.",
                redacted_url(&current),
                response.status()
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length > limit as u64)
        {
            return Err(format!("Plugin {label} exceeds the {} byte limit.", limit));
        }
        let mut bytes = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("Unable to read plugin {label}: {error}"))?;
            if bytes.len() + chunk.len() > limit {
                return Err(format!("Plugin {label} exceeds the {} byte limit.", limit));
            }
            bytes.extend_from_slice(&chunk);
        }
        return Ok((bytes, current));
    }
    unreachable!()
}

fn parse_tar_octal(field: &[u8]) -> Result<usize, String> {
    let value = field
        .iter()
        .copied()
        .take_while(|byte| *byte != 0)
        .map(char::from)
        .collect::<String>()
        .trim()
        .to_string();
    if value.is_empty() {
        return Ok(0);
    }
    usize::from_str_radix(&value, 8)
        .map_err(|_| "Plugin tar archive has an invalid octal field.".into())
}

fn tar_header_path(header: &[u8]) -> Result<String, String> {
    let text = |field: &[u8]| {
        String::from_utf8(
            field
                .iter()
                .copied()
                .take_while(|byte| *byte != 0)
                .collect(),
        )
        .map_err(|_| "Plugin tar paths must be UTF-8.".to_string())
    };
    let name = text(&header[0..100])?;
    let prefix = text(&header[345..500])?;
    Ok(if prefix.is_empty() {
        name
    } else {
        format!("{prefix}/{name}")
    })
}

fn parse_pax_path(data: &[u8]) -> Result<Option<String>, String> {
    let text = std::str::from_utf8(data)
        .map_err(|_| "Plugin tar PAX headers must be UTF-8.".to_string())?;
    let mut offset = 0;
    while offset < text.len() {
        let space = text[offset..]
            .find(' ')
            .map(|relative| relative + offset)
            .ok_or_else(|| "Plugin tar PAX header is malformed.".to_string())?;
        let length = text[offset..space]
            .parse::<usize>()
            .map_err(|_| "Plugin tar PAX header has an invalid length.".to_string())?;
        let end = offset
            .checked_add(length)
            .ok_or_else(|| "Plugin tar PAX header is oversized.".to_string())?;
        if end > text.len() || space + 1 >= end {
            return Err("Plugin tar PAX header is truncated.".into());
        }
        let record = text[space + 1..end].trim_end_matches('\n');
        if let Some(path) = record.strip_prefix("path=") {
            return Ok(Some(path.to_string()));
        }
        offset = end;
    }
    Ok(None)
}

fn validate_registry_archive_path(path: &str) -> Result<(), String> {
    if path.is_empty()
        || path.len() > 4_096
        || path.starts_with('/')
        || path.contains('\\')
        || path.contains('\0')
    {
        return Err("Plugin tar archive contains an unsafe path.".into());
    }
    let parts = path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty()
        || parts.len() > MAX_PACKAGE_DEPTH
        || parts.iter().any(|part| *part == "." || *part == "..")
    {
        return Err("Plugin tar archive contains path traversal or excessive nesting.".into());
    }
    Ok(())
}

fn registry_module_key(path: &str) -> Result<Option<String>, String> {
    validate_registry_archive_path(path)?;
    let Some(key) = path.strip_prefix("package/") else {
        return Ok(None);
    };
    if key.is_empty() || key.starts_with('/') {
        return Err("Plugin tar archive contains an unsafe path.".into());
    }
    let parts = key.split('/').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|part| part.is_empty() || *part == "." || *part == "..")
    {
        return Err("Plugin tar archive contains path traversal.".into());
    }
    if parts
        .iter()
        .any(|part| *part == "node_modules" || part.starts_with('.'))
    {
        return Ok(None);
    }
    if !matches!(
        Path::new(key).extension().and_then(|value| value.to_str()),
        Some("js" | "json")
    ) {
        return Ok(None);
    }
    Ok(Some(key.to_string()))
}

fn resolve_registry_entry(
    package: &Value,
    module_files: &BTreeMap<String, String>,
) -> Result<String, String> {
    let requested = package
        .get("main")
        .and_then(Value::as_str)
        .unwrap_or("main.js")
        .trim_start_matches("./");
    if requested.is_empty()
        || requested.starts_with('/')
        || requested.contains('\\')
        || requested.contains('\0')
        || requested
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("Plugin package main entry is unsafe.".into());
    }
    let candidates = [
        requested.to_string(),
        format!("{requested}.js"),
        format!("{requested}/index.js"),
    ];
    candidates
        .into_iter()
        .find(|candidate| candidate.ends_with(".js") && module_files.contains_key(candidate))
        .ok_or_else(|| {
            format!("Plugin package entry '{requested}' was not found in the bounded module map.")
        })
}

#[derive(Debug)]
struct RegistryPackageContents {
    output: PluginSourceOutput,
    package_name: String,
    package_version: String,
}

fn package_from_registry_tarball(
    bytes: &[u8],
    path: String,
) -> Result<RegistryPackageContents, String> {
    let mut decoder = GzDecoder::new(bytes).take(MAX_REGISTRY_ARCHIVE_BYTES + 1);
    let mut archive = Vec::new();
    decoder
        .read_to_end(&mut archive)
        .map_err(|error| format!("Unable to decompress plugin tarball: {error}"))?;
    if archive.len() as u64 > MAX_REGISTRY_ARCHIVE_BYTES {
        return Err(format!(
            "Plugin tar archive exceeds the {MAX_REGISTRY_ARCHIVE_BYTES} byte limit."
        ));
    }
    let mut offset = 0usize;
    let mut entries = 0usize;
    let mut module_bytes = 0usize;
    let mut module_files = BTreeMap::new();
    let mut pending_path: Option<String> = None;
    while offset + 512 <= archive.len() {
        let header = &archive[offset..offset + 512];
        offset += 512;
        if header.iter().all(|byte| *byte == 0) {
            break;
        }
        entries += 1;
        if entries > MAX_REGISTRY_ARCHIVE_ENTRIES {
            return Err(format!(
                "Plugin tar archive contains more than {MAX_REGISTRY_ARCHIVE_ENTRIES} entries."
            ));
        }
        let expected_checksum = parse_tar_octal(&header[148..156])?;
        let checksum = header
            .iter()
            .enumerate()
            .fold(0usize, |sum, (index, byte)| {
                sum + if (148..156).contains(&index) {
                    b' ' as usize
                } else {
                    *byte as usize
                }
            });
        if checksum != expected_checksum {
            return Err("Plugin tar archive failed its header checksum.".into());
        }
        let size = parse_tar_octal(&header[124..136])?;
        let end = offset
            .checked_add(size)
            .filter(|end| *end <= archive.len())
            .ok_or_else(|| "Plugin tar archive entry is truncated.".to_string())?;
        let data = &archive[offset..end];
        let padded = size
            .checked_add(511)
            .map(|value| value / 512 * 512)
            .ok_or_else(|| "Plugin tar archive entry is oversized.".to_string())?;
        offset = offset
            .checked_add(padded)
            .filter(|offset| *offset <= archive.len())
            .ok_or_else(|| "Plugin tar archive padding is truncated.".to_string())?;
        let entry_type = header[156];
        if entry_type == b'x' {
            pending_path = parse_pax_path(data)?;
            continue;
        }
        if entry_type == b'L' {
            pending_path = Some(
                String::from_utf8(data.to_vec())
                    .map_err(|_| "Plugin tar long paths must be UTF-8.".to_string())?
                    .trim_end_matches(['\0', '\n'])
                    .to_string(),
            );
            continue;
        }
        let entry_path = pending_path.take().unwrap_or(tar_header_path(header)?);
        validate_registry_archive_path(&entry_path)?;
        if !matches!(entry_type, 0 | b'0') {
            continue;
        }
        let Some(key) = registry_module_key(&entry_path)? else {
            continue;
        };
        if data.len() > MAX_PLUGIN_BYTES as usize {
            return Err(format!("Plugin module '{key}' exceeds the 1 MB limit."));
        }
        module_bytes = module_bytes.saturating_add(data.len());
        if module_bytes > MAX_PACKAGE_BYTES as usize {
            return Err("Plugin package modules exceed the 5 MB aggregate limit.".into());
        }
        if module_files.len() >= MAX_PACKAGE_FILES {
            return Err(format!(
                "Plugin package contains more than {MAX_PACKAGE_FILES} JavaScript/JSON files."
            ));
        }
        let source = String::from_utf8(data.to_vec())
            .map_err(|_| format!("Plugin module '{key}' must be UTF-8 text."))?;
        if module_files.insert(key.clone(), source).is_some() {
            return Err(format!(
                "Plugin tar archive contains duplicate module '{key}'."
            ));
        }
    }
    let package_source = module_files
        .get("package.json")
        .ok_or_else(|| "Plugin tarball does not contain package/package.json.".to_string())?;
    let package: Value = serde_json::from_str(package_source)
        .map_err(|error| format!("Invalid plugin package.json: {error}"))?;
    if !package.get("insomnia").is_some_and(Value::is_object) {
        return Err("Package is not an Insomnia plugin (missing \"insomnia\" attribute)".into());
    }
    let package_name = package
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin package.json is missing its name.".to_string())?
        .to_string();
    let package_version = package
        .get("version")
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin package.json is missing its version.".to_string())?
        .to_string();
    validate_registry_plugin_name(&package_name)?;
    let entry_module_key = resolve_registry_entry(&package, &module_files)?;
    let source = module_files
        .get(&entry_module_key)
        .cloned()
        .ok_or_else(|| "Plugin package entry is missing.".to_string())?;
    let output = plugin_source_output(
        source,
        path,
        module_files,
        entry_module_key,
        Some(&package),
        &package_name,
    );
    let mut output = output;
    let has_dependencies = ["dependencies", "optionalDependencies", "peerDependencies"]
        .iter()
        .any(|name| {
            package
                .get(name)
                .and_then(Value::as_object)
                .is_some_and(|dependencies| !dependencies.is_empty())
        })
        || ["bundledDependencies", "bundleDependencies"]
            .iter()
            .any(|name| {
                package
                    .get(name)
                    .and_then(Value::as_array)
                    .is_some_and(|dependencies| !dependencies.is_empty())
            });
    if has_dependencies {
        output.module_warnings.push(
            "Production dependencies are not downloaded; only modules bundled in this package can load."
                .into(),
        );
    }
    Ok(RegistryPackageContents {
        output,
        package_name,
        package_version,
    })
}

fn sha1_hex(bytes: &[u8]) -> String {
    digest(&SHA1_FOR_LEGACY_USE_ONLY, bytes)
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub async fn install_registry_plugin(
    input: PluginRegistryInstallInput,
) -> Result<PluginSourceOutput, String> {
    let package_name = input.package_name.trim().to_string();
    validate_registry_plugin_name(&package_name)?;
    let registry = normalized_registry_url(&input.registry_url)?;
    let metadata_url = registry
        .join(&package_name)
        .map_err(|_| "Unable to build the plugin metadata URL.".to_string())?;
    let client = registry_client(&input)?;
    let (metadata_bytes, _) = fetch_registry_bytes(
        &client,
        metadata_url,
        MAX_REGISTRY_METADATA_BYTES,
        "metadata",
        |url| {
            if same_origin(url, &registry) {
                Ok(())
            } else {
                Err("Plugin metadata redirects must stay on the configured registry origin.".into())
            }
        },
    )
    .await?;
    let metadata: Value = serde_json::from_slice(&metadata_bytes)
        .map_err(|error| format!("Invalid plugin registry metadata: {error}"))?;
    let latest = metadata
        .get("dist-tags")
        .and_then(|value| value.get("latest"))
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin registry metadata has no latest version.".to_string())?;
    let version = metadata
        .get("versions")
        .and_then(|value| value.get(latest))
        .ok_or_else(|| "Plugin registry metadata omitted the latest version record.".to_string())?;
    if !version.get("insomnia").is_some_and(Value::is_object) {
        return Err(format!(
            "Package \"{package_name}\" is not an Insomnia plugin (missing \"insomnia\" attribute)"
        ));
    }
    let metadata_name = version
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin registry metadata omitted the package name.".to_string())?;
    let metadata_version = version
        .get("version")
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin registry metadata omitted the package version.".to_string())?;
    if metadata_name != package_name || metadata_version != latest {
        return Err(
            "Plugin registry metadata identity does not match the requested package.".into(),
        );
    }
    let distribution = version
        .get("dist")
        .ok_or_else(|| "Plugin registry metadata omitted distribution information.".to_string())?;
    let tarball_url = distribution
        .get("tarball")
        .and_then(Value::as_str)
        .ok_or_else(|| "Invalid plugin metadata: missing tarball URL".to_string())?;
    let expected_sha1 = distribution
        .get("shasum")
        .and_then(Value::as_str)
        .filter(|value| {
            value.len() == 40 && value.chars().all(|character| character.is_ascii_hexdigit())
        })
        .ok_or_else(|| {
            "Plugin registry metadata omitted a valid SHA-1 tarball checksum.".to_string()
        })?
        .to_ascii_lowercase();
    let tarball = Url::parse(tarball_url)
        .map_err(|_| "Invalid tarball URL in plugin metadata.".to_string())?;
    let (tarball_bytes, final_tarball_url) = fetch_registry_bytes(
        &client,
        tarball,
        MAX_REGISTRY_TARBALL_BYTES,
        "tarball",
        |url| validate_tarball_url(url, &registry),
    )
    .await?;
    let actual_sha1 = sha1_hex(&tarball_bytes);
    if actual_sha1 != expected_sha1 {
        return Err(format!(
            "Plugin tarball checksum mismatch: expected {expected_sha1}, received {actual_sha1}."
        ));
    }
    let mut package = package_from_registry_tarball(
        &tarball_bytes,
        format!("npm:{package_name}@{metadata_version}"),
    )?;
    if package.package_name != package_name || package.package_version != metadata_version {
        return Err("Plugin tarball identity does not match its registry metadata.".into());
    }
    package.output.module_warnings.push(format!(
        "Fetched {} from {} and verified SHA-1 {}.",
        metadata_version,
        redacted_url(&final_tarball_url),
        actual_sha1
    ));
    Ok(package.output)
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
    let fallback = entry
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Local plugin");
    Ok(plugin_source_output(
        source,
        source_path.to_string_lossy().into_owned(),
        module_files,
        entry_module_key,
        package.as_ref(),
        fallback,
    ))
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
    use flate2::{write::GzEncoder, Compression};
    use std::io::Write;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    fn write_octal(field: &mut [u8], value: usize) {
        let text = format!("{value:0width$o}", width = field.len() - 1);
        field[..text.len()].copy_from_slice(text.as_bytes());
        field[text.len()] = 0;
    }

    fn append_tar_entry(archive: &mut Vec<u8>, path: &str, contents: &[u8]) {
        assert!(path.len() <= 100);
        let mut header = [0_u8; 512];
        header[..path.len()].copy_from_slice(path.as_bytes());
        write_octal(&mut header[100..108], 0o644);
        write_octal(&mut header[108..116], 0);
        write_octal(&mut header[116..124], 0);
        write_octal(&mut header[124..136], contents.len());
        write_octal(&mut header[136..148], 0);
        header[148..156].fill(b' ');
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        header[263..265].copy_from_slice(b"00");
        let checksum = header.iter().map(|byte| *byte as usize).sum::<usize>();
        let checksum = format!("{checksum:06o}\0 ");
        header[148..156].copy_from_slice(checksum.as_bytes());
        archive.extend_from_slice(&header);
        archive.extend_from_slice(contents);
        archive.resize(archive.len().div_ceil(512) * 512, 0);
    }

    fn gzip_archive(entries: &[(&str, Vec<u8>)]) -> Vec<u8> {
        let mut archive = Vec::new();
        for (path, contents) in entries {
            append_tar_entry(&mut archive, path, contents);
        }
        archive.resize(archive.len() + 1_024, 0);
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&archive).unwrap();
        encoder.finish().unwrap()
    }

    fn registry_package_tarball() -> Vec<u8> {
        gzip_archive(&[
            (
                "package/package.json",
                br#"{"name":"insomnia-plugin-example","version":"1.2.3","main":"index.js","dependencies":{"left-pad":"1.3.0"},"insomnia":{"displayName":"Registry example","permissions":{"modules":["events"]}}}"#.to_vec(),
            ),
            (
                "package/index.js",
                b"module.exports = require('./lib/value');".to_vec(),
            ),
            (
                "package/lib/value.js",
                b"module.exports = { value: true };".to_vec(),
            ),
        ])
    }

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
    fn validates_exact_unscoped_registry_plugin_names() {
        for valid in ["insomnia-plugin-example", "insomnia-plugin-Example_1.2"] {
            assert!(validate_registry_plugin_name(valid).is_ok(), "{valid}");
        }
        for invalid in [
            "example",
            "@scope/insomnia-plugin-example",
            "insomnia-plugin-../example",
            "insomnia-plugin--example",
            "insomnia-plugin-example-",
            "insomnia-plugin-con",
        ] {
            assert!(validate_registry_plugin_name(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn parses_a_bounded_registry_package() {
        let output = package_from_registry_tarball(
            &registry_package_tarball(),
            "npm:insomnia-plugin-example@1.2.3".into(),
        )
        .unwrap();
        assert_eq!(output.package_name, "insomnia-plugin-example");
        assert_eq!(output.package_version, "1.2.3");
        assert_eq!(output.output.name, "Registry example");
        assert_eq!(output.output.entry_module_key, "index.js");
        assert!(output.output.module_files.contains_key("lib/value.js"));
        assert_eq!(output.output.requested_modules, vec!["events"]);
        assert!(output
            .output
            .module_warnings
            .iter()
            .any(|warning| warning.contains("not downloaded")));
    }

    #[test]
    fn rejects_unsafe_corrupt_and_oversized_registry_archives() {
        let traversal = gzip_archive(&[("package/../escape.js", b"bad".to_vec())]);
        assert!(package_from_registry_tarball(&traversal, "npm:test".into())
            .unwrap_err()
            .contains("path traversal"));

        let mut archive = Vec::new();
        append_tar_entry(&mut archive, "package/package.json", b"{}");
        archive[148] = archive[148].wrapping_add(1);
        archive.resize(archive.len() + 1_024, 0);
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&archive).unwrap();
        let corrupt = encoder.finish().unwrap();
        assert!(package_from_registry_tarball(&corrupt, "npm:test".into())
            .unwrap_err()
            .contains("checksum"));

        let oversized = gzip_archive(&[(
            "package/index.js",
            vec![b'x'; MAX_PLUGIN_BYTES as usize + 1],
        )]);
        assert!(package_from_registry_tarball(&oversized, "npm:test".into())
            .unwrap_err()
            .contains("1 MB limit"));
    }

    #[tokio::test]
    async fn installs_from_a_custom_loopback_registry() {
        let tarball = registry_package_tarball();
        let checksum = sha1_hex(&tarball);
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let metadata = serde_json::json!({
            "dist-tags": { "latest": "1.2.3" },
            "versions": {
                "1.2.3": {
                    "name": "insomnia-plugin-example",
                    "version": "1.2.3",
                    "insomnia": {},
                    "dist": {
                        "shasum": checksum,
                        "tarball": format!("http://{address}/example.tgz?token=secret")
                    }
                }
            }
        })
        .to_string()
        .into_bytes();
        let server = tokio::spawn(async move {
            for _ in 0..2 {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut request = [0_u8; 2_048];
                let size = stream.read(&mut request).await.unwrap();
                let request = String::from_utf8_lossy(&request[..size]);
                let body = if request.starts_with("GET /insomnia-plugin-example ") {
                    &metadata
                } else if request.starts_with("GET /example.tgz?token=secret ") {
                    &tarball
                } else {
                    panic!("unexpected request: {request}");
                };
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                stream.write_all(response.as_bytes()).await.unwrap();
                stream.write_all(body).await.unwrap();
            }
        });
        let output = install_registry_plugin(PluginRegistryInstallInput {
            package_name: "insomnia-plugin-example".into(),
            registry_url: format!("http://{address}/"),
            validate_certificates: true,
            ca_certificate_pem: String::new(),
            proxy_enabled: true,
            http_proxy: String::new(),
            https_proxy: String::new(),
            no_proxy: String::new(),
        })
        .await
        .unwrap();
        server.await.unwrap();
        assert_eq!(output.name, "Registry example");
        assert_eq!(output.path, "npm:insomnia-plugin-example@1.2.3");
        assert!(output
            .module_warnings
            .iter()
            .any(|warning| warning.contains("verified SHA-1")));
        assert!(output
            .module_warnings
            .iter()
            .all(|warning| !warning.contains("secret")));
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
