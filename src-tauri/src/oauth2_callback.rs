use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    path::{Path, PathBuf},
    sync::Arc,
};
use tauri::{
    ipc::Channel, webview::NewWindowResponse, AppHandle, Manager, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::{mpsc, oneshot, Mutex},
    time::{timeout, Duration, Instant},
};
use url::{form_urlencoded, Url};
use uuid::Uuid;

const MAX_URL_BYTES: usize = 8_192;
const MAX_REQUEST_BYTES: usize = 16_384;
const MAX_FLOW_ID_BYTES: usize = 128;
const MAX_STATE_BYTES: usize = 1_024;
const AUTHORIZATION_TIMEOUT: Duration = Duration::from_secs(300);
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(10);
const SESSION_ID_FILE: &str = "oauth2-session-id";
const SESSION_RESTART_FILE: &str = "oauth2-clear-on-restart";

#[derive(Clone, Default)]
pub struct OAuthCallbackState {
    flows: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    session_id: Arc<Mutex<Option<Uuid>>>,
    session_initialized: Arc<Mutex<bool>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackInput {
    pub flow_id: String,
    pub authorization_url: String,
    pub redirect_url: String,
    #[serde(default)]
    pub use_default_browser: bool,
    #[serde(default)]
    pub proxy_url: String,
    #[serde(default)]
    pub proxy_exclusions: String,
    #[serde(default = "default_true")]
    pub validate_certificates: bool,
    #[serde(default)]
    pub client_certificate_pem: String,
    #[serde(default)]
    pub client_key_pem: String,
    #[serde(default)]
    pub client_certificate_pfx_base64: String,
    #[serde(default)]
    pub client_certificate_passphrase: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackEvent {
    pub kind: String,
    pub browser_mode: String,
    pub authorization_url: String,
    pub redirect_url: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackOutput {
    pub redirect_url: String,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug)]
struct PreparedAuthorization {
    authorization_url: Url,
    redirect_url: Url,
    expected_state: String,
}

#[derive(Debug)]
struct PreparedCallback {
    listener: TcpListener,
    authorization_url: String,
    redirect_url: String,
    callback_path: String,
    expected_state: String,
    response_type: String,
}

enum EmbeddedEvent {
    Redirect(Url),
    Popup(Url),
    Closed,
}

fn default_true() -> bool {
    true
}

fn validate_flow_id(flow_id: &str) -> Result<(), String> {
    if flow_id.is_empty()
        || flow_id.len() > MAX_FLOW_ID_BYTES
        || !flow_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(
            "OAuth flow IDs may contain only letters, numbers, hyphens, and underscores.".into(),
        );
    }
    Ok(())
}

fn bounded_url(value: &str, label: &str) -> Result<Url, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_URL_BYTES {
        return Err(format!("The OAuth {label} URL is empty or exceeds 8 KiB."));
    }
    Url::parse(value).map_err(|_| format!("The OAuth {label} URL is malformed."))
}

fn prepare_authorization(input: &OAuthCallbackInput) -> Result<PreparedAuthorization, String> {
    validate_flow_id(&input.flow_id)?;
    let authorization_url = bounded_url(&input.authorization_url, "authorization")?;
    if !matches!(authorization_url.scheme(), "http" | "https") {
        return Err("OAuth authorization URLs must use HTTP or HTTPS.".into());
    }
    let redirect_url = bounded_url(&input.redirect_url, "redirect")?;
    let expected_state = authorization_url
        .query_pairs()
        .find(|(key, _)| key == "state")
        .map(|(_, value)| value.into_owned())
        .unwrap_or_default();
    if expected_state.is_empty() || expected_state.len() > MAX_STATE_BYTES {
        return Err(
            "Automatic OAuth authorization requires a bounded non-empty state value.".into(),
        );
    }
    Ok(PreparedAuthorization {
        authorization_url,
        redirect_url,
        expected_state,
    })
}

fn loopback_address(url: &Url) -> Result<IpAddr, String> {
    if url.scheme() != "http" || url.username() != "" || url.password().is_some() {
        return Err(
            "Automatic system-browser OAuth callbacks require a plain HTTP loopback redirect URL."
                .into(),
        );
    }
    match url
        .host_str()
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "localhost" | "127.0.0.1" => Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)),
        "::1" | "[::1]" => Ok(IpAddr::V6(Ipv6Addr::LOCALHOST)),
        _ => Err(
            "Automatic system-browser OAuth callbacks may bind only localhost, 127.0.0.1, or ::1."
                .into(),
        ),
    }
}

fn replace_query_parameter(url: &mut Url, name: &str, value: &str) {
    let values = url
        .query_pairs()
        .filter(|(key, _)| key != name)
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    url.query_pairs_mut()
        .clear()
        .extend_pairs(values)
        .append_pair(name, value);
}

async fn prepare_callback(input: &OAuthCallbackInput) -> Result<PreparedCallback, String> {
    let prepared = prepare_authorization(input)?;
    let mut authorization = prepared.authorization_url;
    let mut redirect = prepared.redirect_url;
    let address = loopback_address(&redirect)?;
    if redirect.fragment().is_some() {
        return Err("System-browser OAuth redirect URLs cannot contain a fragment.".into());
    }
    let response_type = authorization
        .query_pairs()
        .find(|(key, _)| key == "response_type")
        .map(|(_, value)| value.into_owned())
        .unwrap_or_else(|| "code".into());
    let listener = TcpListener::bind(SocketAddr::new(address, redirect.port().unwrap_or(0)))
        .await
        .map_err(|error| format!("Unable to bind the OAuth callback listener: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    redirect
        .set_port(Some(port))
        .map_err(|_| "Unable to assign the OAuth callback port.".to_string())?;
    let redirect_url = redirect.to_string();
    replace_query_parameter(&mut authorization, "redirect_uri", &redirect_url);
    Ok(PreparedCallback {
        listener,
        authorization_url: authorization.to_string(),
        redirect_url,
        callback_path: redirect.path().to_string(),
        expected_state: prepared.expected_state,
        response_type,
    })
}

fn response_page(title: &str, message: &str, bridge_fragment: bool) -> String {
    let script = if bridge_fragment {
        r#"<script>const fragment=window.location.hash.slice(1);if(fragment){const separator=window.location.search?'&':'?';window.location.replace(window.location.pathname+window.location.search+separator+fragment);}</script>"#
    } else {
        ""
    };
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'\"><title>{title}</title><style>body{{background:#0b1014;color:#ecf0ed;font:16px system-ui;margin:0;display:grid;min-height:100vh;place-items:center}}main{{max-width:560px;padding:32px}}p{{color:#b8c1c5;line-height:1.5}}</style></head><body><main><h1>{title}</h1><p>{message}</p></main>{script}</body></html>"
    )
}

async fn send_page(
    stream: &mut TcpStream,
    status: &str,
    title: &str,
    message: &str,
    bridge_fragment: bool,
) -> Result<(), String> {
    let body = response_page(title, message, bridge_fragment);
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| error.to_string())
}

async fn read_target(stream: &mut TcpStream) -> Result<String, String> {
    let mut request = Vec::new();
    let mut chunk = [0_u8; 2_048];
    while request.len() < MAX_REQUEST_BYTES {
        let read = timeout(CONNECTION_TIMEOUT, stream.read(&mut chunk))
            .await
            .map_err(|_| "The OAuth callback request timed out.".to_string())?
            .map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..read]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    if request.len() >= MAX_REQUEST_BYTES {
        return Err("The OAuth callback request exceeded 16 KiB.".into());
    }
    let request = std::str::from_utf8(&request)
        .map_err(|_| "The OAuth callback request was not valid UTF-8.".to_string())?;
    let mut parts = request
        .lines()
        .next()
        .ok_or_else(|| "The OAuth callback request was empty.".to_string())?
        .split_whitespace();
    if parts.next() != Some("GET") {
        return Err("The OAuth callback accepts only GET requests.".into());
    }
    let target = parts
        .next()
        .ok_or_else(|| "The OAuth callback target was missing.".to_string())?;
    if !target.starts_with('/') || target.len() > MAX_URL_BYTES {
        return Err("The OAuth callback target was invalid.".into());
    }
    Ok(target.to_string())
}

async fn wait_for_callback(
    prepared: &PreparedCallback,
    cancellation: oneshot::Receiver<()>,
) -> Result<HashMap<String, String>, String> {
    let deadline = Instant::now() + AUTHORIZATION_TIMEOUT;
    tokio::pin!(cancellation);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("OAuth authorization timed out after five minutes.".into());
        }
        let accepted = tokio::select! {
            _ = &mut cancellation => return Err("OAuth authorization was canceled.".into()),
            result = timeout(remaining, prepared.listener.accept()) => result
                .map_err(|_| "OAuth authorization timed out after five minutes.".to_string())?
                .map_err(|error| error.to_string())?,
        };
        let (mut stream, _) = accepted;
        let target = match read_target(&mut stream).await {
            Ok(target) => target,
            Err(error) => {
                let _ = send_page(
                    &mut stream,
                    "400 Bad Request",
                    "Invalid callback",
                    &error,
                    false,
                )
                .await;
                continue;
            }
        };
        let callback = Url::parse(&format!("http://localhost{target}"))
            .map_err(|_| "The OAuth callback target was malformed.".to_string())?;
        if callback.path() != prepared.callback_path {
            let _ = send_page(
                &mut stream,
                "404 Not Found",
                "Not found",
                "This is not the active OAuth callback path.",
                false,
            )
            .await;
            continue;
        }
        let parameters = url_parameters(&callback);
        let has_response = has_oauth_response(&parameters);
        if !has_response && prepared.response_type != "code" {
            send_page(
                &mut stream,
                "200 OK",
                "Completing authorization",
                "Brunomnia is collecting the token from the redirect fragment.",
                true,
            )
            .await?;
            continue;
        }
        if parameters.get("state") != Some(&prepared.expected_state) {
            send_page(
                &mut stream,
                "400 Bad Request",
                "State mismatch",
                "The callback state did not match this authorization attempt.",
                false,
            )
            .await?;
            continue;
        }
        let failed = parameters.contains_key("error");
        send_page(
            &mut stream,
            if failed { "400 Bad Request" } else { "200 OK" },
            if failed {
                "Authorization failed"
            } else {
                "Authorization complete"
            },
            if failed {
                "Return to Brunomnia to review the provider error."
            } else {
                "You can close this tab and return to Brunomnia."
            },
            false,
        )
        .await?;
        return Ok(parameters);
    }
}

fn url_parameters(url: &Url) -> HashMap<String, String> {
    let mut parameters = url
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<HashMap<_, _>>();
    if let Some(fragment) = url.fragment() {
        parameters.extend(
            form_urlencoded::parse(fragment.as_bytes())
                .map(|(key, value)| (key.into_owned(), value.into_owned())),
        );
    }
    parameters
}

fn has_oauth_response(parameters: &HashMap<String, String>) -> bool {
    ["code", "access_token", "id_token", "error"]
        .iter()
        .any(|name| parameters.contains_key(*name))
}

fn redirect_target_matches(expected: &Url, current: &Url) -> bool {
    if expected.scheme() != current.scheme()
        || expected.username() != current.username()
        || expected.password() != current.password()
        || expected.host_str() != current.host_str()
        || expected.port() != current.port()
        || expected.path() != current.path()
    {
        return false;
    }
    let current_query = current.query_pairs().collect::<Vec<_>>();
    expected
        .query_pairs()
        .all(|expected_pair| current_query.iter().any(|pair| pair == &expected_pair))
}

fn redirect_parameters(expected: &Url, current: &Url) -> Option<HashMap<String, String>> {
    if !redirect_target_matches(expected, current) {
        return None;
    }
    let parameters = url_parameters(current);
    has_oauth_response(&parameters).then_some(parameters)
}

fn checked_redirect_parameters(
    expected: &Url,
    current: &Url,
    expected_state: &str,
) -> Option<Result<HashMap<String, String>, String>> {
    redirect_parameters(expected, current).map(|parameters| {
        if parameters.get("state").map(String::as_str) != Some(expected_state) {
            Err("OAuth callback state did not match this authorization attempt.".into())
        } else {
            Ok(parameters)
        }
    })
}

fn session_id_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data).map_err(|error| error.to_string())?;
    Ok(app_data.join(SESSION_ID_FILE))
}

fn session_restart_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(session_id_path(app)?.with_file_name(SESSION_RESTART_FILE))
}

fn session_id_from_text(value: &str) -> Option<Uuid> {
    Uuid::parse_str(value.trim()).ok()
}

fn write_session_id(path: &Path, session_id: Uuid) -> Result<(), String> {
    let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4().simple()));
    fs::write(&temporary, session_id.hyphenated().to_string())
        .map_err(|error| error.to_string())?;
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    Ok(())
}

async fn oauth_session(
    app: &AppHandle,
    state: &OAuthCallbackState,
) -> Result<(Uuid, PathBuf), String> {
    let path = session_id_path(app)?;
    let mut initialized = state.session_initialized.lock().await;
    if !*initialized {
        let clear_on_restart = fs::read_to_string(session_restart_path(app)?)
            .map(|value| value.trim() == "true")
            .unwrap_or(false);
        if clear_on_restart {
            let session_id = Uuid::new_v4();
            write_session_id(&path, session_id)?;
            *state.session_id.lock().await = Some(session_id);
        }
        *initialized = true;
    }
    drop(initialized);
    let mut cached = state.session_id.lock().await;
    let session_id = match *cached {
        Some(session_id) => session_id,
        None => {
            let stored = fs::read_to_string(&path)
                .ok()
                .and_then(|value| session_id_from_text(&value));
            let session_id = stored.unwrap_or_else(Uuid::new_v4);
            if stored.is_none() {
                write_session_id(&path, session_id)?;
            }
            *cached = Some(session_id);
            session_id
        }
    };
    let directory = path
        .with_file_name("oauth2-sessions")
        .join(session_id.simple().to_string());
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok((session_id, directory))
}

fn configured_proxy(input: &OAuthCallbackInput, target: &Url) -> Result<Option<Url>, String> {
    let value = input.proxy_url.trim();
    if value.is_empty() || crate::streaming::proxy_bypassed(&input.proxy_exclusions, target) {
        return Ok(None);
    }
    let proxy = bounded_url(value, "proxy")?;
    if !matches!(proxy.scheme(), "http" | "socks5") {
        return Err("OAuth browser proxies must use HTTP or SOCKS5.".into());
    }
    Ok(Some(proxy))
}

async fn build_embedded_window(
    app: &AppHandle,
    input: &OAuthCallbackInput,
    prepared: &PreparedAuthorization,
    session_id: Uuid,
    session_directory: PathBuf,
    sender: mpsc::UnboundedSender<EmbeddedEvent>,
) -> Result<WebviewWindow, String> {
    #[cfg(target_os = "macos")]
    let webview_policy = crate::oauth2_webview_macos::prepare_policy(
        &input.flow_id,
        &prepared.authorization_url,
        input.validate_certificates,
        crate::models::TransportConfig {
            client_certificate_pem: input.client_certificate_pem.clone(),
            client_key_pem: input.client_key_pem.clone(),
            client_certificate_pfx_base64: input.client_certificate_pfx_base64.clone(),
            client_certificate_passphrase: input.client_certificate_passphrase.clone(),
            ..crate::models::TransportConfig::default()
        },
    )?;
    let navigation_redirect = prepared.redirect_url.clone();
    let navigation_sender = sender.clone();
    let load_redirect = prepared.redirect_url.clone();
    let load_sender = sender.clone();
    let popup_sender = sender.clone();
    let label = format!("oauth2-auth-{}", input.flow_id);
    let initial_url = Url::parse("about:blank").expect("about:blank is a valid URL");
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(initial_url))
        .title("OAuth 2 Authorization")
        .inner_size(960.0, 720.0)
        .min_inner_size(480.0, 360.0)
        .data_directory(session_directory)
        .data_store_identifier(*session_id.as_bytes())
        .on_navigation(move |url| {
            if redirect_parameters(&navigation_redirect, url).is_some() {
                let _ = navigation_sender.send(EmbeddedEvent::Redirect(url.clone()));
                false
            } else {
                true
            }
        })
        .on_page_load(move |_window, payload| {
            if redirect_parameters(&load_redirect, payload.url()).is_some() {
                let _ = load_sender.send(EmbeddedEvent::Redirect(payload.url().clone()));
            }
        })
        .on_new_window(move |url, _features| {
            let _ = popup_sender.send(EmbeddedEvent::Popup(url));
            NewWindowResponse::Deny
        });
    if let Some(proxy) = configured_proxy(input, &prepared.authorization_url)? {
        builder = builder.proxy_url(proxy);
    }
    let window = builder.build().map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    let flow_id = input.flow_id.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::CloseRequested { .. }) {
            let _ = sender.send(EmbeddedEvent::Closed);
        }
        #[cfg(target_os = "macos")]
        if matches!(event, WindowEvent::Destroyed) {
            crate::oauth2_webview_macos::remove_policy(&flow_id);
        }
    });
    #[cfg(target_os = "macos")]
    {
        let (installed, installation) = oneshot::channel();
        if let Err(error) = window.with_webview(move |webview| {
            let result = unsafe {
                crate::oauth2_webview_macos::install_policy(webview.inner(), webview_policy)
            };
            let _ = installed.send(result);
        }) {
            let _ = window.destroy();
            return Err(error.to_string());
        }
        match timeout(CONNECTION_TIMEOUT, installation).await {
            Ok(Ok(Ok(()))) => {}
            Ok(Ok(Err(error))) => {
                let _ = window.destroy();
                return Err(error);
            }
            Ok(Err(_)) => {
                let _ = window.destroy();
                return Err("The OAuth certificate policy installer stopped unexpectedly.".into());
            }
            Err(_) => {
                let _ = window.destroy();
                return Err("Installing the OAuth certificate policy timed out.".into());
            }
        }
    }
    if let Err(error) = window.navigate(prepared.authorization_url.clone()) {
        let _ = window.destroy();
        return Err(error.to_string());
    }
    Ok(window)
}

async fn wait_for_embedded_redirect(
    window: &WebviewWindow,
    prepared: &PreparedAuthorization,
    mut receiver: mpsc::UnboundedReceiver<EmbeddedEvent>,
    cancellation: oneshot::Receiver<()>,
) -> Result<HashMap<String, String>, String> {
    let deadline = Instant::now() + AUTHORIZATION_TIMEOUT;
    tokio::pin!(cancellation);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("OAuth authorization timed out after five minutes.".into());
        }
        let event = tokio::select! {
            _ = &mut cancellation => return Err("OAuth authorization was canceled.".into()),
            result = timeout(remaining, receiver.recv()) => result
                .map_err(|_| "OAuth authorization timed out after five minutes.".to_string())?
                .ok_or_else(|| "The OAuth authorization window stopped unexpectedly.".to_string())?,
        };
        match event {
            EmbeddedEvent::Redirect(url) => {
                if let Some(result) = checked_redirect_parameters(
                    &prepared.redirect_url,
                    &url,
                    &prepared.expected_state,
                ) {
                    return result;
                }
            }
            EmbeddedEvent::Popup(url) => {
                if let Some(result) = checked_redirect_parameters(
                    &prepared.redirect_url,
                    &url,
                    &prepared.expected_state,
                ) {
                    return result;
                }
                window.navigate(url).map_err(|error| error.to_string())?;
            }
            EmbeddedEvent::Closed => {
                return Err("OAuth authorization window was closed.".into());
            }
        }
    }
}

async fn register_flow(
    input: &OAuthCallbackInput,
    state: &OAuthCallbackState,
) -> Result<oneshot::Receiver<()>, String> {
    validate_flow_id(&input.flow_id)?;
    let (cancel, cancellation) = oneshot::channel();
    let mut flows = state.flows.lock().await;
    if flows.contains_key(&input.flow_id) {
        return Err("This OAuth authorization flow is already running.".into());
    }
    flows.insert(input.flow_id.clone(), cancel);
    Ok(cancellation)
}

async fn authorize_with_opener<F, E>(
    input: OAuthCallbackInput,
    state: OAuthCallbackState,
    mut event: E,
    opener: F,
) -> Result<OAuthCallbackOutput, String>
where
    F: FnOnce(&str) -> Result<(), String>,
    E: FnMut(OAuthCallbackEvent) -> Result<(), String>,
{
    let mut cancellation = register_flow(&input, &state).await?;
    let prepared = tokio::select! {
        _ = &mut cancellation => {
            state.flows.lock().await.remove(&input.flow_id);
            return Err("OAuth authorization was canceled.".into());
        }
        result = prepare_callback(&input) => match result {
            Ok(prepared) => prepared,
            Err(error) => {
                state.flows.lock().await.remove(&input.flow_id);
                return Err(error);
            }
        },
    };
    if cancellation.try_recv().is_ok() {
        state.flows.lock().await.remove(&input.flow_id);
        return Err("OAuth authorization was canceled.".into());
    }
    let ready = OAuthCallbackEvent {
        kind: "ready".into(),
        browser_mode: "system".into(),
        authorization_url: prepared.authorization_url.clone(),
        redirect_url: prepared.redirect_url.clone(),
    };
    let started = event(ready).and_then(|_| opener(&prepared.authorization_url));
    if let Err(error) = started {
        state.flows.lock().await.remove(&input.flow_id);
        return Err(error);
    }
    let result = wait_for_callback(&prepared, cancellation).await;
    state.flows.lock().await.remove(&input.flow_id);
    result.map(|parameters| OAuthCallbackOutput {
        redirect_url: prepared.redirect_url,
        parameters,
    })
}

async fn authorize_in_window<E>(
    input: OAuthCallbackInput,
    app: AppHandle,
    state: OAuthCallbackState,
    mut event: E,
) -> Result<OAuthCallbackOutput, String>
where
    E: FnMut(OAuthCallbackEvent) -> Result<(), String>,
{
    let cancellation = register_flow(&input, &state).await?;
    let prepared = match prepare_authorization(&input) {
        Ok(prepared) => prepared,
        Err(error) => {
            state.flows.lock().await.remove(&input.flow_id);
            return Err(error);
        }
    };
    let (session_id, session_directory) = match oauth_session(&app, &state).await {
        Ok(session) => session,
        Err(error) => {
            state.flows.lock().await.remove(&input.flow_id);
            return Err(error);
        }
    };
    let (sender, receiver) = mpsc::unbounded_channel();
    let window = match build_embedded_window(
        &app,
        &input,
        &prepared,
        session_id,
        session_directory,
        sender,
    )
    .await
    {
        Ok(window) => window,
        Err(error) => {
            state.flows.lock().await.remove(&input.flow_id);
            return Err(error);
        }
    };
    let ready = OAuthCallbackEvent {
        kind: "ready".into(),
        browser_mode: "embedded".into(),
        authorization_url: prepared.authorization_url.to_string(),
        redirect_url: prepared.redirect_url.to_string(),
    };
    let result = match event(ready) {
        Ok(()) => wait_for_embedded_redirect(&window, &prepared, receiver, cancellation).await,
        Err(error) => Err(error),
    };
    let _ = window.destroy();
    state.flows.lock().await.remove(&input.flow_id);
    result.map(|parameters| OAuthCallbackOutput {
        redirect_url: prepared.redirect_url.to_string(),
        parameters,
    })
}

pub async fn authorize(
    input: OAuthCallbackInput,
    on_event: Channel<OAuthCallbackEvent>,
    app: AppHandle,
    state: OAuthCallbackState,
) -> Result<OAuthCallbackOutput, String> {
    if input.use_default_browser {
        authorize_with_opener(
            input,
            state,
            |event| on_event.send(event).map_err(|error| error.to_string()),
            crate::external_url::open,
        )
        .await
    } else {
        authorize_in_window(input, app, state, |event| {
            on_event.send(event).map_err(|error| error.to_string())
        })
        .await
    }
}

pub async fn cancel(flow_id: String, state: OAuthCallbackState) -> Result<(), String> {
    validate_flow_id(&flow_id)?;
    if let Some(cancel) = state.flows.lock().await.remove(&flow_id) {
        let _ = cancel.send(());
    }
    Ok(())
}

pub async fn clear_session(app: AppHandle, state: OAuthCallbackState) -> Result<(), String> {
    let path = session_id_path(&app)?;
    let session_id = Uuid::new_v4();
    write_session_id(&path, session_id)?;
    *state.session_id.lock().await = Some(session_id);
    *state.session_initialized.lock().await = true;
    Ok(())
}

pub async fn configure_session(
    app: AppHandle,
    clear_on_restart: bool,
    state: OAuthCallbackState,
) -> Result<(), String> {
    fs::write(
        session_restart_path(&app)?,
        if clear_on_restart { "true" } else { "false" },
    )
    .map_err(|error| error.to_string())?;
    let mut initialized = state.session_initialized.lock().await;
    if !*initialized {
        if clear_on_restart {
            let session_id = Uuid::new_v4();
            write_session_id(&session_id_path(&app)?, session_id)?;
            *state.session_id.lock().await = Some(session_id);
        }
        *initialized = true;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(state: &str) -> OAuthCallbackInput {
        OAuthCallbackInput {
            flow_id: "test-flow".into(),
            authorization_url: format!(
                "https://identity.example/authorize?client_id=test&response_type=code&state={state}"
            ),
            redirect_url: "http://127.0.0.1/callback".into(),
            use_default_browser: true,
            proxy_url: String::new(),
            proxy_exclusions: String::new(),
            validate_certificates: true,
            client_certificate_pem: String::new(),
            client_key_pem: String::new(),
            client_certificate_pfx_base64: String::new(),
            client_certificate_passphrase: String::new(),
        }
    }

    #[tokio::test]
    async fn captures_a_state_checked_authorization_code() {
        let state = OAuthCallbackState::default();
        let output = authorize_with_opener(
            input("expected"),
            state,
            |_| Ok(()),
            |authorization_url| {
                let authorization = Url::parse(authorization_url).unwrap();
                let redirect = authorization
                    .query_pairs()
                    .find(|(key, _)| key == "redirect_uri")
                    .unwrap()
                    .1
                    .into_owned();
                tokio::spawn(async move {
                    let redirect = Url::parse(&redirect).unwrap();
                    let mut stream = TcpStream::connect((
                        redirect.host_str().unwrap(),
                        redirect.port().unwrap(),
                    ))
                    .await
                    .unwrap();
                    stream
                        .write_all(b"GET /callback?code=abc123&state=expected HTTP/1.1\r\nHost: localhost\r\n\r\n")
                        .await
                        .unwrap();
                });
                Ok(())
            },
        )
        .await
        .unwrap();
        assert_eq!(output.parameters.get("code").unwrap(), "abc123");
        assert!(output.redirect_url.starts_with("http://127.0.0.1:"));
    }

    #[tokio::test]
    async fn rejects_non_loopback_system_redirects_and_missing_state() {
        let mut invalid = input("expected");
        invalid.redirect_url = "https://example.test/callback".into();
        assert!(prepare_callback(&invalid)
            .await
            .unwrap_err()
            .contains("loopback"));
        assert!(prepare_callback(&input(""))
            .await
            .unwrap_err()
            .contains("state"));
    }

    #[test]
    fn embedded_redirects_support_custom_schemes_queries_and_fragments() {
        let expected = Url::parse("brunomnia://oauth/callback?tenant=acme").unwrap();
        let code = Url::parse("brunomnia://oauth/callback?tenant=acme&code=abc123&state=expected")
            .unwrap();
        let implicit = Url::parse(
            "brunomnia://oauth/callback?tenant=acme#access_token=token-1&id_token=id-1&state=expected",
        )
        .unwrap();
        assert_eq!(
            checked_redirect_parameters(&expected, &code, "expected")
                .unwrap()
                .unwrap()
                .get("code")
                .map(String::as_str),
            Some("abc123")
        );
        let parameters = checked_redirect_parameters(&expected, &implicit, "expected")
            .unwrap()
            .unwrap();
        assert_eq!(
            parameters.get("access_token").map(String::as_str),
            Some("token-1")
        );
        assert_eq!(parameters.get("id_token").map(String::as_str), Some("id-1"));
    }

    #[test]
    fn embedded_redirect_matching_rejects_lookalikes_and_wrong_state() {
        let expected = Url::parse("https://client.example/oauth/callback").unwrap();
        let lookalike =
            Url::parse("https://client.example/oauth/callback.evil?code=abc&state=expected")
                .unwrap();
        let wrong_state =
            Url::parse("https://client.example/oauth/callback?code=abc&state=wrong").unwrap();
        assert!(checked_redirect_parameters(&expected, &lookalike, "expected").is_none());
        assert!(
            checked_redirect_parameters(&expected, &wrong_state, "expected")
                .unwrap()
                .unwrap_err()
                .contains("state")
        );
    }

    #[test]
    fn embedded_authorization_accepts_non_loopback_redirects() {
        let mut embedded = input("expected");
        embedded.use_default_browser = false;
        embedded.redirect_url = "com.example.app:/oauth/callback".into();
        assert_eq!(
            prepare_authorization(&embedded)
                .unwrap()
                .redirect_url
                .as_str(),
            "com.example.app:/oauth/callback"
        );
    }

    #[test]
    fn session_ids_are_strict_uuids() {
        let session_id = Uuid::new_v4();
        assert_eq!(
            session_id_from_text(&format!("  {session_id}\n")),
            Some(session_id)
        );
        assert_eq!(session_id_from_text("../../shared"), None);
    }

    #[test]
    fn session_ids_rotate_through_atomic_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(SESSION_ID_FILE);
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        write_session_id(&path, first).unwrap();
        assert_eq!(
            fs::read_to_string(&path)
                .ok()
                .and_then(|value| session_id_from_text(&value)),
            Some(first)
        );
        write_session_id(&path, second).unwrap();
        assert_eq!(
            fs::read_to_string(&path)
                .ok()
                .and_then(|value| session_id_from_text(&value)),
            Some(second)
        );
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[tokio::test]
    async fn cancellation_stops_a_pending_flow() {
        let state = OAuthCallbackState::default();
        let cancel_state = state.clone();
        let result = authorize_with_opener(
            input("expected"),
            state,
            |_| Ok(()),
            |_| {
                tokio::spawn(async move {
                    cancel("test-flow".into(), cancel_state).await.unwrap();
                });
                Ok(())
            },
        )
        .await;
        assert_eq!(result.unwrap_err(), "OAuth authorization was canceled.");
    }
}
