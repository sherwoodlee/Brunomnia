use crate::mock_server::{self, MockServerState};
use crate::models::{MockServerInput, MockServerUpdateInput};
use serde::Deserialize;
use std::{
    env,
    ffi::OsString,
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    time::Duration,
};

const DEPLOYMENT_FORMAT: &str = "brunomnia-mock-deployment";
const DEPLOYMENT_VERSION: u32 = 1;
const MAX_DEPLOYMENT_FILE_BYTES: u64 = 20_000_000;

#[derive(Deserialize)]
struct MockDeployment {
    format: String,
    version: u32,
    server: MockServerInput,
}

#[derive(Default)]
struct DeploymentOptions {
    path: Option<PathBuf>,
    host: Option<String>,
    port: Option<u16>,
    help: bool,
}

fn usage() -> &'static str {
    "Usage: brunomnia-mock-server <deployment.json> [--host <address>] [--port <port>]\n\nEnvironment overrides: BRUNOMNIA_MOCK_HOST, BRUNOMNIA_MOCK_PORT"
}

fn parse_options(
    arguments: impl IntoIterator<Item = OsString>,
) -> Result<DeploymentOptions, String> {
    let mut options = DeploymentOptions::default();
    let mut arguments = arguments.into_iter();
    while let Some(argument) = arguments.next() {
        let argument = argument.to_string_lossy();
        match argument.as_ref() {
            "-h" | "--help" => options.help = true,
            "--host" => {
                let value = arguments
                    .next()
                    .ok_or_else(|| "--host requires an address.".to_string())?;
                options.host = Some(value.to_string_lossy().into_owned());
            }
            "--port" => {
                let value = arguments
                    .next()
                    .ok_or_else(|| "--port requires a number.".to_string())?;
                options.port = Some(parse_port(&value.to_string_lossy())?);
            }
            value if value.starts_with('-') => {
                return Err(format!("Unknown mock deployment option '{value}'."));
            }
            value => {
                if options.path.is_some() {
                    return Err(format!("Unexpected mock deployment argument '{value}'."));
                }
                options.path = Some(PathBuf::from(value));
            }
        }
    }
    Ok(options)
}

fn parse_port(value: &str) -> Result<u16, String> {
    value
        .parse::<u16>()
        .map_err(|_| format!("Mock deployment port '{value}' is not between 0 and 65535."))
}

fn read_deployment(
    path: &Path,
    host_override: Option<&str>,
    port_override: Option<u16>,
) -> Result<(String, MockServerInput), String> {
    if path.as_os_str().len() > 4_096 {
        return Err("Mock deployment paths cannot exceed 4,096 bytes.".into());
    }
    let metadata = fs::metadata(path).map_err(|error| {
        format!(
            "Unable to inspect mock deployment '{}': {error}",
            path.display()
        )
    })?;
    if !metadata.is_file() {
        return Err(format!(
            "Mock deployment '{}' is not a regular file.",
            path.display()
        ));
    }
    if metadata.len() > MAX_DEPLOYMENT_FILE_BYTES {
        return Err(format!(
            "Mock deployment '{}' exceeds {} bytes.",
            path.display(),
            MAX_DEPLOYMENT_FILE_BYTES
        ));
    }
    let source = fs::read_to_string(path).map_err(|error| {
        format!(
            "Unable to read mock deployment '{}': {error}",
            path.display()
        )
    })?;
    let deployment: MockDeployment = serde_json::from_str(&source)
        .map_err(|error| format!("Invalid mock deployment '{}': {error}", path.display()))?;
    if deployment.format != DEPLOYMENT_FORMAT || deployment.version != DEPLOYMENT_VERSION {
        return Err(format!(
            "Mock deployment '{}' must use {} version {}.",
            path.display(),
            DEPLOYMENT_FORMAT,
            DEPLOYMENT_VERSION
        ));
    }
    let mut server = deployment.server;
    if let Some(host) = host_override {
        server.host = host.to_string();
    }
    if let Some(port) = port_override {
        server.port = port;
    }
    mock_server::validate_server_input(&server, true)?;
    Ok((source, server))
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate());
        if let Ok(mut terminate) = terminate {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = terminate.recv() => {}
            }
            return;
        }
    }
    let _ = tokio::signal::ctrl_c().await;
}

async fn run(arguments: impl IntoIterator<Item = OsString>) -> Result<(), String> {
    let options = parse_options(arguments)?;
    if options.help {
        println!("{}", usage());
        return Ok(());
    }
    let path = options
        .path
        .ok_or_else(|| format!("A mock deployment file is required.\n\n{}", usage()))?;
    let environment_host = env::var("BRUNOMNIA_MOCK_HOST").ok();
    let environment_port = env::var("BRUNOMNIA_MOCK_PORT")
        .ok()
        .map(|value| parse_port(&value))
        .transpose()?;
    let host_override = options.host.as_deref().or(environment_host.as_deref());
    let port_override = options.port.or(environment_port);
    let (source, server) = read_deployment(&path, host_override, port_override)?;
    let state = MockServerState::default();
    let output = mock_server::start_deployment(server.clone(), state.clone()).await?;
    println!(
        "{}",
        serde_json::json!({
            "status": "ready",
            "baseUrl": output.base_url,
            "routeCount": output.route_count,
            "configPath": path.to_string_lossy(),
        })
    );
    io::stdout()
        .flush()
        .map_err(|error| format!("Unable to flush mock deployment readiness: {error}"))?;

    let mut last_seen_source = source;
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);
    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            _ = tokio::time::sleep(Duration::from_millis(500)) => {
                let Ok((next_source, next_server)) = read_deployment(&path, host_override, port_override) else {
                    continue;
                };
                if next_source == last_seen_source {
                    continue;
                }
                last_seen_source = next_source;
                if next_server.server_id != server.server_id || next_server.host != server.host || next_server.port != server.port {
                    eprintln!("Mock deployment identity, host, or port changed; restart is required before those settings apply.");
                    continue;
                }
                match mock_server::update(MockServerUpdateInput {
                    server_id: server.server_id.clone(),
                    routes: next_server.routes,
                }, state.clone()).await {
                    Ok(updated) => eprintln!("Reloaded mock deployment with {} enabled routes.", updated.route_count),
                    Err(error) => eprintln!("Unable to reload mock deployment: {error}"),
                }
            }
        }
    }
    mock_server::stop(server.server_id, state).await
}

pub async fn run_cli(arguments: impl IntoIterator<Item = OsString>) -> i32 {
    match run(arguments).await {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("{error}");
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bounded_cli_options() {
        let options = parse_options([
            OsString::from("mock.json"),
            OsString::from("--host"),
            OsString::from("0.0.0.0"),
            OsString::from("--port"),
            OsString::from("8080"),
        ])
        .unwrap();
        assert_eq!(options.path, Some(PathBuf::from("mock.json")));
        assert_eq!(options.host.as_deref(), Some("0.0.0.0"));
        assert_eq!(options.port, Some(8080));
        assert!(parse_options([OsString::from("--unknown")]).is_err());
        assert!(parse_options([OsString::from("one.json"), OsString::from("two.json")]).is_err());
    }

    #[test]
    fn validates_format_and_runtime_overrides() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("mock.json");
        fs::write(
            &path,
            serde_json::json!({
                "format": DEPLOYMENT_FORMAT,
                "version": DEPLOYMENT_VERSION,
                "server": {
                    "serverId": "mock",
                    "host": "127.0.0.1",
                    "port": 4010,
                    "routes": []
                }
            })
            .to_string(),
        )
        .unwrap();
        let (_, server) = read_deployment(&path, Some("0.0.0.0"), Some(8080)).unwrap();
        assert_eq!(server.host, "0.0.0.0");
        assert_eq!(server.port, 8080);
        fs::write(&path, r#"{"format":"wrong","version":1,"server":{}}"#).unwrap();
        assert!(read_deployment(&path, None, None).is_err());
    }

    #[test]
    fn rejects_unsafe_binds_routes_and_oversized_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("mock.json");
        let deployment = |host: &str, route_path: &str| {
            serde_json::json!({
                "format": DEPLOYMENT_FORMAT,
                "version": DEPLOYMENT_VERSION,
                "server": {
                    "serverId": "mock",
                    "host": host,
                    "port": 4010,
                    "routes": [{
                        "id": "route",
                        "name": "Route",
                        "enabled": true,
                        "method": "GET",
                        "path": route_path,
                        "status": 200,
                        "headers": [],
                        "body": "{}",
                        "delayMs": 0
                    }]
                }
            })
            .to_string()
        };
        fs::write(&path, deployment("example.com", "/route")).unwrap();
        assert!(read_deployment(&path, None, None).is_err());
        fs::write(&path, deployment("0.0.0.0", "route")).unwrap();
        assert!(read_deployment(&path, None, None).is_err());
        std::fs::File::create(&path)
            .unwrap()
            .set_len(MAX_DEPLOYMENT_FILE_BYTES + 1)
            .unwrap();
        assert!(read_deployment(&path, None, None)
            .unwrap_err()
            .contains("exceeds"));
    }
}
