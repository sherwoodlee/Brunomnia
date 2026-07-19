use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    sync::Arc,
};
use tauri::ipc::Channel;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::{oneshot, Mutex},
    time::{timeout, Duration, Instant},
};
use url::Url;

const MAX_URL_BYTES: usize = 8_192;
const MAX_REQUEST_BYTES: usize = 16_384;
const MAX_FLOW_ID_BYTES: usize = 128;
const MAX_STATE_BYTES: usize = 1_024;
const AUTHORIZATION_TIMEOUT: Duration = Duration::from_secs(300);
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Default)]
pub struct OAuthCallbackState {
    flows: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackInput {
    pub flow_id: String,
    pub authorization_url: String,
    pub redirect_url: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackEvent {
    pub kind: String,
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
struct PreparedCallback {
    listener: TcpListener,
    authorization_url: String,
    redirect_url: String,
    callback_path: String,
    expected_state: String,
    response_type: String,
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

fn loopback_address(url: &Url) -> Result<IpAddr, String> {
    if url.scheme() != "http" || url.username() != "" || url.password().is_some() {
        return Err("Automatic OAuth callbacks require a plain HTTP loopback redirect URL.".into());
    }
    match url
        .host_str()
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "localhost" | "127.0.0.1" => Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)),
        "::1" | "[::1]" => Ok(IpAddr::V6(Ipv6Addr::LOCALHOST)),
        _ => Err("Automatic OAuth callbacks may bind only localhost, 127.0.0.1, or ::1.".into()),
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

async fn prepare(input: &OAuthCallbackInput) -> Result<PreparedCallback, String> {
    validate_flow_id(&input.flow_id)?;
    let mut authorization = bounded_url(&input.authorization_url, "authorization")?;
    if !matches!(authorization.scheme(), "http" | "https") {
        return Err("OAuth authorization URLs must use HTTP or HTTPS.".into());
    }
    let mut redirect = bounded_url(&input.redirect_url, "redirect")?;
    let address = loopback_address(&redirect)?;
    if redirect.fragment().is_some() {
        return Err("OAuth redirect URLs cannot contain a fragment.".into());
    }
    let expected_state = authorization
        .query_pairs()
        .find(|(key, _)| key == "state")
        .map(|(_, value)| value.into_owned())
        .unwrap_or_default();
    if expected_state.is_empty() || expected_state.len() > MAX_STATE_BYTES {
        return Err(
            "Automatic OAuth authorization requires a bounded non-empty state value.".into(),
        );
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
        expected_state,
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
        let parameters = callback
            .query_pairs()
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect::<HashMap<_, _>>();
        let has_response = parameters.contains_key("code")
            || parameters.contains_key("access_token")
            || parameters.contains_key("id_token")
            || parameters.contains_key("error");
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
    validate_flow_id(&input.flow_id)?;
    let (cancel, mut cancellation) = oneshot::channel();
    {
        let mut flows = state.flows.lock().await;
        if flows.contains_key(&input.flow_id) {
            return Err("This OAuth authorization flow is already running.".into());
        }
        flows.insert(input.flow_id.clone(), cancel);
    }
    let prepared = tokio::select! {
        _ = &mut cancellation => {
            state.flows.lock().await.remove(&input.flow_id);
            return Err("OAuth authorization was canceled.".into());
        }
        result = prepare(&input) => match result {
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

pub async fn authorize(
    input: OAuthCallbackInput,
    on_event: Channel<OAuthCallbackEvent>,
    state: OAuthCallbackState,
) -> Result<OAuthCallbackOutput, String> {
    authorize_with_opener(
        input,
        state,
        |event| on_event.send(event).map_err(|error| error.to_string()),
        crate::external_url::open,
    )
    .await
}

pub async fn cancel(flow_id: String, state: OAuthCallbackState) -> Result<(), String> {
    validate_flow_id(&flow_id)?;
    if let Some(cancel) = state.flows.lock().await.remove(&flow_id) {
        let _ = cancel.send(());
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
                    let mut stream = TcpStream::connect((redirect.host_str().unwrap(), redirect.port().unwrap()))
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
    async fn rejects_non_loopback_redirects_and_missing_state() {
        let mut invalid = input("expected");
        invalid.redirect_url = "https://example.test/callback".into();
        assert!(prepare(&invalid).await.unwrap_err().contains("loopback"));
        assert!(prepare(&input("")).await.unwrap_err().contains("state"));
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
