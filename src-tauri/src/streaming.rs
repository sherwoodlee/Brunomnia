use crate::{
    client_identity::{effective_client_identity_pem, validate_certificate_material},
    http_client::{apply_preferred_request_version, build_streaming_client, flatten_headers},
    models::{
        KeyValue, SocketIoConnectInput, StreamConnectInput, StreamConnectOutput, StreamEvent,
        TransportConfig,
    },
};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use rustls::{
    client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier},
    crypto::ring::default_provider,
    DigitallySignedStruct, Error as RustlsError, RootCertStore, SignatureScheme,
};
use rustls_pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer, ServerName, UnixTime};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Instant,
};
use tauri::ipc::Channel;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    net::TcpStream,
    sync::{mpsc, Mutex},
};
use tokio_tungstenite::{
    client_async_tls_with_config,
    tungstenite::{
        client::IntoClientRequest,
        handshake::client::Response as WebSocketResponse,
        http::{
            header::{
                AUTHORIZATION, CONNECTION, COOKIE, HOST, LOCATION, PROXY_AUTHORIZATION,
                SEC_WEBSOCKET_KEY, SEC_WEBSOCKET_PROTOCOL, SEC_WEBSOCKET_VERSION, UPGRADE,
            },
            HeaderMap, HeaderName, HeaderValue,
        },
        Error as WebSocketError, Message,
    },
    Connector, MaybeTlsStream, WebSocketStream,
};
use url::Url;

const MAX_SOCKET_IO_ARGS: usize = 100;
const MAX_SOCKET_IO_ATTACHMENTS: usize = 100;
const MAX_SOCKET_IO_EVENT_NAME_CHARS: usize = 500;
const MAX_SOCKET_IO_PACKET_BYTES: usize = 1_048_576;
const MAX_SOCKET_IO_LISTENERS: usize = 500;
const GRAPHQL_TRANSPORT_WS_PROTOCOL: &str = "graphql-transport-ws";
const MAX_GRAPHQL_SUBSCRIPTION_BYTES: usize = 1_048_576;
const MAX_PROXY_RESPONSE_BYTES: usize = 65_536;

trait WebSocketIo: AsyncRead + AsyncWrite + Send {}

impl<T> WebSocketIo for T where T: AsyncRead + AsyncWrite + Send {}

type BoxedWebSocketIo = Pin<Box<dyn WebSocketIo>>;
type SocketIoWebSocket = WebSocketStream<MaybeTlsStream<BoxedWebSocketIo>>;

struct ForwardProxyWrite {
    bytes: Vec<u8>,
    offset: usize,
    input_len: usize,
}

struct ForwardProxyStream {
    inner: BoxedWebSocketIo,
    absolute_url: String,
    pending: Option<ForwardProxyWrite>,
    forwarded: bool,
}

impl ForwardProxyStream {
    fn new(inner: BoxedWebSocketIo, absolute_url: String) -> Self {
        Self {
            inner,
            absolute_url,
            pending: None,
            forwarded: false,
        }
    }

    fn forward_request(&self, request: &[u8]) -> std::io::Result<Vec<u8>> {
        let header_end = request
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .map(|index| index + 4)
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "The WebSocket proxy request headers are incomplete.",
                )
            })?;
        let first_line_end = request
            .windows(2)
            .position(|window| window == b"\r\n")
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "The WebSocket proxy request line is invalid.",
                )
            })?;
        if !request[..first_line_end].starts_with(b"GET ") {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "The WebSocket proxy request must use GET.",
            ));
        }
        let mut forwarded = format!("GET {} HTTP/1.1\r\n", self.absolute_url).into_bytes();
        forwarded.extend_from_slice(&request[first_line_end + 2..header_end]);
        forwarded.extend_from_slice(&request[header_end..]);
        Ok(forwarded)
    }
}

impl AsyncRead for ForwardProxyStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        self.inner.as_mut().poll_read(context, buffer)
    }
}

impl AsyncWrite for ForwardProxyStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        if self.forwarded {
            return self.inner.as_mut().poll_write(context, buffer);
        }
        if self.pending.is_none() {
            let bytes = self.forward_request(buffer)?;
            self.pending = Some(ForwardProxyWrite {
                bytes,
                offset: 0,
                input_len: buffer.len(),
            });
        }
        loop {
            let Self { inner, pending, .. } = &mut *self;
            let pending = pending.as_mut().unwrap();
            match inner
                .as_mut()
                .poll_write(context, &pending.bytes[pending.offset..])
            {
                Poll::Ready(Ok(0)) => {
                    return Poll::Ready(Err(std::io::Error::new(
                        std::io::ErrorKind::WriteZero,
                        "The WebSocket proxy accepted no handshake bytes.",
                    )));
                }
                Poll::Ready(Ok(written)) => pending.offset += written,
                Poll::Ready(Err(error)) => return Poll::Ready(Err(error)),
                Poll::Pending => return Poll::Pending,
            }
            if pending.offset == pending.bytes.len() {
                let input_len = pending.input_len;
                self.pending = None;
                self.forwarded = true;
                return Poll::Ready(Ok(input_len));
            }
        }
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        context: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        self.inner.as_mut().poll_flush(context)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        context: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        self.inner.as_mut().poll_shutdown(context)
    }
}

enum WebSocketCommand {
    Text(String),
    Binary(Vec<u8>),
    Close,
}

enum SocketIoCommand {
    Emit {
        event_name: String,
        args: Vec<Value>,
        ack: bool,
    },
    AddListener(String),
    RemoveListener(String),
    Close,
}

#[derive(Debug, PartialEq)]
struct SocketIoEventPacket {
    namespace: String,
    event_name: String,
    args: Vec<Value>,
    ack_id: Option<u64>,
}

#[derive(Debug, PartialEq)]
enum SocketIoBinaryPacketKind {
    Event {
        event_name: String,
        args: Vec<Value>,
    },
    Ack {
        ack_id: u64,
        args: Vec<Value>,
    },
}

#[derive(Debug, PartialEq)]
struct PendingSocketIoBinaryPacket {
    namespace: String,
    expected_attachments: usize,
    attachments: Vec<Vec<u8>>,
    total_bytes: usize,
    kind: SocketIoBinaryPacketKind,
}

enum HydratedSocketIoBinaryPacket {
    Event {
        namespace: String,
        event_name: String,
        args: Vec<Value>,
    },
    Ack {
        namespace: String,
        ack_id: u64,
        args: Vec<Value>,
    },
}

#[derive(Debug)]
struct SocketIoTarget {
    base_url: Url,
    namespace: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EngineIoOpenPacket {
    sid: String,
    #[serde(default)]
    upgrades: Vec<String>,
    #[serde(default)]
    max_payload: Option<usize>,
}

struct SocketIoHttpResponse {
    status: u16,
    headers: std::collections::BTreeMap<String, String>,
    http_version: String,
    body: String,
}

enum ConnectedSocketIoTransport {
    WebSocket {
        socket: Box<SocketIoWebSocket>,
        status: u16,
        headers: std::collections::BTreeMap<String, String>,
        http_version: String,
    },
    Polling {
        transport: SocketIoPollingTransport,
        status: u16,
        headers: std::collections::BTreeMap<String, String>,
        http_version: String,
        upgrade_note: Option<String>,
    },
}

struct SocketIoPollingTransport {
    client: reqwest::Client,
    url: Url,
    headers: Vec<KeyValue>,
    max_payload: usize,
}

fn websocket_command(kind: &str, message: String) -> Result<WebSocketCommand, String> {
    if kind == "binary" {
        return STANDARD
            .decode(message.trim())
            .map(WebSocketCommand::Binary)
            .map_err(|error| format!("Binary WebSocket frames must be base64: {error}"));
    }
    Ok(WebSocketCommand::Text(message))
}

fn graphql_subscription_payload(payload: &str) -> Result<String, String> {
    if payload.len() > MAX_GRAPHQL_SUBSCRIPTION_BYTES {
        return Err("The GraphQL subscription payload exceeds 1 MB.".into());
    }
    let parsed = serde_json::from_str::<Value>(payload)
        .map_err(|error| format!("Unable to parse the GraphQL subscription: {error}"))?;
    if !parsed.is_object() {
        return Err("GraphQL subscription payloads must be JSON objects.".into());
    }
    Ok(payload.to_string())
}

fn graphql_subscribe_message(payload: &str) -> Result<String, String> {
    let id = serde_json::to_string(&uuid::Uuid::new_v4().to_string())
        .map_err(|error| format!("Unable to serialize the GraphQL operation ID: {error}"))?;
    Ok(format!(
        "{{\"id\":{id},\"type\":\"subscribe\",\"payload\":{payload}}}"
    ))
}

fn graphql_message_type(message: &str) -> Option<String> {
    serde_json::from_str::<Value>(message)
        .ok()?
        .get("type")?
        .as_str()
        .map(str::to_string)
}

#[derive(Debug)]
pub(crate) struct AcceptInvalidServerCertificate;

impl ServerCertVerifier for AcceptInvalidServerCertificate {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, RustlsError> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, RustlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, RustlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

fn native_root_store() -> Result<RootCertStore, String> {
    let loaded = rustls_native_certs::load_native_certs();
    if loaded.certs.is_empty() {
        return Err(format!(
            "No native root certificates were available: {:?}",
            loaded.errors
        ));
    }
    let mut roots = RootCertStore::empty();
    let (added, _) = roots.add_parsable_certificates(loaded.certs);
    if added == 0 {
        return Err("No native root certificates could be parsed.".into());
    }
    Ok(roots)
}

fn certificate_root_store(ca_certificate_pem: &str) -> Result<RootCertStore, String> {
    let mut roots = native_root_store()?;
    if ca_certificate_pem.trim().is_empty() {
        return Ok(roots);
    }
    let certificates = CertificateDer::pem_slice_iter(ca_certificate_pem.trim().as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Invalid CA certificate PEM: {error}"))?;
    if certificates.is_empty() {
        return Err("The CA certificate PEM contains no certificates.".into());
    }
    let (added, rejected) = roots.add_parsable_certificates(certificates);
    if added == 0 || rejected > 0 {
        return Err("The CA certificate PEM contains invalid certificates.".into());
    }
    Ok(roots)
}

fn websocket_tls_connector(
    transport: &TransportConfig,
    request_url: &str,
) -> Result<Option<Connector>, String> {
    validate_certificate_material(transport)?;
    let url = Url::parse(request_url).map_err(|error| format!("Invalid WebSocket URL: {error}"))?;
    if url.scheme() != "wss" {
        return Ok(None);
    }
    let identity = effective_client_identity_pem(transport, Some(request_url))?;
    if transport.validate_certificates
        && identity.is_none()
        && transport.ca_certificate_pem.trim().is_empty()
    {
        return Ok(None);
    }
    let builder = if transport.validate_certificates {
        rustls::ClientConfig::builder()
            .with_root_certificates(certificate_root_store(&transport.ca_certificate_pem)?)
    } else {
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(AcceptInvalidServerCertificate))
    };
    let config = if let Some(identity) = identity {
        let certificates = CertificateDer::pem_slice_iter(identity.certificate_pem.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Invalid client certificate: {error}"))?;
        if certificates.is_empty() {
            return Err("The client identity contains no certificates.".into());
        }
        let key = PrivateKeyDer::from_pem_slice(identity.private_key_pem.as_bytes())
            .map_err(|error| format!("Invalid client private key: {error}"))?;
        builder
            .with_client_auth_cert(certificates, key)
            .map_err(|error| format!("Invalid client identity: {error}"))?
    } else {
        builder.with_no_client_auth()
    };
    Ok(Some(Connector::Rustls(Arc::new(config))))
}

fn ip_matches_cidr(hostname: &str, pattern: &str) -> bool {
    let Some((network, prefix)) = pattern.split_once('/') else {
        return false;
    };
    let (Ok(host), Ok(network), Ok(prefix)) = (
        hostname.parse::<IpAddr>(),
        network.parse::<IpAddr>(),
        prefix.parse::<u8>(),
    ) else {
        return false;
    };
    match (host, network) {
        (IpAddr::V4(host), IpAddr::V4(network)) if prefix <= 32 => {
            let mask = if prefix == 0 {
                0
            } else {
                u32::MAX << (32 - prefix)
            };
            u32::from(host) & mask == u32::from(network) & mask
        }
        (IpAddr::V6(host), IpAddr::V6(network)) if prefix <= 128 => {
            let mask = if prefix == 0 {
                0
            } else {
                u128::MAX << (128 - prefix)
            };
            u128::from(host) & mask == u128::from(network) & mask
        }
        _ => false,
    }
}

fn url_hostname(url: &Url) -> Option<&str> {
    url.host_str()
        .map(|hostname| hostname.trim_matches(['[', ']']))
}

fn no_proxy_host_port(pattern: &str) -> (String, Option<u16>) {
    if pattern.contains("://") {
        if let Ok(url) = Url::parse(pattern) {
            return (
                url_hostname(&url).unwrap_or_default().to_ascii_lowercase(),
                url.port(),
            );
        }
    }
    if let Some(closing) = pattern.strip_prefix('[').and_then(|value| value.find(']')) {
        let host = &pattern[1..closing + 1];
        let port = pattern
            .get(closing + 2..)
            .and_then(|value| value.strip_prefix(':'))
            .and_then(|value| value.parse().ok());
        return (host.to_ascii_lowercase(), port);
    }
    if pattern.matches(':').count() == 1 {
        if let Some((host, port)) = pattern.rsplit_once(':') {
            if let Ok(port) = port.parse::<u16>() {
                return (host.to_ascii_lowercase(), Some(port));
            }
        }
    }
    (pattern.trim_matches(['[', ']']).to_ascii_lowercase(), None)
}

fn proxy_bypassed(exclusions: &str, target: &Url) -> bool {
    let Some(hostname) = url_hostname(target).map(str::to_ascii_lowercase) else {
        return false;
    };
    let port = target.port_or_known_default();
    exclusions.split([',', '\n']).any(|entry| {
        let entry = entry.trim();
        if entry.is_empty() {
            return false;
        }
        if entry == "*" {
            return true;
        }
        if ip_matches_cidr(&hostname, entry) {
            return true;
        }
        let (pattern, pattern_port) = no_proxy_host_port(entry);
        if pattern_port.is_some() && pattern_port != port {
            return false;
        }
        let suffix = pattern
            .strip_prefix("*.")
            .or_else(|| pattern.strip_prefix('.'))
            .unwrap_or(&pattern);
        hostname == suffix || hostname.ends_with(&format!(".{suffix}"))
    })
}

fn parse_proxy_url(raw_proxy_url: &str) -> Result<Url, String> {
    let raw_proxy_url = raw_proxy_url.trim();
    let normalized = if raw_proxy_url.contains("://") {
        raw_proxy_url.to_string()
    } else {
        format!("http://{raw_proxy_url}")
    };
    let proxy = Url::parse(&normalized).map_err(|error| format!("Invalid proxy URL: {error}"))?;
    if !matches!(proxy.scheme(), "http" | "https") {
        return Err("WebSocket proxies must use HTTP or HTTPS.".into());
    }
    if proxy.host_str().is_none() {
        return Err("The WebSocket proxy URL requires a hostname.".into());
    }
    Ok(proxy)
}

fn proxy_tls_config(transport: &TransportConfig) -> Result<Arc<rustls::ClientConfig>, String> {
    validate_certificate_material(transport)?;
    let builder = if transport.validate_certificates {
        rustls::ClientConfig::builder()
            .with_root_certificates(certificate_root_store(&transport.ca_certificate_pem)?)
    } else {
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(AcceptInvalidServerCertificate))
    };
    Ok(Arc::new(builder.with_no_client_auth()))
}

fn decode_proxy_userinfo(value: &str) -> Result<String, String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let encoded = bytes
                .get(index + 1..index + 3)
                .ok_or_else(|| "The proxy URL contains invalid percent encoding.".to_string())?;
            let encoded = std::str::from_utf8(encoded)
                .map_err(|_| "The proxy URL contains invalid percent encoding.".to_string())?;
            decoded.push(
                u8::from_str_radix(encoded, 16)
                    .map_err(|_| "The proxy URL contains invalid percent encoding.".to_string())?,
            );
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    let decoded = String::from_utf8(decoded)
        .map_err(|_| "The proxy URL credentials must be UTF-8.".to_string())?;
    if decoded.contains(['\r', '\n']) {
        return Err("The proxy URL credentials contain invalid control characters.".into());
    }
    Ok(decoded)
}

fn proxy_authorization(proxy: &Url) -> Result<Option<String>, String> {
    if proxy.username().is_empty() && proxy.password().unwrap_or_default().is_empty() {
        return Ok(None);
    }
    let credentials = format!(
        "{}:{}",
        decode_proxy_userinfo(proxy.username())?,
        decode_proxy_userinfo(proxy.password().unwrap_or_default())?
    );
    Ok(Some(format!("Basic {}", STANDARD.encode(credentials))))
}

async fn connect_websocket_tcp(
    hostname: &str,
    port: u16,
    timeout_ms: u64,
    context: &str,
) -> Result<TcpStream, String> {
    let connect = TcpStream::connect((hostname, port));
    let stream = if timeout_ms == 0 {
        connect.await
    } else {
        tokio::time::timeout(std::time::Duration::from_millis(timeout_ms), connect)
            .await
            .map_err(|_| format!("{context} timed out."))?
    }
    .map_err(|error| format!("{context} failed: {error}"))?;
    stream
        .set_nodelay(true)
        .map_err(|error| format!("Unable to configure the WebSocket socket: {error}"))?;
    Ok(stream)
}

fn websocket_authority(url: &Url) -> Result<String, String> {
    let hostname =
        url_hostname(url).ok_or_else(|| "The WebSocket URL requires a hostname.".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "The WebSocket URL requires a port.".to_string())?;
    if hostname.contains(':') {
        Ok(format!("[{hostname}]:{port}"))
    } else {
        Ok(format!("{hostname}:{port}"))
    }
}

fn forward_proxy_url(target: &Url) -> Result<String, String> {
    let hostname =
        url_hostname(target).ok_or_else(|| "The WebSocket URL requires a hostname.".to_string())?;
    let port = target
        .port_or_known_default()
        .ok_or_else(|| "The WebSocket URL requires a port.".to_string())?;
    let hostname = if hostname.contains(':') {
        format!("[{hostname}]")
    } else {
        hostname.to_string()
    };
    let authority = if port == 80 {
        hostname
    } else {
        format!("{hostname}:{port}")
    };
    let query = target
        .query()
        .map(|value| format!("?{value}"))
        .unwrap_or_default();
    Ok(format!("http://{authority}{}{query}", target.path()))
}

async fn establish_proxy_tunnel(
    stream: &mut BoxedWebSocketIo,
    proxy: &Url,
    target: &Url,
) -> Result<(), String> {
    let authority = websocket_authority(target)?;
    let authorization = proxy_authorization(proxy)?
        .map(|value| format!("Proxy-Authorization: {value}\r\n"))
        .unwrap_or_default();
    let request = format!(
        "CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\nProxy-Connection: Keep-Alive\r\n{authorization}\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|error| format!("Unable to write the WebSocket proxy tunnel request: {error}"))?;
    stream
        .flush()
        .await
        .map_err(|error| format!("Unable to flush the WebSocket proxy tunnel request: {error}"))?;

    let mut response = Vec::new();
    loop {
        let mut chunk = [0_u8; 1_024];
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|error| format!("Unable to read the WebSocket proxy response: {error}"))?;
        if read == 0 {
            return Err("The WebSocket proxy closed before establishing a tunnel.".into());
        }
        response.extend_from_slice(&chunk[..read]);
        if response.len() > MAX_PROXY_RESPONSE_BYTES {
            return Err("The WebSocket proxy response headers exceed 64 KiB.".into());
        }
        if response.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    let headers = String::from_utf8(response)
        .map_err(|_| "The WebSocket proxy returned non-UTF-8 response headers.".to_string())?;
    let status_line = headers
        .lines()
        .next()
        .ok_or_else(|| "The WebSocket proxy returned an empty response.".to_string())?;
    let mut status_parts = status_line.split_whitespace();
    let version = status_parts.next().unwrap_or_default();
    if !matches!(version, "HTTP/1.0" | "HTTP/1.1") {
        return Err("The WebSocket proxy returned an invalid HTTP status line.".into());
    }
    let status = status_parts
        .next()
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "The WebSocket proxy returned an invalid HTTP status.".to_string())?;
    if status != 200 {
        return Err(format!(
            "The WebSocket proxy refused the CONNECT tunnel with HTTP {status}."
        ));
    }
    Ok(())
}

async fn websocket_base_stream(
    transport: &TransportConfig,
    target: &Url,
) -> Result<(BoxedWebSocketIo, Option<Url>), String> {
    let target_host =
        url_hostname(target).ok_or_else(|| "The WebSocket URL requires a hostname.".to_string())?;
    let target_port = target
        .port_or_known_default()
        .ok_or_else(|| "The WebSocket URL requires a port.".to_string())?;
    if !matches!(transport.proxy_mode.as_str(), "" | "custom")
        || transport.proxy_url.trim().is_empty()
        || proxy_bypassed(&transport.proxy_exclusions, target)
    {
        let stream = connect_websocket_tcp(
            target_host,
            target_port,
            transport.timeout_ms,
            "WebSocket connection",
        )
        .await?;
        return Ok((Box::pin(stream), None));
    }

    let proxy = parse_proxy_url(&transport.proxy_url)?;
    let proxy_host = url_hostname(&proxy).unwrap();
    let proxy_port = proxy
        .port_or_known_default()
        .ok_or_else(|| "The WebSocket proxy URL requires a port.".to_string())?;
    let stream = connect_websocket_tcp(
        proxy_host,
        proxy_port,
        transport.timeout_ms,
        "WebSocket proxy connection",
    )
    .await?;
    let mut stream: BoxedWebSocketIo = if proxy.scheme() == "https" {
        let server_name = ServerName::try_from(proxy_host.to_string())
            .map_err(|_| "The WebSocket proxy has an invalid TLS hostname.".to_string())?;
        let connect = tokio_rustls::TlsConnector::from(proxy_tls_config(transport)?)
            .connect(server_name, stream);
        let stream = if transport.timeout_ms == 0 {
            connect.await
        } else {
            tokio::time::timeout(
                std::time::Duration::from_millis(transport.timeout_ms),
                connect,
            )
            .await
            .map_err(|_| "The WebSocket proxy TLS handshake timed out.".to_string())?
        }
        .map_err(|error| format!("The WebSocket proxy TLS handshake failed: {error}"))?;
        Box::pin(stream)
    } else {
        Box::pin(stream)
    };
    if target.scheme() == "ws" {
        return Ok((stream, Some(proxy)));
    }
    let tunnel = establish_proxy_tunnel(&mut stream, &proxy, target);
    if transport.timeout_ms == 0 {
        tunnel.await?;
    } else {
        tokio::time::timeout(
            std::time::Duration::from_millis(transport.timeout_ms),
            tunnel,
        )
        .await
        .map_err(|_| "The WebSocket proxy tunnel timed out.".to_string())??;
    }
    Ok((stream, None))
}

enum NativeWebSocketConnectError {
    Transport(String),
    Handshake(WebSocketError),
}

impl NativeWebSocketConnectError {
    fn message(self) -> String {
        match self {
            Self::Transport(message) => message,
            Self::Handshake(error) => error.to_string(),
        }
    }
}

fn websocket_redirect_headers(request: &http::Request<()>) -> HeaderMap {
    let mut headers = request.headers().clone();
    headers.remove(CONNECTION);
    headers.remove(UPGRADE);
    headers.remove(SEC_WEBSOCKET_KEY);
    headers.remove(SEC_WEBSOCKET_VERSION);
    headers.remove(PROXY_AUTHORIZATION);
    headers.remove(HeaderName::from_static("proxy-connection"));
    headers
}

fn websocket_request_for_url(url: &Url, headers: &HeaderMap) -> Result<http::Request<()>, String> {
    let mut request = url
        .as_str()
        .into_client_request()
        .map_err(|error| format!("Invalid redirected WebSocket URL: {error}"))?;
    for (name, value) in headers {
        request.headers_mut().insert(name, value.clone());
    }
    Ok(request)
}

fn websocket_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str().map(str::to_ascii_lowercase)
            == right.host_str().map(str::to_ascii_lowercase)
        && left.port_or_known_default() == right.port_or_known_default()
}

fn websocket_redirect_url(current: &Url, response: &WebSocketResponse) -> Result<Url, String> {
    let location = response
        .headers()
        .get(LOCATION)
        .ok_or_else(|| {
            format!(
                "WebSocket redirect HTTP {} has no Location header.",
                response.status()
            )
        })?
        .to_str()
        .map_err(|_| "The WebSocket redirect Location is not valid UTF-8.".to_string())?;
    let next = current
        .join(location)
        .map_err(|error| format!("Invalid WebSocket redirect Location: {error}"))?;
    if !matches!(next.scheme(), "ws" | "wss") {
        return Err("WebSocket redirects must use WS or WSS.".into());
    }
    Ok(next)
}

fn websocket_redirect_allowed(transport: &TransportConfig, followed: usize) -> bool {
    transport.follow_redirects
        && (transport.max_redirects < 0
            || followed < usize::try_from(transport.max_redirects).unwrap_or(usize::MAX))
}

async fn connect_native_websocket_once(
    mut request: http::Request<()>,
    transport: &TransportConfig,
    request_url: &str,
) -> Result<(SocketIoWebSocket, WebSocketResponse), NativeWebSocketConnectError> {
    let target = Url::parse(request_url).map_err(|error| {
        NativeWebSocketConnectError::Transport(format!("Invalid WebSocket URL: {error}"))
    })?;
    if !matches!(target.scheme(), "ws" | "wss") {
        return Err(NativeWebSocketConnectError::Transport(
            "WebSocket URLs must use WS or WSS.".into(),
        ));
    }
    let (stream, forward_proxy) = websocket_base_stream(transport, &target)
        .await
        .map_err(NativeWebSocketConnectError::Transport)?;
    let stream: BoxedWebSocketIo = if let Some(proxy) = forward_proxy {
        if let Some(authorization) =
            proxy_authorization(&proxy).map_err(NativeWebSocketConnectError::Transport)?
        {
            request.headers_mut().insert(
                HeaderName::from_static("proxy-authorization"),
                HeaderValue::from_str(&authorization).map_err(|error| {
                    NativeWebSocketConnectError::Transport(format!(
                        "Invalid proxy authorization header: {error}"
                    ))
                })?,
            );
        }
        request
            .headers_mut()
            .entry(HeaderName::from_static("proxy-connection"))
            .or_insert(HeaderValue::from_static("Keep-Alive"));
        Box::pin(ForwardProxyStream::new(
            stream,
            forward_proxy_url(&target).map_err(NativeWebSocketConnectError::Transport)?,
        ))
    } else {
        stream
    };
    let connector = websocket_tls_connector(transport, request_url)
        .map_err(NativeWebSocketConnectError::Transport)?;
    let connect = client_async_tls_with_config(request, stream, None, connector);
    if transport.timeout_ms == 0 {
        connect
            .await
            .map_err(NativeWebSocketConnectError::Handshake)
    } else {
        tokio::time::timeout(
            std::time::Duration::from_millis(transport.timeout_ms),
            connect,
        )
        .await
        .map_err(|_| {
            NativeWebSocketConnectError::Transport("The WebSocket handshake timed out.".into())
        })?
        .map_err(NativeWebSocketConnectError::Handshake)
    }
}

async fn connect_native_websocket(
    request: http::Request<()>,
    transport: &TransportConfig,
    request_url: &str,
) -> Result<(SocketIoWebSocket, WebSocketResponse), String> {
    let mut current_url =
        Url::parse(request_url).map_err(|error| format!("Invalid WebSocket URL: {error}"))?;
    if !matches!(current_url.scheme(), "ws" | "wss") {
        return Err("WebSocket URLs must use WS or WSS.".into());
    }
    let mut headers = websocket_redirect_headers(&request);
    let mut current_request = request;
    let mut followed = 0_usize;
    loop {
        match connect_native_websocket_once(current_request, transport, current_url.as_str()).await
        {
            Ok(connected) => return Ok(connected),
            Err(NativeWebSocketConnectError::Handshake(WebSocketError::Http(response)))
                if response.status().is_redirection() =>
            {
                if !websocket_redirect_allowed(transport, followed) {
                    if !transport.follow_redirects {
                        return Err(format!(
                            "WebSocket redirect HTTP {} was not followed because redirects are disabled.",
                            response.status()
                        ));
                    }
                    return Err(format!(
                        "WebSocket redirect limit of {} was exceeded.",
                        transport.max_redirects
                    ));
                }
                let next_url = websocket_redirect_url(&current_url, &response)?;
                if !websocket_same_origin(&current_url, &next_url) {
                    headers.remove(HOST);
                    headers.remove(AUTHORIZATION);
                    headers.remove(COOKIE);
                }
                current_url = next_url;
                current_request = websocket_request_for_url(&current_url, &headers)?;
                followed = followed.saturating_add(1);
            }
            Err(error) => return Err(error.message()),
        }
    }
}

#[derive(Clone, Default)]
pub struct StreamingState {
    websocket_sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<WebSocketCommand>>>>,
    socket_io_sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<SocketIoCommand>>>>,
    sse_sessions: Arc<Mutex<HashMap<String, mpsc::UnboundedSender<()>>>>,
}

fn socket_io_target(raw_url: &str, path: &str) -> Result<SocketIoTarget, String> {
    let mut url = Url::parse(raw_url).map_err(|error| format!("Invalid Socket.IO URL: {error}"))?;
    let scheme = match url.scheme() {
        "http" | "ws" => "http",
        "https" | "wss" => "https",
        _ => return Err("Socket.IO URLs must use HTTP(S) or WS(S).".into()),
    };
    url.set_scheme(scheme)
        .map_err(|_| "The Socket.IO URL scheme is invalid.".to_string())?;
    let namespace = match url.path().trim_end_matches('/') {
        "" => "/".to_string(),
        value => value.to_string(),
    };
    let mut handshake_path = path.trim().to_string();
    if handshake_path.is_empty() {
        handshake_path = "/socket.io/".into();
    } else {
        if !handshake_path.starts_with('/') {
            handshake_path.insert(0, '/');
        }
        if !handshake_path.ends_with('/') {
            handshake_path.push('/');
        }
    }
    if handshake_path.len() > 2_048 {
        return Err("The Socket.IO handshake path is too long.".into());
    }
    let query = url
        .query_pairs()
        .filter(|(name, _)| !matches!(name.as_ref(), "EIO" | "transport" | "sid" | "t"))
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    url.set_path(&handshake_path);
    url.set_query(None);
    let mut pairs = url.query_pairs_mut();
    for (name, value) in query {
        pairs.append_pair(&name, &value);
    }
    drop(pairs);
    Ok(SocketIoTarget {
        base_url: url,
        namespace,
    })
}

fn socket_io_transport_url(
    target: &SocketIoTarget,
    transport: &str,
    sid: Option<&str>,
) -> Result<Url, String> {
    let mut url = target.base_url.clone();
    let scheme = match (url.scheme(), transport) {
        ("http", "polling") => "http",
        ("https", "polling") => "https",
        ("http", "websocket") => "ws",
        ("https", "websocket") => "wss",
        _ => return Err("Unsupported Engine.IO transport.".into()),
    };
    url.set_scheme(scheme)
        .map_err(|_| "The Engine.IO transport URL scheme is invalid.".to_string())?;
    {
        let mut pairs = url.query_pairs_mut();
        pairs.append_pair("EIO", "4");
        pairs.append_pair("transport", transport);
        if let Some(sid) = sid {
            pairs.append_pair("sid", sid);
        }
    }
    Ok(url)
}

fn socket_io_packet_payload(packet: &str, packet_type: char) -> Option<(String, &str)> {
    let mut chars = packet.chars();
    if chars.next()? != '4' || chars.next()? != packet_type {
        return None;
    }
    let remainder = &packet[2..];
    if remainder.starts_with('/') {
        let separator = remainder.find(',')?;
        Some((
            remainder[..separator].to_string(),
            &remainder[separator + 1..],
        ))
    } else {
        Some(("/".into(), remainder))
    }
}

fn split_socket_io_ack_id(payload: &str) -> (Option<u64>, &str) {
    let length = payload.bytes().take_while(u8::is_ascii_digit).count();
    if length == 0 {
        return (None, payload);
    }
    (payload[..length].parse().ok(), &payload[length..])
}

fn parse_socket_io_event(packet: &str) -> Option<SocketIoEventPacket> {
    let (namespace, payload) = socket_io_packet_payload(packet, '2')?;
    let (ack_id, payload) = split_socket_io_ack_id(payload);
    let values = serde_json::from_str::<Vec<Value>>(payload).ok()?;
    let event_name = values.first()?.as_str()?.to_string();
    Some(SocketIoEventPacket {
        namespace,
        event_name,
        args: values.into_iter().skip(1).collect(),
        ack_id,
    })
}

fn parse_socket_io_ack(packet: &str) -> Option<(String, u64, Vec<Value>)> {
    let (namespace, payload) = socket_io_packet_payload(packet, '3')?;
    let (ack_id, payload) = split_socket_io_ack_id(payload);
    Some((
        namespace,
        ack_id?,
        serde_json::from_str::<Vec<Value>>(payload).ok()?,
    ))
}

fn parse_socket_io_binary_packet(
    packet: &str,
) -> Result<Option<PendingSocketIoBinaryPacket>, String> {
    let packet_type = match packet.as_bytes() {
        [b'4', packet_type @ (b'5' | b'6'), ..] => *packet_type,
        _ => return Ok(None),
    };
    let remainder = &packet[2..];
    let count_end = remainder
        .find('-')
        .ok_or_else(|| "A Socket.IO binary packet is missing its attachment count.".to_string())?;
    let expected_attachments = remainder[..count_end]
        .parse::<usize>()
        .map_err(|_| "The Socket.IO binary attachment count is invalid.".to_string())?;
    if expected_attachments == 0 || expected_attachments > MAX_SOCKET_IO_ATTACHMENTS {
        return Err(format!(
            "Socket.IO binary packets accept 1 to {MAX_SOCKET_IO_ATTACHMENTS} attachments."
        ));
    }
    let remainder = &remainder[count_end + 1..];
    let (namespace, payload) = if remainder.starts_with('/') {
        let separator = remainder
            .find(',')
            .ok_or_else(|| "A namespaced Socket.IO binary packet is malformed.".to_string())?;
        (
            remainder[..separator].to_string(),
            &remainder[separator + 1..],
        )
    } else {
        ("/".into(), remainder)
    };
    let (ack_id, payload) = split_socket_io_ack_id(payload);
    let mut values = serde_json::from_str::<Vec<Value>>(payload)
        .map_err(|error| format!("Invalid Socket.IO binary packet payload: {error}"))?;
    let kind = if packet_type == b'5' {
        let event_name = values
            .first()
            .and_then(Value::as_str)
            .ok_or_else(|| "A Socket.IO binary event requires an event name.".to_string())?
            .to_string();
        values.remove(0);
        SocketIoBinaryPacketKind::Event {
            event_name,
            args: values,
        }
    } else {
        SocketIoBinaryPacketKind::Ack {
            ack_id: ack_id
                .ok_or_else(|| "A Socket.IO binary acknowledgement requires an ID.".to_string())?,
            args: values,
        }
    };
    Ok(Some(PendingSocketIoBinaryPacket {
        namespace,
        expected_attachments,
        attachments: Vec::with_capacity(expected_attachments),
        total_bytes: 0,
        kind,
    }))
}

fn hydrate_socket_io_binary_value(
    value: &mut Value,
    attachments: &[Vec<u8>],
) -> Result<(), String> {
    match value {
        Value::Array(values) => {
            for value in values {
                hydrate_socket_io_binary_value(value, attachments)?;
            }
        }
        Value::Object(object) => {
            if object.get("_placeholder").and_then(Value::as_bool) == Some(true) {
                let index = object
                    .get("num")
                    .and_then(Value::as_u64)
                    .and_then(|index| usize::try_from(index).ok())
                    .ok_or_else(|| {
                        "A Socket.IO binary placeholder index is invalid.".to_string()
                    })?;
                let bytes = attachments.get(index).ok_or_else(|| {
                    "A Socket.IO binary placeholder references a missing attachment.".to_string()
                })?;
                *value = serde_json::json!({ "type": "Buffer", "data": bytes });
            } else {
                for value in object.values_mut() {
                    hydrate_socket_io_binary_value(value, attachments)?;
                }
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
    Ok(())
}

fn hydrate_socket_io_binary_packet(
    mut packet: PendingSocketIoBinaryPacket,
) -> Result<HydratedSocketIoBinaryPacket, String> {
    if packet.attachments.len() != packet.expected_attachments {
        return Err("The Socket.IO binary packet is missing attachments.".into());
    }
    match &mut packet.kind {
        SocketIoBinaryPacketKind::Event { args, .. }
        | SocketIoBinaryPacketKind::Ack { args, .. } => {
            for value in args.iter_mut() {
                hydrate_socket_io_binary_value(value, &packet.attachments)?;
            }
        }
    }
    Ok(match packet.kind {
        SocketIoBinaryPacketKind::Event { event_name, args } => {
            HydratedSocketIoBinaryPacket::Event {
                namespace: packet.namespace,
                event_name,
                args,
            }
        }
        SocketIoBinaryPacketKind::Ack { ack_id, args } => HydratedSocketIoBinaryPacket::Ack {
            namespace: packet.namespace,
            ack_id,
            args,
        },
    })
}

fn validate_socket_io_event_name(event_name: &str) -> Result<(), String> {
    let length = event_name.chars().count();
    if length == 0 || length > MAX_SOCKET_IO_EVENT_NAME_CHARS {
        return Err(format!(
            "Socket.IO event names must contain 1 to {MAX_SOCKET_IO_EVENT_NAME_CHARS} characters."
        ));
    }
    Ok(())
}

fn socket_io_connect_packet(namespace: &str, auth_token: &str) -> Result<String, String> {
    if auth_token.len() > MAX_SOCKET_IO_PACKET_BYTES / 2 {
        return Err("The Socket.IO authentication token is too large.".into());
    }
    let auth = if auth_token.is_empty() {
        String::new()
    } else {
        serde_json::json!({ "token": auth_token }).to_string()
    };
    Ok(if namespace == "/" {
        format!("40{auth}")
    } else {
        format!("40{namespace},{auth}")
    })
}

fn socket_io_disconnect_packet(namespace: &str) -> String {
    if namespace == "/" {
        "41".into()
    } else {
        format!("41{namespace},")
    }
}

fn socket_io_event_packet(
    namespace: &str,
    event_name: &str,
    args: &[Value],
    ack_id: Option<u64>,
) -> Result<String, String> {
    validate_socket_io_event_name(event_name)?;
    if args.len() > MAX_SOCKET_IO_ARGS {
        return Err(format!(
            "Socket.IO events accept at most {MAX_SOCKET_IO_ARGS} arguments."
        ));
    }
    let payload = serde_json::to_string(
        &std::iter::once(Value::String(event_name.to_string()))
            .chain(args.iter().cloned())
            .collect::<Vec<_>>(),
    )
    .map_err(|error| error.to_string())?;
    let packet = if namespace == "/" {
        format!(
            "42{}{payload}",
            ack_id.map(|id| id.to_string()).unwrap_or_default()
        )
    } else {
        format!(
            "42{namespace},{}{payload}",
            ack_id.map(|id| id.to_string()).unwrap_or_default()
        )
    };
    if packet.len() > MAX_SOCKET_IO_PACKET_BYTES {
        return Err("The Socket.IO event packet exceeds 1 MiB.".into());
    }
    Ok(packet)
}

async fn socket_io_http_request(
    client: &reqwest::Client,
    url: &Url,
    headers: &[KeyValue],
    body: Option<&str>,
) -> Result<SocketIoHttpResponse, String> {
    if body.is_some_and(|body| body.len() > MAX_SOCKET_IO_PACKET_BYTES) {
        return Err("The Engine.IO polling payload exceeds 1 MiB.".into());
    }
    let mut request_url = url.clone();
    request_url
        .query_pairs_mut()
        .append_pair("t", &uuid::Uuid::new_v4().simple().to_string());
    let mut request = if let Some(body) = body {
        client
            .post(request_url)
            .header("content-type", "text/plain; charset=UTF-8")
            .body(body.to_string())
    } else {
        client.get(request_url)
    };
    for header in headers.iter().filter(|header| header.enabled) {
        request = request.header(&header.name, &header.value);
    }
    let response = request
        .send()
        .await
        .map_err(|error| format!("Engine.IO polling request failed: {error}"))?;
    let status = response.status();
    let headers = flatten_headers(response.headers());
    let http_version = format!("{:?}", response.version());
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|error| format!("Unable to read Engine.IO polling data: {error}"))?;
        if bytes.len().saturating_add(chunk.len()) > MAX_SOCKET_IO_PACKET_BYTES {
            return Err("The Engine.IO polling response exceeds 1 MiB.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8(bytes)
        .map_err(|_| "Engine.IO polling responses must be UTF-8 text.".to_string())?;
    if !status.is_success() {
        return Err(format!(
            "Engine.IO polling returned HTTP {status}: {}",
            body.trim()
        ));
    }
    Ok(SocketIoHttpResponse {
        status: status.as_u16(),
        headers,
        http_version,
        body,
    })
}

fn parse_engine_io_open(payload: &str) -> Result<EngineIoOpenPacket, String> {
    let packet = payload
        .split('\u{001e}')
        .find(|packet| packet.starts_with('0'))
        .ok_or_else(|| "Engine.IO polling did not return an open packet.".to_string())?;
    let open = serde_json::from_str::<EngineIoOpenPacket>(&packet[1..])
        .map_err(|error| format!("Invalid Engine.IO open packet: {error}"))?;
    if open.sid.is_empty() || open.sid.len() > 2_048 {
        return Err("The Engine.IO session ID is invalid.".into());
    }
    Ok(open)
}

async fn try_socket_io_websocket_upgrade(
    target: &SocketIoTarget,
    sid: &str,
    headers: &[KeyValue],
    transport: &TransportConfig,
) -> Result<(SocketIoWebSocket, u16), String> {
    let url = socket_io_transport_url(target, "websocket", Some(sid))?;
    let mut request = url
        .as_str()
        .into_client_request()
        .map_err(|error| format!("Invalid Engine.IO WebSocket upgrade URL: {error}"))?;
    for header in headers.iter().filter(|header| header.enabled) {
        let name = header
            .name
            .parse::<http::HeaderName>()
            .map_err(|error| format!("Invalid Socket.IO header name: {error}"))?;
        let value = header
            .value
            .parse::<http::HeaderValue>()
            .map_err(|error| format!("Invalid Socket.IO header value: {error}"))?;
        request.headers_mut().append(name, value);
    }
    let (mut socket, response) = connect_native_websocket(request, transport, url.as_str())
        .await
        .map_err(|error| format!("Engine.IO WebSocket upgrade failed: {error}"))?;
    socket
        .send(Message::Text("2probe".into()))
        .await
        .map_err(|error| format!("Unable to probe the Engine.IO WebSocket: {error}"))?;
    for _ in 0..32 {
        let message = socket
            .next()
            .await
            .ok_or_else(|| "Engine.IO closed during the WebSocket probe.".to_string())?
            .map_err(|error| format!("Engine.IO WebSocket probe failed: {error}"))?;
        match message {
            Message::Text(text) if text == "3probe" => {
                socket
                    .send(Message::Text("5".into()))
                    .await
                    .map_err(|error| {
                        format!("Unable to complete the Engine.IO upgrade: {error}")
                    })?;
                return Ok((socket, response.status().as_u16()));
            }
            Message::Text(text) if text == "2" => {
                socket
                    .send(Message::Text("3".into()))
                    .await
                    .map_err(|error| {
                        format!("Unable to answer the Engine.IO heartbeat: {error}")
                    })?;
            }
            Message::Ping(payload) => {
                socket.send(Message::Pong(payload)).await.map_err(|error| {
                    format!("Unable to answer the WebSocket heartbeat: {error}")
                })?;
            }
            Message::Close(frame) => {
                return Err(frame
                    .map(|frame| frame.reason.to_string())
                    .unwrap_or_else(|| "Engine.IO closed during the WebSocket probe.".into()));
            }
            Message::Text(_) | Message::Binary(_) | Message::Pong(_) | Message::Frame(_) => {}
        }
    }
    Err("Engine.IO did not confirm the WebSocket probe.".into())
}

async fn join_socket_io_websocket_namespace(
    socket: &mut SocketIoWebSocket,
    namespace: &str,
    connect_packet: &str,
) -> Result<(), String> {
    socket
        .send(Message::Text(connect_packet.to_string().into()))
        .await
        .map_err(|error| format!("Unable to join the Socket.IO namespace: {error}"))?;
    for _ in 0..32 {
        let message = socket
            .next()
            .await
            .ok_or_else(|| "Socket.IO closed during the namespace handshake.".to_string())?
            .map_err(|error| format!("Socket.IO namespace handshake failed: {error}"))?;
        match message {
            Message::Text(text) if text == "2" => {
                socket
                    .send(Message::Text("3".into()))
                    .await
                    .map_err(|error| {
                        format!("Unable to answer the Engine.IO heartbeat: {error}")
                    })?;
            }
            Message::Text(text) => {
                if let Some((connected_namespace, _)) = socket_io_packet_payload(&text, '0') {
                    if connected_namespace == namespace {
                        return Ok(());
                    }
                } else if let Some((failed_namespace, payload)) =
                    socket_io_packet_payload(&text, '4')
                {
                    if failed_namespace == namespace {
                        return Err(format!("Socket.IO namespace connection failed: {payload}"));
                    }
                } else if text == "1" {
                    return Err("Engine.IO closed during the Socket.IO handshake.".into());
                }
            }
            Message::Ping(payload) => {
                socket.send(Message::Pong(payload)).await.map_err(|error| {
                    format!("Unable to answer the WebSocket heartbeat: {error}")
                })?;
            }
            Message::Close(frame) => {
                return Err(frame
                    .map(|frame| frame.reason.to_string())
                    .unwrap_or_else(|| "Socket.IO closed during the namespace handshake.".into()));
            }
            Message::Binary(_) | Message::Pong(_) | Message::Frame(_) => {}
        }
    }
    Err("Socket.IO did not confirm the namespace connection.".into())
}

async fn join_socket_io_polling_namespace(
    client: &reqwest::Client,
    url: &Url,
    headers: &[KeyValue],
    namespace: &str,
    connect_packet: &str,
) -> Result<(), String> {
    socket_io_http_request(client, url, headers, Some(connect_packet)).await?;
    for _ in 0..32 {
        let response = socket_io_http_request(client, url, headers, None).await?;
        for packet in response.body.split('\u{001e}') {
            if packet == "2" {
                socket_io_http_request(client, url, headers, Some("3")).await?;
            } else if let Some((connected_namespace, _)) = socket_io_packet_payload(packet, '0') {
                if connected_namespace == namespace {
                    return Ok(());
                }
            } else if let Some((failed_namespace, payload)) = socket_io_packet_payload(packet, '4')
            {
                if failed_namespace == namespace {
                    return Err(format!("Socket.IO namespace connection failed: {payload}"));
                }
            } else if packet == "1" {
                return Err("Engine.IO closed during the Socket.IO handshake.".into());
            }
        }
    }
    Err("Socket.IO did not confirm the namespace connection.".into())
}

async fn establish_socket_io_transport(
    input: &SocketIoConnectInput,
) -> Result<(String, ConnectedSocketIoTransport), String> {
    let target = socket_io_target(&input.url, &input.path)?;
    let client = build_streaming_client(&input.transport, Some(&input.url))?;
    let open_url = socket_io_transport_url(&target, "polling", None)?;
    let open_response = socket_io_http_request(&client, &open_url, &input.headers, None).await?;
    let open = parse_engine_io_open(&open_response.body)?;
    let polling_url = socket_io_transport_url(&target, "polling", Some(&open.sid))?;
    let connect_packet = socket_io_connect_packet(&target.namespace, &input.auth_token)?;
    let mut upgrade_note = None;
    if open.upgrades.iter().any(|upgrade| upgrade == "websocket") {
        match try_socket_io_websocket_upgrade(&target, &open.sid, &input.headers, &input.transport)
            .await
        {
            Ok((mut socket, status)) => {
                join_socket_io_websocket_namespace(&mut socket, &target.namespace, &connect_packet)
                    .await?;
                return Ok((
                    target.namespace,
                    ConnectedSocketIoTransport::WebSocket {
                        socket: Box::new(socket),
                        status,
                        headers: open_response.headers,
                        http_version: open_response.http_version,
                    },
                ));
            }
            Err(error) => upgrade_note = Some(error),
        }
    }
    join_socket_io_polling_namespace(
        &client,
        &polling_url,
        &input.headers,
        &target.namespace,
        &connect_packet,
    )
    .await?;
    Ok((
        target.namespace,
        ConnectedSocketIoTransport::Polling {
            transport: SocketIoPollingTransport {
                client,
                url: polling_url,
                headers: input.headers.clone(),
                max_payload: open
                    .max_payload
                    .unwrap_or(MAX_SOCKET_IO_PACKET_BYTES)
                    .clamp(1, MAX_SOCKET_IO_PACKET_BYTES),
            },
            status: open_response.status,
            headers: open_response.headers,
            http_version: open_response.http_version,
            upgrade_note,
        },
    ))
}

pub async fn connect_websocket(
    input: StreamConnectInput,
    on_event: Channel<StreamEvent>,
    state: StreamingState,
) -> Result<StreamConnectOutput, String> {
    if state
        .websocket_sessions
        .lock()
        .await
        .contains_key(&input.session_id)
    {
        return Err("This WebSocket session is already connected.".into());
    }

    let graphql_payload = input
        .graphql_subscription
        .as_ref()
        .map(|payload| graphql_subscription_payload(payload))
        .transpose()?;
    let mut request = input
        .url
        .as_str()
        .into_client_request()
        .map_err(|error| format!("Invalid WebSocket URL: {error}"))?;
    for header in input.headers.into_iter().filter(|header| header.enabled) {
        let name = header
            .name
            .parse::<http::HeaderName>()
            .map_err(|error| format!("Invalid WebSocket header name: {error}"))?;
        let value = header
            .value
            .parse::<http::HeaderValue>()
            .map_err(|error| format!("Invalid WebSocket header value: {error}"))?;
        request.headers_mut().insert(name, value);
    }
    if graphql_payload.is_some() {
        request.headers_mut().insert(
            SEC_WEBSOCKET_PROTOCOL,
            HeaderValue::from_static(GRAPHQL_TRANSPORT_WS_PROTOCOL),
        );
    }

    let started = Instant::now();
    let (socket, response) = connect_native_websocket(request, &input.transport, &input.url)
        .await
        .map_err(|error| format!("WebSocket connection failed: {error}"))?;
    let status = response.status();
    let output = StreamConnectOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers: flatten_headers(response.headers()),
        http_version: format!("{:?}", response.version()),
        duration_ms: started.elapsed().as_millis(),
        transport: "WebSocket".into(),
    };
    let (sender, mut receiver) = mpsc::unbounded_channel();
    state
        .websocket_sessions
        .lock()
        .await
        .insert(input.session_id.clone(), sender);

    let session_id = input.session_id.clone();
    let sessions = state.websocket_sessions.clone();
    let _ = on_event.send(StreamEvent::system(
        &session_id,
        "open",
        format!("Connected · HTTP {status}"),
    ));

    tokio::spawn(async move {
        let mut socket = socket;
        if graphql_payload.is_some() {
            let connection_init = r#"{"type":"connection_init"}"#.to_string();
            if let Err(error) = socket
                .send(Message::Text(connection_init.clone().into()))
                .await
            {
                let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                sessions.lock().await.remove(&session_id);
                let _ = on_event.send(StreamEvent::system(&session_id, "closed", "Disconnected"));
                return;
            }
            let _ = on_event.send(StreamEvent::outgoing(
                &session_id,
                "connection_init",
                connection_init,
            ));
        }
        loop {
            tokio::select! {
                command = receiver.recv() => {
                    match command {
                        Some(WebSocketCommand::Text(text)) => {
                            match socket.send(Message::Text(text.clone().into())).await {
                                Ok(()) => { let _ = on_event.send(StreamEvent::outgoing(&session_id, "text", text)); }
                                Err(error) => {
                                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                                    break;
                                }
                            }
                        }
                        Some(WebSocketCommand::Binary(bytes)) => {
                            let encoded = STANDARD.encode(&bytes);
                            match socket.send(Message::Binary(bytes.clone().into())).await {
                                Ok(()) => { let _ = on_event.send(StreamEvent::outgoing(&session_id, "binary", encoded)); }
                                Err(error) => {
                                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                                    break;
                                }
                            }
                        }
                        Some(WebSocketCommand::Close) | None => {
                            let _ = socket.close(None).await;
                            break;
                        }
                    }
                }
                message = socket.next() => {
                    match message {
                        Some(Ok(Message::Text(text))) => {
                            let text = text.to_string();
                            let graphql_type = graphql_payload
                                .as_ref()
                                .and_then(|_| graphql_message_type(&text));
                            let _ = on_event.send(StreamEvent::incoming(
                                &session_id,
                                graphql_type.as_deref().unwrap_or("text"),
                                text,
                            ));
                            if graphql_type.as_deref() == Some("connection_ack") {
                                let subscribe = match graphql_subscribe_message(graphql_payload.as_ref().unwrap()) {
                                    Ok(subscribe) => subscribe,
                                    Err(error) => {
                                        let _ = on_event.send(StreamEvent::system(&session_id, "error", error));
                                        break;
                                    }
                                };
                                match socket.send(Message::Text(subscribe.clone().into())).await {
                                    Ok(()) => {
                                        let _ = on_event.send(StreamEvent::outgoing(
                                            &session_id,
                                            "subscribe",
                                            subscribe.clone(),
                                        ));
                                    }
                                    Err(error) => {
                                        let _ = on_event.send(StreamEvent::system(
                                            &session_id,
                                            "error",
                                            error.to_string(),
                                        ));
                                        break;
                                    }
                                }
                            } else if matches!(graphql_type.as_deref(), Some("error" | "complete")) {
                                let _ = socket.close(None).await;
                                break;
                            }
                        }
                        Some(Ok(Message::Binary(bytes))) => {
                            let _ = on_event.send(StreamEvent::incoming(
                                &session_id,
                                "binary",
                                STANDARD.encode(&bytes),
                            ));
                        }
                        Some(Ok(Message::Ping(_))) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "ping", "Ping received"));
                        }
                        Some(Ok(Message::Pong(_))) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "pong", "Pong received"));
                        }
                        Some(Ok(Message::Close(frame))) => {
                            let reason = frame.map(|frame| frame.reason.to_string()).unwrap_or_else(|| "Remote peer closed the connection".into());
                            let _ = on_event.send(StreamEvent::system(&session_id, "close", reason));
                            break;
                        }
                        Some(Ok(Message::Frame(_))) => {}
                        Some(Err(error)) => {
                            let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                            break;
                        }
                        None => break,
                    }
                }
            }
        }
        sessions.lock().await.remove(&session_id);
        let _ = on_event.send(StreamEvent::system(&session_id, "closed", "Disconnected"));
    });
    Ok(output)
}

pub async fn send_websocket_message(
    session_id: String,
    message: String,
    kind: String,
    state: StreamingState,
) -> Result<(), String> {
    let sender = state
        .websocket_sessions
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Connect the WebSocket before sending a message.".to_string())?;
    let command = websocket_command(&kind, message)?;
    sender
        .send(command)
        .map_err(|_| "The WebSocket session has ended.".to_string())
}

pub async fn disconnect_websocket(session_id: String, state: StreamingState) -> Result<(), String> {
    let sender = state
        .websocket_sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "The WebSocket is not connected.".to_string())?;
    sender
        .send(WebSocketCommand::Close)
        .map_err(|_| "The WebSocket session has already ended.".to_string())
}

enum SocketIoPacketAction {
    Continue,
    Pong,
    Close,
}

fn handle_socket_io_binary_attachment(
    bytes: &[u8],
    pending_binary: &mut Option<PendingSocketIoBinaryPacket>,
    namespace: &str,
    listeners: &HashSet<String>,
    pending_acks: &mut HashMap<u64, String>,
    session_id: &str,
    on_event: &Channel<StreamEvent>,
) -> SocketIoPacketAction {
    let Some(pending) = pending_binary.as_mut() else {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "error",
            "Socket.IO received an unexpected binary attachment.",
        ));
        return SocketIoPacketAction::Close;
    };
    if pending.attachments.len() >= pending.expected_attachments
        || pending.total_bytes.saturating_add(bytes.len()) > MAX_SOCKET_IO_PACKET_BYTES
    {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "error",
            "Socket.IO binary attachments exceed the declared count or 1 MiB limit.",
        ));
        return SocketIoPacketAction::Close;
    }
    pending.total_bytes += bytes.len();
    pending.attachments.push(bytes.to_vec());
    if pending.attachments.len() < pending.expected_attachments {
        return SocketIoPacketAction::Continue;
    }
    let packet = match hydrate_socket_io_binary_packet(pending_binary.take().unwrap()) {
        Ok(packet) => packet,
        Err(error) => {
            let _ = on_event.send(StreamEvent::system(session_id, "error", error));
            return SocketIoPacketAction::Close;
        }
    };
    match packet {
        HydratedSocketIoBinaryPacket::Event {
            namespace: packet_namespace,
            event_name,
            args,
        } if packet_namespace == namespace && listeners.contains(&event_name) => {
            let body = serde_json::to_string_pretty(&args).unwrap_or_else(|_| "[]".into());
            let _ = on_event.send(StreamEvent::incoming(session_id, &event_name, body));
        }
        HydratedSocketIoBinaryPacket::Ack {
            namespace: packet_namespace,
            ack_id,
            args,
        } if packet_namespace == namespace => {
            if let Some(event_name) = pending_acks.remove(&ack_id) {
                let body = serde_json::to_string_pretty(&args).unwrap_or_else(|_| "[]".into());
                let _ = on_event.send(StreamEvent::incoming(
                    session_id,
                    &format!("{event_name} · ack"),
                    body,
                ));
            }
        }
        HydratedSocketIoBinaryPacket::Event { .. } | HydratedSocketIoBinaryPacket::Ack { .. } => {}
    }
    SocketIoPacketAction::Continue
}

fn handle_socket_io_packet(
    packet: &str,
    namespace: &str,
    listeners: &HashSet<String>,
    pending_acks: &mut HashMap<u64, String>,
    pending_binary: &mut Option<PendingSocketIoBinaryPacket>,
    session_id: &str,
    on_event: &Channel<StreamEvent>,
) -> SocketIoPacketAction {
    if packet.len() > MAX_SOCKET_IO_PACKET_BYTES {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "error",
            "A Socket.IO packet exceeded 1 MiB.",
        ));
        return SocketIoPacketAction::Close;
    }
    if packet == "2" {
        return SocketIoPacketAction::Pong;
    }
    if packet == "1" {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "close",
            "Engine.IO server closed the connection",
        ));
        return SocketIoPacketAction::Close;
    }
    if let Some(encoded) = packet.strip_prefix('b') {
        let bytes = match STANDARD.decode(encoded) {
            Ok(bytes) => bytes,
            Err(error) => {
                let _ = on_event.send(StreamEvent::system(
                    session_id,
                    "error",
                    format!("Invalid Engine.IO base64 attachment: {error}"),
                ));
                return SocketIoPacketAction::Close;
            }
        };
        return handle_socket_io_binary_attachment(
            &bytes,
            pending_binary,
            namespace,
            listeners,
            pending_acks,
            session_id,
            on_event,
        );
    }
    if pending_binary.is_some() {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "error",
            "Socket.IO received a text packet before all binary attachments arrived.",
        ));
        return SocketIoPacketAction::Close;
    }
    match parse_socket_io_binary_packet(packet) {
        Ok(Some(pending)) => {
            *pending_binary = Some(pending);
            return SocketIoPacketAction::Continue;
        }
        Ok(None) => {}
        Err(error) => {
            let _ = on_event.send(StreamEvent::system(session_id, "error", error));
            return SocketIoPacketAction::Close;
        }
    }
    if let Some(event) = parse_socket_io_event(packet) {
        if event.namespace == namespace && listeners.contains(&event.event_name) {
            let body = serde_json::to_string_pretty(&event.args).unwrap_or_else(|_| "[]".into());
            let _ = on_event.send(StreamEvent::incoming(session_id, &event.event_name, body));
        }
    } else if let Some((ack_namespace, ack_id, args)) = parse_socket_io_ack(packet) {
        if ack_namespace == namespace {
            if let Some(event_name) = pending_acks.remove(&ack_id) {
                let body = serde_json::to_string_pretty(&args).unwrap_or_else(|_| "[]".into());
                let _ = on_event.send(StreamEvent::incoming(
                    session_id,
                    &format!("{event_name} · ack"),
                    body,
                ));
            }
        }
    } else if let Some((failed_namespace, payload)) = socket_io_packet_payload(packet, '4') {
        if failed_namespace == namespace {
            let _ = on_event.send(StreamEvent::system(session_id, "error", payload));
            return SocketIoPacketAction::Close;
        }
    } else if let Some((closed_namespace, _)) = socket_io_packet_payload(packet, '1') {
        if closed_namespace == namespace {
            let _ = on_event.send(StreamEvent::system(
                session_id,
                "close",
                "Socket.IO namespace disconnected",
            ));
            return SocketIoPacketAction::Close;
        }
    }
    SocketIoPacketAction::Continue
}

fn update_socket_io_listener(
    listeners: &mut HashSet<String>,
    event_name: String,
    enabled: bool,
    session_id: &str,
    on_event: &Channel<StreamEvent>,
) {
    if enabled {
        if listeners.len() >= MAX_SOCKET_IO_LISTENERS {
            let _ = on_event.send(StreamEvent::system(
                session_id,
                "error",
                "At most 500 Socket.IO listeners can be active.",
            ));
        } else if listeners.insert(event_name.clone()) {
            let _ = on_event.send(StreamEvent::system(
                session_id,
                "listen",
                format!("Listening to {event_name}"),
            ));
        }
    } else if listeners.remove(&event_name) {
        let _ = on_event.send(StreamEvent::system(
            session_id,
            "unlisten",
            format!("Stopped listening to {event_name}"),
        ));
    }
}

async fn run_socket_io_websocket_session(
    mut socket: SocketIoWebSocket,
    mut receiver: mpsc::UnboundedReceiver<SocketIoCommand>,
    namespace: &str,
    mut listeners: HashSet<String>,
    session_id: &str,
    on_event: &Channel<StreamEvent>,
) {
    let mut next_ack_id = 1_u64;
    let mut pending_acks = HashMap::<u64, String>::new();
    let mut pending_binary = None;
    loop {
        tokio::select! {
            command = receiver.recv() => {
                match command {
                    Some(SocketIoCommand::Emit { event_name, args, ack }) => {
                        let ack_id = ack.then_some(next_ack_id);
                        let packet = match socket_io_event_packet(namespace, &event_name, &args, ack_id) {
                            Ok(packet) => packet,
                            Err(error) => {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", error));
                                continue;
                            }
                        };
                        match socket.send(Message::Text(packet.into())).await {
                            Ok(()) => {
                                if let Some(ack_id) = ack_id {
                                    pending_acks.insert(ack_id, event_name.clone());
                                    next_ack_id = next_ack_id.saturating_add(1);
                                }
                                let text = serde_json::to_string_pretty(&args).unwrap_or_else(|_| "[]".into());
                                let _ = on_event.send(StreamEvent::outgoing(session_id, &event_name, text));
                            }
                            Err(error) => {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", error.to_string()));
                                break;
                            }
                        }
                    }
                    Some(SocketIoCommand::AddListener(event_name)) => update_socket_io_listener(&mut listeners, event_name, true, session_id, on_event),
                    Some(SocketIoCommand::RemoveListener(event_name)) => update_socket_io_listener(&mut listeners, event_name, false, session_id, on_event),
                    Some(SocketIoCommand::Close) | None => {
                        let _ = socket.send(Message::Text(socket_io_disconnect_packet(namespace).into())).await;
                        let _ = socket.close(None).await;
                        break;
                    }
                }
            }
            message = socket.next() => {
                match message {
                    Some(Ok(Message::Text(text))) => match handle_socket_io_packet(&text, namespace, &listeners, &mut pending_acks, &mut pending_binary, session_id, on_event) {
                        SocketIoPacketAction::Continue => {}
                        SocketIoPacketAction::Pong => {
                            if socket.send(Message::Text("3".into())).await.is_err() {
                                break;
                            }
                        }
                        SocketIoPacketAction::Close => break,
                    },
                    Some(Ok(Message::Binary(bytes))) => match handle_socket_io_binary_attachment(&bytes, &mut pending_binary, namespace, &listeners, &mut pending_acks, session_id, on_event) {
                        SocketIoPacketAction::Continue => {}
                        SocketIoPacketAction::Pong => {}
                        SocketIoPacketAction::Close => break,
                    },
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Pong(_))) | Some(Ok(Message::Frame(_))) => {}
                    Some(Ok(Message::Close(frame))) => {
                        let reason = frame.map(|frame| frame.reason.to_string()).unwrap_or_else(|| "Remote peer closed the connection".into());
                        let _ = on_event.send(StreamEvent::system(session_id, "close", reason));
                        break;
                    }
                    Some(Err(error)) => {
                        let _ = on_event.send(StreamEvent::system(session_id, "error", error.to_string()));
                        break;
                    }
                    None => break,
                }
            }
        }
    }
}

async fn run_socket_io_polling_session(
    transport: SocketIoPollingTransport,
    mut receiver: mpsc::UnboundedReceiver<SocketIoCommand>,
    namespace: &str,
    mut listeners: HashSet<String>,
    session_id: &str,
    on_event: &Channel<StreamEvent>,
) {
    let SocketIoPollingTransport {
        client,
        url,
        headers,
        max_payload,
    } = transport;
    let mut next_ack_id = 1_u64;
    let mut pending_acks = HashMap::<u64, String>::new();
    let mut pending_binary = None;
    let (poll_sender, mut poll_receiver) = mpsc::channel(1);
    let poll_client = client.clone();
    let poll_url = url.clone();
    let poll_headers = headers.clone();
    let poll_task = tokio::spawn(async move {
        loop {
            let response =
                socket_io_http_request(&poll_client, &poll_url, &poll_headers, None).await;
            let failed = response.is_err();
            if poll_sender.send(response).await.is_err() || failed {
                break;
            }
        }
    });
    'connection: loop {
        tokio::select! {
            response = poll_receiver.recv() => {
                let response = match response {
                    Some(Ok(response)) => response,
                    Some(Err(error)) => {
                        let _ = on_event.send(StreamEvent::system(session_id, "error", error));
                        break;
                    }
                    None => break,
                };
                for packet in response.body.split('\u{001e}') {
                    match handle_socket_io_packet(packet, namespace, &listeners, &mut pending_acks, &mut pending_binary, session_id, on_event) {
                        SocketIoPacketAction::Continue => {}
                        SocketIoPacketAction::Pong => {
                            if let Err(error) = socket_io_http_request(&client, &url, &headers, Some("3")).await {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", error));
                                break 'connection;
                            }
                        }
                        SocketIoPacketAction::Close => break 'connection,
                    }
                }
            }
            command = receiver.recv() => {
                match command {
                    Some(SocketIoCommand::Emit { event_name, args, ack }) => {
                        let ack_id = ack.then_some(next_ack_id);
                        let packet = match socket_io_event_packet(namespace, &event_name, &args, ack_id) {
                            Ok(packet) if packet.len() <= max_payload => packet,
                            Ok(_) => {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", "The Socket.IO event exceeds the server polling payload limit."));
                                continue;
                            }
                            Err(error) => {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", error));
                                continue;
                            }
                        };
                        match socket_io_http_request(&client, &url, &headers, Some(&packet)).await {
                            Ok(_) => {
                                if let Some(ack_id) = ack_id {
                                    pending_acks.insert(ack_id, event_name.clone());
                                    next_ack_id = next_ack_id.saturating_add(1);
                                }
                                let text = serde_json::to_string_pretty(&args).unwrap_or_else(|_| "[]".into());
                                let _ = on_event.send(StreamEvent::outgoing(session_id, &event_name, text));
                            }
                            Err(error) => {
                                let _ = on_event.send(StreamEvent::system(session_id, "error", error));
                                break 'connection;
                            }
                        }
                    }
                    Some(SocketIoCommand::AddListener(event_name)) => update_socket_io_listener(&mut listeners, event_name, true, session_id, on_event),
                    Some(SocketIoCommand::RemoveListener(event_name)) => update_socket_io_listener(&mut listeners, event_name, false, session_id, on_event),
                    Some(SocketIoCommand::Close) | None => {
                        let packet = socket_io_disconnect_packet(namespace);
                        let _ = socket_io_http_request(&client, &url, &headers, Some(&packet)).await;
                        break 'connection;
                    }
                }
            }
        }
    }
    poll_task.abort();
    let _ = poll_task.await;
}

pub async fn connect_socket_io(
    input: SocketIoConnectInput,
    on_event: Channel<StreamEvent>,
    state: StreamingState,
) -> Result<StreamConnectOutput, String> {
    if state
        .socket_io_sessions
        .lock()
        .await
        .contains_key(&input.session_id)
    {
        return Err("This Socket.IO session is already connected.".into());
    }
    let mut listeners = HashSet::new();
    for event_name in input.event_listeners.iter().take(MAX_SOCKET_IO_LISTENERS) {
        validate_socket_io_event_name(event_name)?;
        listeners.insert(event_name.clone());
    }
    let started = Instant::now();
    let handshake = establish_socket_io_transport(&input);
    let (namespace, transport) = if input.transport.timeout_ms == 0 {
        handshake.await
    } else {
        tokio::time::timeout(
            std::time::Duration::from_millis(input.transport.timeout_ms),
            handshake,
        )
        .await
        .map_err(|_| "Socket.IO connection timed out during Engine.IO negotiation.".to_string())?
    }?;

    let (sender, receiver) = mpsc::unbounded_channel();
    state
        .socket_io_sessions
        .lock()
        .await
        .insert(input.session_id.clone(), sender);
    let session_id = input.session_id.clone();
    let sessions = state.socket_io_sessions.clone();
    let path = if input.path.trim().is_empty() {
        "/socket.io"
    } else {
        input.path.trim()
    };
    let (status, headers, http_version, transport_name, upgrade_note) = match &transport {
        ConnectedSocketIoTransport::WebSocket {
            status,
            headers,
            http_version,
            ..
        } => (
            *status,
            headers.clone(),
            http_version.clone(),
            "WebSocket",
            Some("Upgraded from polling to WebSocket".to_string()),
        ),
        ConnectedSocketIoTransport::Polling {
            status,
            headers,
            http_version,
            upgrade_note,
            ..
        } => (
            *status,
            headers.clone(),
            http_version.clone(),
            "polling",
            upgrade_note.clone(),
        ),
    };
    let output = StreamConnectOutput {
        status,
        status_text: http::StatusCode::from_u16(status)
            .ok()
            .and_then(|status| status.canonical_reason())
            .unwrap_or("Unknown")
            .to_string(),
        headers,
        http_version,
        duration_ms: started.elapsed().as_millis(),
        transport: transport_name.into(),
    };
    let _ = on_event.send(StreamEvent::system(
        &session_id,
        "open",
        format!(
            "Connected · HTTP {status} · namespace {namespace} · path {path} · transport {transport_name}"
        ),
    ));
    if let Some(note) = upgrade_note {
        let _ = on_event.send(StreamEvent::system(&session_id, "upgrade", note));
    }
    if listeners.is_empty() {
        let _ = on_event.send(StreamEvent::system(
            &session_id,
            "info",
            "Add event listeners to receive Socket.IO messages",
        ));
    }

    tokio::spawn(async move {
        match transport {
            ConnectedSocketIoTransport::WebSocket { socket, .. } => {
                run_socket_io_websocket_session(
                    *socket,
                    receiver,
                    &namespace,
                    listeners,
                    &session_id,
                    &on_event,
                )
                .await;
            }
            ConnectedSocketIoTransport::Polling { transport, .. } => {
                run_socket_io_polling_session(
                    transport,
                    receiver,
                    &namespace,
                    listeners,
                    &session_id,
                    &on_event,
                )
                .await;
            }
        }
        sessions.lock().await.remove(&session_id);
        let _ = on_event.send(StreamEvent::system(
            &session_id,
            "closed",
            "Socket.IO disconnected",
        ));
    });
    Ok(output)
}

pub async fn send_socket_io_message(
    session_id: String,
    event_name: String,
    args: Vec<Value>,
    ack: bool,
    state: StreamingState,
) -> Result<(), String> {
    validate_socket_io_event_name(&event_name)?;
    socket_io_event_packet("/", &event_name, &args, ack.then_some(1))?;
    let sender = state
        .socket_io_sessions
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Connect Socket.IO before emitting an event.".to_string())?;
    sender
        .send(SocketIoCommand::Emit {
            event_name,
            args,
            ack,
        })
        .map_err(|_| "The Socket.IO session has ended.".to_string())
}

pub async fn set_socket_io_listener(
    session_id: String,
    event_name: String,
    enabled: bool,
    state: StreamingState,
) -> Result<(), String> {
    validate_socket_io_event_name(&event_name)?;
    let sender = state
        .socket_io_sessions
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Connect Socket.IO before changing listeners.".to_string())?;
    sender
        .send(if enabled {
            SocketIoCommand::AddListener(event_name)
        } else {
            SocketIoCommand::RemoveListener(event_name)
        })
        .map_err(|_| "The Socket.IO session has ended.".to_string())
}

pub async fn disconnect_socket_io(session_id: String, state: StreamingState) -> Result<(), String> {
    let sender = state
        .socket_io_sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "Socket.IO is not connected.".to_string())?;
    sender
        .send(SocketIoCommand::Close)
        .map_err(|_| "The Socket.IO session has already ended.".to_string())
}

async fn open_sse(
    input: &StreamConnectInput,
    last_event_id: Option<&str>,
) -> Result<reqwest::Response, String> {
    let client = build_streaming_client(&input.transport, Some(&input.url))?;
    let mut request = apply_preferred_request_version(client.get(&input.url), &input.transport)
        .header("Accept", "text/event-stream");
    for header in input.headers.iter().filter(|header| header.enabled) {
        request = request.header(&header.name, &header.value);
    }
    if input.sse.send_last_event_id {
        if let Some(last_event_id) = last_event_id.filter(|value| !value.is_empty()) {
            request = request.header("Last-Event-ID", last_event_id);
        }
    }
    let response = if input.transport.timeout_ms == 0 {
        request.send().await
    } else {
        tokio::time::timeout(
            std::time::Duration::from_millis(input.transport.timeout_ms),
            request.send(),
        )
        .await
        .map_err(|_| "SSE connection timed out before response headers arrived.".to_string())?
    }
    .map_err(|error| format!("SSE connection failed: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("SSE server returned HTTP {status}."));
    }
    Ok(response)
}

fn should_reconnect(config: &crate::models::SseConfig, reconnects: u32) -> bool {
    config.auto_reconnect && (config.max_reconnects == 0 || reconnects < config.max_reconnects)
}

pub async fn connect_sse(
    input: StreamConnectInput,
    on_event: Channel<StreamEvent>,
    state: StreamingState,
) -> Result<StreamConnectOutput, String> {
    if state
        .sse_sessions
        .lock()
        .await
        .contains_key(&input.session_id)
    {
        return Err("This SSE stream is already connected.".into());
    }

    let started = Instant::now();
    let response = open_sse(&input, None).await?;
    let status = response.status();
    let version = format!("{:?}", response.version());
    let output = StreamConnectOutput {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers: flatten_headers(response.headers()),
        http_version: version.clone(),
        duration_ms: started.elapsed().as_millis(),
        transport: "Server-Sent Events".into(),
    };

    let (cancel, mut cancel_receiver) = mpsc::unbounded_channel();
    state
        .sse_sessions
        .lock()
        .await
        .insert(input.session_id.clone(), cancel);
    let session_id = input.session_id.clone();
    let sessions = state.sse_sessions.clone();
    let _ = on_event.send(StreamEvent::system(
        &session_id,
        "open",
        format!("Listening · HTTP {status} · {version}"),
    ));

    tokio::spawn(async move {
        let mut response = Some(response);
        let mut reconnects = 0_u32;
        let mut reconnect_delay_ms = input.sse.reconnect_delay_ms.clamp(100, 60_000);
        let mut last_event_id = String::new();
        let mut cancelled = false;
        'session: loop {
            if let Some(active_response) = response.take() {
                let mut bytes = active_response.bytes_stream();
                let mut parser = SseParser::default();
                loop {
                    tokio::select! {
                        _ = cancel_receiver.recv() => {
                            cancelled = true;
                            break;
                        },
                        chunk = bytes.next() => {
                            match chunk {
                                Some(Ok(chunk)) => {
                                    for event in parser.push(&chunk) {
                                        if let Some(id) = event.id.filter(|id| id.len() <= 8_192) {
                                            last_event_id = id;
                                        }
                                        if input.sse.respect_server_retry {
                                            if let Some(delay) = event.retry_ms {
                                                reconnect_delay_ms = delay.clamp(100, 60_000);
                                            }
                                        }
                                        if !event.data.is_empty() {
                                            let _ = on_event.send(StreamEvent::incoming(&session_id, &event.event, event.data));
                                        }
                                    }
                                }
                                Some(Err(error)) => {
                                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error.to_string()));
                                    break;
                                }
                                None => break,
                            }
                        }
                    }
                }
            }
            if cancelled || !should_reconnect(&input.sse, reconnects) {
                break;
            }
            reconnects += 1;
            let _ = on_event.send(StreamEvent::system(
                &session_id,
                "reconnecting",
                format!("Reconnect attempt {reconnects} in {reconnect_delay_ms} ms"),
            ));
            tokio::select! {
                _ = cancel_receiver.recv() => break 'session,
                _ = tokio::time::sleep(std::time::Duration::from_millis(reconnect_delay_ms)) => {}
            }
            let last_event_header = input
                .sse
                .send_last_event_id
                .then_some(last_event_id.as_str());
            let reconnect = open_sse(&input, last_event_header);
            let reopened = tokio::select! {
                _ = cancel_receiver.recv() => break 'session,
                result = reconnect => result,
            };
            match reopened {
                Ok(next_response) => {
                    let status = next_response.status();
                    let version = format!("{:?}", next_response.version());
                    let _ = on_event.send(StreamEvent::system(
                        &session_id,
                        "open",
                        format!("Reconnected · HTTP {status} · {version} · attempt {reconnects}"),
                    ));
                    response = Some(next_response);
                }
                Err(error) => {
                    let _ = on_event.send(StreamEvent::system(&session_id, "error", error));
                }
            }
        }
        sessions.lock().await.remove(&session_id);
        let _ = on_event.send(StreamEvent::system(
            &session_id,
            "closed",
            "Event stream closed",
        ));
    });
    Ok(output)
}

pub async fn disconnect_sse(session_id: String, state: StreamingState) -> Result<(), String> {
    let sender = state
        .sse_sessions
        .lock()
        .await
        .remove(&session_id)
        .ok_or_else(|| "The SSE stream is not connected.".to_string())?;
    sender
        .send(())
        .map_err(|_| "The SSE stream has already ended.".to_string())
}

#[derive(Debug, PartialEq)]
struct ParsedSseEvent {
    event: String,
    data: String,
    id: Option<String>,
    retry_ms: Option<u64>,
}

#[derive(Default)]
struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    fn push(&mut self, chunk: &[u8]) -> Vec<ParsedSseEvent> {
        self.buffer.extend_from_slice(chunk);
        let mut events = Vec::new();
        while let Some((boundary, separator_length)) = find_event_boundary(&self.buffer) {
            let event_bytes = self.buffer.drain(..boundary).collect::<Vec<_>>();
            self.buffer.drain(..separator_length);
            if let Some(event) = parse_sse_event(&String::from_utf8_lossy(&event_bytes)) {
                events.push(event);
            }
        }
        events
    }
}

fn find_event_boundary(buffer: &[u8]) -> Option<(usize, usize)> {
    buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2))
        .or_else(|| {
            buffer
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|index| (index, 4))
        })
}

fn parse_sse_event(block: &str) -> Option<ParsedSseEvent> {
    let mut event = "message".to_string();
    let mut data = Vec::new();
    let mut id = None;
    let mut retry_ms = None;
    for line in block.lines() {
        if line.starts_with(':') {
            continue;
        }
        let (name, raw_value) = line.split_once(':').unwrap_or((line, ""));
        let value = raw_value.strip_prefix(' ').unwrap_or(raw_value);
        match name {
            "event" => event = value.to_string(),
            "data" => data.push(value.to_string()),
            "id" if !value.contains('\0') => id = Some(value.to_string()),
            "retry" => retry_ms = value.parse().ok(),
            _ => {}
        }
    }
    (!data.is_empty() || id.is_some() || retry_ms.is_some()).then(|| ParsedSseEvent {
        event,
        data: data.join("\n"),
        id,
        retry_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    const TLS_CA_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/ca.cert.pem");
    const TLS_SERVER_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/server.cert.pem");
    const TLS_SERVER_KEY: &str = include_str!("../tests/fixtures/tls/server.key.pem");
    const TLS_CLIENT_CERTIFICATE: &str = include_str!("../tests/fixtures/tls/client.cert.pem");
    const TLS_CLIENT_KEY: &str = include_str!("../tests/fixtures/tls/client.key.pem");

    struct TestHttpRequest {
        method: String,
        target: String,
        headers: HashMap<String, String>,
        body: String,
    }

    async fn read_test_http_request<S>(stream: &mut S) -> TestHttpRequest
    where
        S: AsyncRead + Unpin,
    {
        let mut bytes = Vec::new();
        let header_end = loop {
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "connection closed before HTTP headers");
            bytes.extend_from_slice(&chunk[..read]);
            if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                break index + 4;
            }
            assert!(bytes.len() <= MAX_SOCKET_IO_PACKET_BYTES);
        };
        let headers = String::from_utf8(bytes[..header_end].to_vec()).unwrap();
        let mut lines = headers.lines();
        let request_line = lines.next().unwrap();
        let mut request_parts = request_line.split_whitespace();
        let method = request_parts.next().unwrap().to_string();
        let target = request_parts.next().unwrap().to_string();
        let headers = lines
            .filter_map(|line| line.split_once(':'))
            .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
            .collect::<HashMap<_, _>>();
        let content_length = headers
            .get("content-length")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0);
        while bytes.len() < header_end + content_length {
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).await.unwrap();
            assert!(read > 0, "connection closed before HTTP body");
            bytes.extend_from_slice(&chunk[..read]);
        }
        TestHttpRequest {
            method,
            target,
            headers,
            body: String::from_utf8(bytes[header_end..header_end + content_length].to_vec())
                .unwrap(),
        }
    }

    async fn write_test_http_response<S>(stream: &mut S, body: &str)
    where
        S: AsyncWrite + Unpin,
    {
        let response = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: text/plain; charset=UTF-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).await.unwrap();
        stream.shutdown().await.unwrap();
    }

    fn test_tls_server_config(require_client_identity: bool) -> rustls::ServerConfig {
        let certificates = CertificateDer::pem_slice_iter(TLS_SERVER_CERTIFICATE.as_bytes())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let key = PrivateKeyDer::from_pem_slice(TLS_SERVER_KEY.as_bytes()).unwrap();
        let builder = rustls::ServerConfig::builder();
        if require_client_identity {
            let mut roots = RootCertStore::empty();
            let authorities = CertificateDer::pem_slice_iter(TLS_CA_CERTIFICATE.as_bytes())
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            let (added, _) = roots.add_parsable_certificates(authorities);
            assert_eq!(added, 1);
            let verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(roots))
                .build()
                .unwrap();
            builder
                .with_client_cert_verifier(verifier)
                .with_single_cert(certificates, key)
                .unwrap()
        } else {
            builder
                .with_no_client_auth()
                .with_single_cert(certificates, key)
                .unwrap()
        }
    }

    fn discard_stream_channel() -> Channel<StreamEvent> {
        use tauri::ipc::InvokeResponseBody;

        Channel::new(|body| {
            if let InvokeResponseBody::Json(json) = body {
                let _: Value = serde_json::from_str(&json)?;
            }
            Ok(())
        })
    }

    #[test]
    fn decodes_binary_websocket_composition() {
        match websocket_command("binary", "AAEC/w==".into()).unwrap() {
            WebSocketCommand::Binary(bytes) => assert_eq!(bytes, vec![0, 1, 2, 255]),
            _ => panic!("expected a binary command"),
        }
        assert!(websocket_command("binary", "not base64".into()).is_err());
    }

    #[test]
    fn matches_websocket_proxy_exclusions_and_normalizes_proxy_urls() {
        let target = Url::parse("wss://api.internal.example:8443/socket").unwrap();
        assert!(proxy_bypassed("localhost, .internal.example", &target));
        assert!(proxy_bypassed("api.internal.example:8443", &target));
        assert!(!proxy_bypassed("api.internal.example:443", &target));
        assert!(proxy_bypassed("*", &target));
        assert!(proxy_bypassed(
            "127.0.0.0/8",
            &Url::parse("ws://127.0.0.42/socket").unwrap()
        ));
        assert!(proxy_bypassed(
            "::1/128",
            &Url::parse("ws://[::1]/socket").unwrap()
        ));
        assert_eq!(
            parse_proxy_url("proxy.example.test:8080").unwrap().as_str(),
            "http://proxy.example.test:8080/"
        );
        assert!(parse_proxy_url("socks5://proxy.example.test:1080").is_err());
        assert_eq!(decode_proxy_userinfo("proxy%2Duser").unwrap(), "proxy-user");
        assert!(decode_proxy_userinfo("proxy%0Duser").is_err());
        assert_eq!(
            forward_proxy_url(&Url::parse("ws://api.example.test:8443/socket?token=one").unwrap())
                .unwrap(),
            "http://api.example.test:8443/socket?token=one"
        );
    }

    #[test]
    fn resolves_websocket_redirects_and_honors_redirect_limits() {
        let current = Url::parse("ws://example.test/start/path?old=1").unwrap();
        let relative = http::Response::builder()
            .status(302)
            .header(LOCATION, "../final?next=1")
            .body(None)
            .unwrap();
        assert_eq!(
            websocket_redirect_url(&current, &relative)
                .unwrap()
                .as_str(),
            "ws://example.test/final?next=1"
        );
        let invalid = http::Response::builder()
            .status(307)
            .header(LOCATION, "https://example.test/not-websocket")
            .body(None)
            .unwrap();
        assert!(websocket_redirect_url(&current, &invalid)
            .unwrap_err()
            .contains("WS or WSS"));

        let mut transport = crate::models::TransportConfig {
            follow_redirects: false,
            max_redirects: 10,
            ..Default::default()
        };
        assert!(!websocket_redirect_allowed(&transport, 0));
        transport.follow_redirects = true;
        transport.max_redirects = 0;
        assert!(!websocket_redirect_allowed(&transport, 0));
        transport.max_redirects = 2;
        assert!(websocket_redirect_allowed(&transport, 0));
        assert!(websocket_redirect_allowed(&transport, 1));
        assert!(!websocket_redirect_allowed(&transport, 2));
        transport.max_redirects = -1;
        assert!(websocket_redirect_allowed(&transport, usize::MAX));
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn follows_relative_websocket_redirects_with_fresh_handshake_keys() {
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut first, _) = listener.accept().await.unwrap();
            let first_request = read_test_http_request(&mut first).await;
            assert_eq!(first_request.target, "/start");
            let first_key = first_request.headers["sec-websocket-key"].clone();
            first
                .write_all(
                    b"HTTP/1.1 302 Found\r\nLocation: /final?redirected=1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await
                .unwrap();
            first.shutdown().await.unwrap();

            let (second, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_hdr_async(
                second,
                move |request: &http::Request<()>, response: http::Response<()>| {
                    assert_eq!(request.uri().to_string(), "/final?redirected=1");
                    assert_eq!(request.headers()["x-redirect-test"], "preserved");
                    assert_eq!(request.headers()[AUTHORIZATION], "Bearer same-origin");
                    assert_eq!(request.headers()[COOKIE], "session=same-origin");
                    assert_ne!(
                        request.headers()[SEC_WEBSOCKET_KEY].to_str().unwrap(),
                        first_key
                    );
                    Ok(response)
                },
            )
            .await
            .unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "redirected-websocket".into(),
                url: format!("ws://{address}/start"),
                headers: vec![
                    KeyValue {
                        name: "X-Redirect-Test".into(),
                        value: "preserved".into(),
                        enabled: true,
                    },
                    KeyValue {
                        name: "Authorization".into(),
                        value: "Bearer same-origin".into(),
                        enabled: true,
                    },
                    KeyValue {
                        name: "Cookie".into(),
                        value: "session=same-origin".into(),
                        enabled: true,
                    },
                ],
                transport: crate::models::TransportConfig {
                    follow_redirects: true,
                    max_redirects: 1,
                    timeout_ms: 5_000,
                    proxy_mode: "disabled".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        disconnect_websocket("redirected-websocket".into(), state)
            .await
            .unwrap();
        server.await.unwrap();
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn strips_sensitive_headers_from_cross_origin_websocket_redirects() {
        use tokio::net::TcpListener;

        let target_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_address = target_listener.local_addr().unwrap();
        let target = tokio::spawn(async move {
            let (stream, _) = target_listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_hdr_async(
                stream,
                |request: &http::Request<()>, response: http::Response<()>| {
                    assert_eq!(request.uri().path(), "/final");
                    assert_eq!(request.headers()[HOST], target_address.to_string());
                    assert_eq!(request.headers()["x-public"], "preserved");
                    assert!(!request.headers().contains_key(AUTHORIZATION));
                    assert!(!request.headers().contains_key(COOKIE));
                    Ok(response)
                },
            )
            .await
            .unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let redirect_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let redirect_address = redirect_listener.local_addr().unwrap();
        let redirect = tokio::spawn(async move {
            let (mut stream, _) = redirect_listener.accept().await.unwrap();
            let _ = read_test_http_request(&mut stream).await;
            stream
                .write_all(
                    format!(
                        "HTTP/1.1 307 Temporary Redirect\r\nLocation: ws://{target_address}/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
            stream.shutdown().await.unwrap();
        });

        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "cross-origin-redirect".into(),
                url: format!("ws://{redirect_address}/start"),
                headers: vec![
                    KeyValue {
                        name: "X-Public".into(),
                        value: "preserved".into(),
                        enabled: true,
                    },
                    KeyValue {
                        name: "Host".into(),
                        value: "authored.invalid".into(),
                        enabled: true,
                    },
                    KeyValue {
                        name: "Authorization".into(),
                        value: "Bearer secret".into(),
                        enabled: true,
                    },
                    KeyValue {
                        name: "Cookie".into(),
                        value: "session=secret".into(),
                        enabled: true,
                    },
                ],
                transport: crate::models::TransportConfig {
                    follow_redirects: true,
                    max_redirects: 1,
                    timeout_ms: 5_000,
                    proxy_mode: "disabled".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        disconnect_websocket("cross-origin-redirect".into(), state)
            .await
            .unwrap();
        redirect.await.unwrap();
        target.await.unwrap();
    }

    #[tokio::test]
    async fn refuses_websocket_redirects_when_disabled() {
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let _ = read_test_http_request(&mut stream).await;
            stream
                .write_all(
                    b"HTTP/1.1 302 Found\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await
                .unwrap();
            stream.shutdown().await.unwrap();
        });

        let error = connect_websocket(
            StreamConnectInput {
                session_id: "disabled-redirect".into(),
                url: format!("ws://{address}/start"),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    follow_redirects: false,
                    timeout_ms: 5_000,
                    proxy_mode: "disabled".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            StreamingState::default(),
        )
        .await
        .unwrap_err();
        assert!(error.contains("redirects are disabled"));
        server.await.unwrap();
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn runs_graphql_transport_ws_subscription_lifecycle() {
        use std::{sync::mpsc as std_mpsc, time::Duration};
        use tauri::ipc::InvokeResponseBody;
        use tokio::net::TcpListener;
        use tokio_tungstenite::{
            accept_hdr_async,
            tungstenite::handshake::server::{Request, Response},
        };

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket =
                accept_hdr_async(stream, |request: &Request, mut response: Response| {
                    assert_eq!(request.uri().path(), "/graphql");
                    assert_eq!(
                        request
                            .headers()
                            .get(SEC_WEBSOCKET_PROTOCOL)
                            .and_then(|value| value.to_str().ok()),
                        Some(GRAPHQL_TRANSPORT_WS_PROTOCOL)
                    );
                    response.headers_mut().insert(
                        SEC_WEBSOCKET_PROTOCOL,
                        HeaderValue::from_static(GRAPHQL_TRANSPORT_WS_PROTOCOL),
                    );
                    Ok(response)
                })
                .await
                .unwrap();

            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                r#"{"type":"connection_init"}"#
            );
            socket
                .send(Message::Text(r#"{"type":"connection_ack"}"#.into()))
                .await
                .unwrap();
            let subscribe = socket.next().await.unwrap().unwrap().into_text().unwrap();
            assert!(subscribe.starts_with(r#"{"id":""#));
            assert!(subscribe.ends_with(
                r#"","type":"subscribe","payload":{"query":"subscription Orders { orderChanged { id } }","variables":{"teamId":"team-42"},"operationName":"Orders"}}"#
            ));
            let subscribe: Value = serde_json::from_str(&subscribe).unwrap();
            assert_eq!(subscribe["type"], "subscribe");
            assert!(uuid::Uuid::parse_str(subscribe["id"].as_str().unwrap()).is_ok());
            assert_eq!(
                subscribe["payload"]["query"],
                "subscription Orders { orderChanged { id } }"
            );
            assert_eq!(subscribe["payload"]["variables"]["teamId"], "team-42");
            assert_eq!(subscribe["payload"]["operationName"], "Orders");
            socket
                .send(Message::Text(
                    format!(
                        "{{\"id\":{},\"type\":\"next\",\"payload\":{{\"data\":{{\"orderChanged\":{{\"id\":42}}}}}}}}",
                        serde_json::to_string(subscribe["id"].as_str().unwrap()).unwrap()
                    )
                    .into(),
                ))
                .await
                .unwrap();
            socket
                .send(Message::Text(
                    format!(
                        "{{\"id\":{},\"type\":\"complete\"}}",
                        serde_json::to_string(subscribe["id"].as_str().unwrap()).unwrap()
                    )
                    .into(),
                ))
                .await
                .unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let (event_sender, event_receiver) = std_mpsc::channel();
        let channel = Channel::<StreamEvent>::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                let _ = event_sender.send(serde_json::from_str::<Value>(&json)?);
            }
            Ok(())
        });
        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "graphql-subscription-session".into(),
                url: format!("ws://{address}/graphql"),
                headers: vec![KeyValue {
                    name: "Sec-WebSocket-Protocol".into(),
                    value: "legacy-protocol".into(),
                    enabled: true,
                }],
                transport: crate::models::TransportConfig::default(),
                sse: crate::models::SseConfig::default(),
                graphql_subscription: Some(
                    r#"{"query":"subscription Orders { orderChanged { id } }","variables":{"teamId":"team-42"},"operationName":"Orders"}"#.into(),
                ),
            },
            channel,
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        assert_eq!(
            output
                .headers
                .get("sec-websocket-protocol")
                .map(String::as_str),
            Some(GRAPHQL_TRANSPORT_WS_PROTOCOL)
        );

        let mut events = Vec::new();
        while !events.iter().any(|event: &Value| event["kind"] == "closed") {
            events.push(event_receiver.recv_timeout(Duration::from_secs(2)).unwrap());
        }
        assert!(events.iter().any(|event| {
            event["direction"] == "outgoing" && event["kind"] == "connection_init"
        }));
        assert!(events.iter().any(|event| {
            event["direction"] == "incoming" && event["kind"] == "connection_ack"
        }));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "outgoing" && event["kind"] == "subscribe"));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "incoming" && event["kind"] == "next"));
        assert!(events
            .iter()
            .any(|event| { event["direction"] == "incoming" && event["kind"] == "complete" }));
        server.await.unwrap();
        assert!(!state
            .websocket_sessions
            .lock()
            .await
            .contains_key("graphql-subscription-session"));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn applies_wss_validation_and_domain_scoped_client_identity() {
        use tauri::ipc::InvokeResponseBody;
        use tokio::net::TcpListener;
        use tokio_rustls::TlsAcceptor;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let plain_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(false)));
        let mutual_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(true)));
        let server = tokio::spawn(async move {
            let (strict_stream, _) = listener.accept().await.unwrap();
            assert!(plain_acceptor.accept(strict_stream).await.is_err());

            let (unmatched_stream, _) = listener.accept().await.unwrap();
            assert!(mutual_acceptor.accept(unmatched_stream).await.is_err());

            let (matched_stream, _) = listener.accept().await.unwrap();
            let tls = mutual_acceptor.accept(matched_stream).await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(tls).await.unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));

            let (pfx_stream, _) = listener.accept().await.unwrap();
            let tls = mutual_acceptor.accept(pfx_stream).await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(tls).await.unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));

            let (trusted_stream, _) = listener.accept().await.unwrap();
            let tls = plain_acceptor.accept(trusted_stream).await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(tls).await.unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let channel = || {
            Channel::<StreamEvent>::new(|body| {
                if let InvokeResponseBody::Json(json) = body {
                    let _: Value = serde_json::from_str(&json)?;
                }
                Ok(())
            })
        };
        let state = StreamingState::default();
        let url = format!("wss://127.0.0.1:{}/secure", address.port());
        let strict = connect_websocket(
            StreamConnectInput {
                session_id: "wss-strict".into(),
                url: url.clone(),
                headers: Vec::new(),
                transport: crate::models::TransportConfig::default(),
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            channel(),
            state.clone(),
        )
        .await;
        assert!(strict.unwrap_err().contains("WebSocket connection failed"));

        let unmatched = connect_websocket(
            StreamConnectInput {
                session_id: "wss-unmatched-identity".into(),
                url: url.clone(),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    validate_certificates: false,
                    client_certificate_pem: TLS_CLIENT_CERTIFICATE.into(),
                    client_key_pem: TLS_CLIENT_KEY.into(),
                    client_certificate_domains: "localhost".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            channel(),
            state.clone(),
        )
        .await;
        assert!(unmatched
            .unwrap_err()
            .contains("WebSocket connection failed"));

        let output = connect_websocket(
            StreamConnectInput {
                session_id: "wss-matched-identity".into(),
                url: url.clone(),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    validate_certificates: false,
                    client_certificate_pem: TLS_CLIENT_CERTIFICATE.into(),
                    client_key_pem: TLS_CLIENT_KEY.into(),
                    client_certificate_domains: "127.0.0.1".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        assert_eq!(output.transport, "WebSocket");
        disconnect_websocket("wss-matched-identity".into(), state.clone())
            .await
            .unwrap();
        let pfx = connect_websocket(
            StreamConnectInput {
                session_id: "wss-pfx-identity".into(),
                url: url.clone(),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    validate_certificates: false,
                    client_certificate_pfx_base64: crate::client_identity::test_pfx_base64(
                        "wss-secret",
                        false,
                    ),
                    client_certificate_passphrase: "wss-secret".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(pfx.status, 101);
        disconnect_websocket("wss-pfx-identity".into(), state.clone())
            .await
            .unwrap();
        let trusted = connect_websocket(
            StreamConnectInput {
                session_id: "wss-workspace-ca".into(),
                url,
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    ca_certificate_pem: TLS_CA_CERTIFICATE.into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(trusted.status, 101);
        disconnect_websocket("wss-workspace-ca".into(), state)
            .await
            .unwrap();
        server.await.unwrap();
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn connects_websocket_through_authenticated_http_proxy_and_honors_bypass() {
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let target_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_address = target_listener.local_addr().unwrap();
        let target_server = tokio::spawn(async move {
            let (stream, _) = target_listener.accept().await.unwrap();
            let mut socket = accept_async(stream).await.unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let proxy_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_address = proxy_listener.local_addr().unwrap();
        let proxy = tokio::spawn(async move {
            let (downstream, _) = proxy_listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_hdr_async(
                downstream,
                move |request: &http::Request<()>, response: http::Response<()>| {
                    assert_eq!(
                        request.uri().to_string(),
                        format!("http://upstream.invalid:{}/socket", target_address.port())
                    );
                    assert_eq!(
                        request
                            .headers()
                            .get("proxy-authorization")
                            .and_then(|value| value.to_str().ok()),
                        Some("Basic cHJveHktdXNlcjpwcm94eS1wYXNz")
                    );
                    assert_eq!(
                        request
                            .headers()
                            .get("proxy-connection")
                            .and_then(|value| value.to_str().ok()),
                        Some("Keep-Alive")
                    );
                    Ok(response)
                },
            )
            .await
            .unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "proxied-websocket".into(),
                url: format!("ws://upstream.invalid:{}/socket", target_address.port()),
                headers: vec![KeyValue {
                    name: "Proxy-Authorization".into(),
                    value: "Basic d3Jvbmc6d3Jvbmc=".into(),
                    enabled: true,
                }],
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    proxy_mode: "custom".into(),
                    proxy_url: format!(
                        "http://proxy-user:proxy-pass@127.0.0.1:{}",
                        proxy_address.port()
                    ),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        disconnect_websocket("proxied-websocket".into(), state.clone())
            .await
            .unwrap();
        proxy.await.unwrap();

        let bypassed = connect_websocket(
            StreamConnectInput {
                session_id: "bypassed-websocket-proxy".into(),
                url: format!("ws://127.0.0.1:{}/socket", target_address.port()),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    proxy_mode: "custom".into(),
                    proxy_url: "http://127.0.0.1:1".into(),
                    proxy_exclusions: "127.0.0.0/8".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(bypassed.status, 101);
        disconnect_websocket("bypassed-websocket-proxy".into(), state)
            .await
            .unwrap();
        target_server.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn connects_wss_through_proxy_with_scoped_client_identity() {
        use tokio::net::TcpListener;
        use tokio_rustls::TlsAcceptor;

        let target_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_address = target_listener.local_addr().unwrap();
        let target_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(true)));
        let target_server = tokio::spawn(async move {
            let (stream, _) = target_listener.accept().await.unwrap();
            let tls = target_acceptor.accept(stream).await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(tls).await.unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let proxy_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_address = proxy_listener.local_addr().unwrap();
        let proxy = tokio::spawn(async move {
            let (mut downstream, _) = proxy_listener.accept().await.unwrap();
            let request = read_test_http_request(&mut downstream).await;
            assert_eq!(request.method, "CONNECT");
            assert_eq!(
                request.target,
                format!("upstream.invalid:{}", target_address.port())
            );
            assert_eq!(
                request
                    .headers
                    .get("proxy-authorization")
                    .map(String::as_str),
                Some("Basic d3NzLXVzZXI6d3NzLXBhc3M=")
            );
            let mut upstream = TcpStream::connect(target_address).await.unwrap();
            downstream
                .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                .await
                .unwrap();
            tokio::io::copy_bidirectional(&mut downstream, &mut upstream)
                .await
                .unwrap();
        });

        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "proxied-wss-identity".into(),
                url: format!("wss://upstream.invalid:{}/socket", target_address.port()),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    validate_certificates: false,
                    proxy_mode: "custom".into(),
                    proxy_url: format!(
                        "http://wss-user:wss-pass@127.0.0.1:{}",
                        proxy_address.port()
                    ),
                    client_certificate_pem: TLS_CLIENT_CERTIFICATE.into(),
                    client_key_pem: TLS_CLIENT_KEY.into(),
                    client_certificate_domains: "upstream.invalid".into(),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        disconnect_websocket("proxied-wss-identity".into(), state)
            .await
            .unwrap();
        proxy.await.unwrap();
        target_server.await.unwrap();
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn connects_websocket_through_https_proxy_when_validation_is_disabled() {
        use tokio::net::TcpListener;
        use tokio_rustls::TlsAcceptor;

        let target_port = 31_337;

        let proxy_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_address = proxy_listener.local_addr().unwrap();
        let proxy_acceptor = TlsAcceptor::from(Arc::new(test_tls_server_config(false)));
        let proxy = tokio::spawn(async move {
            let (stream, _) = proxy_listener.accept().await.unwrap();
            let downstream = proxy_acceptor.accept(stream).await.unwrap();
            let mut socket = tokio_tungstenite::accept_hdr_async(
                downstream,
                move |request: &http::Request<()>, response: http::Response<()>| {
                    assert_eq!(
                        request.uri().to_string(),
                        format!("http://upstream.invalid:{target_port}/socket")
                    );
                    assert_eq!(
                        request
                            .headers()
                            .get("proxy-connection")
                            .and_then(|value| value.to_str().ok()),
                        Some("close")
                    );
                    Ok(response)
                },
            )
            .await
            .unwrap();
            assert!(matches!(socket.next().await, Some(Ok(Message::Close(_)))));
        });

        let state = StreamingState::default();
        let output = connect_websocket(
            StreamConnectInput {
                session_id: "https-proxied-websocket".into(),
                url: format!("ws://upstream.invalid:{target_port}/socket"),
                headers: vec![KeyValue {
                    name: "Proxy-Connection".into(),
                    value: "close".into(),
                    enabled: true,
                }],
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    validate_certificates: false,
                    proxy_mode: "custom".into(),
                    proxy_url: format!("https://127.0.0.1:{}", proxy_address.port()),
                    ..Default::default()
                },
                sse: crate::models::SseConfig::default(),
                graphql_subscription: None,
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        disconnect_websocket("https-proxied-websocket".into(), state)
            .await
            .unwrap();
        proxy.await.unwrap();
    }

    #[test]
    fn builds_socket_io_handshakes_and_namespaced_packets() {
        let target =
            socket_io_target("https://api.example.test/orders?token=abc", "custom-path").unwrap();
        let polling_url = socket_io_transport_url(&target, "polling", None).unwrap();
        let websocket_url =
            socket_io_transport_url(&target, "websocket", Some("engine-1")).unwrap();
        assert_eq!(polling_url.scheme(), "https");
        assert_eq!(websocket_url.scheme(), "wss");
        assert_eq!(polling_url.path(), "/custom-path/");
        assert_eq!(target.namespace, "/orders");
        assert!(polling_url
            .query_pairs()
            .any(|(name, value)| name == "EIO" && value == "4"));
        assert!(polling_url
            .query_pairs()
            .any(|(name, value)| name == "transport" && value == "polling"));
        assert!(websocket_url
            .query_pairs()
            .any(|(name, value)| name == "sid" && value == "engine-1"));
        assert_eq!(
            socket_io_connect_packet(&target.namespace, "secret").unwrap(),
            "40/orders,{\"token\":\"secret\"}"
        );
        assert_eq!(
            socket_io_event_packet(
                &target.namespace,
                "message",
                &[serde_json::json!({ "id": 42 }), Value::String("ok".into())],
                Some(7),
            )
            .unwrap(),
            "42/orders,7[\"message\",{\"id\":42},\"ok\"]"
        );
    }

    #[test]
    fn parses_socket_io_events_and_acknowledgements() {
        assert_eq!(
            parse_socket_io_event("42/orders,9[\"order.created\",{\"id\":42},true]"),
            Some(SocketIoEventPacket {
                namespace: "/orders".into(),
                event_name: "order.created".into(),
                args: vec![serde_json::json!({ "id": 42 }), Value::Bool(true)],
                ack_id: Some(9),
            })
        );
        assert_eq!(
            parse_socket_io_ack("4312[\"accepted\",42]"),
            Some((
                "/".into(),
                12,
                vec![Value::String("accepted".into()), Value::Number(42.into())],
            ))
        );
        assert!(parse_socket_io_event("451-[{\"_placeholder\":true,\"num\":0}]").is_none());
    }

    #[test]
    fn reconstructs_socket_io_binary_events_and_acknowledgements() {
        let mut event = parse_socket_io_binary_packet(
            "452-/orders,12[\"order.binary\",{\"nested\":[{\"_placeholder\":true,\"num\":1},{\"_placeholder\":true,\"num\":0}]}]",
        )
        .unwrap()
        .unwrap();
        event.attachments = vec![vec![0, 1, 255], vec![2, 3]];
        event.total_bytes = 5;
        match hydrate_socket_io_binary_packet(event).unwrap() {
            HydratedSocketIoBinaryPacket::Event {
                namespace,
                event_name,
                args,
            } => {
                assert_eq!(namespace, "/orders");
                assert_eq!(event_name, "order.binary");
                assert_eq!(
                    args,
                    vec![serde_json::json!({
                        "nested": [
                            { "type": "Buffer", "data": [2, 3] },
                            { "type": "Buffer", "data": [0, 1, 255] }
                        ]
                    })]
                );
            }
            HydratedSocketIoBinaryPacket::Ack { .. } => panic!("expected a binary event"),
        }

        let mut ack =
            parse_socket_io_binary_packet("461-/orders,7[{\"_placeholder\":true,\"num\":0}]")
                .unwrap()
                .unwrap();
        ack.attachments = vec![vec![9, 8]];
        ack.total_bytes = 2;
        match hydrate_socket_io_binary_packet(ack).unwrap() {
            HydratedSocketIoBinaryPacket::Ack {
                namespace,
                ack_id,
                args,
            } => {
                assert_eq!(namespace, "/orders");
                assert_eq!(ack_id, 7);
                assert_eq!(
                    args,
                    vec![serde_json::json!({ "type": "Buffer", "data": [9, 8] })]
                );
            }
            HydratedSocketIoBinaryPacket::Event { .. } => panic!("expected a binary ack"),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn upgrades_socket_io_polling_and_runs_emit_ack_and_listener() {
        use std::{sync::mpsc as std_mpsc, time::Duration};
        use tauri::ipc::InvokeResponseBody;
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut polling, _) = listener.accept().await.unwrap();
            let request = read_test_http_request(&mut polling).await;
            assert_eq!(request.method, "GET");
            assert!(request.target.starts_with("/custom/?token=abc&"));
            assert!(request.target.contains("EIO=4"));
            assert!(request.target.contains("transport=polling"));
            write_test_http_response(
                &mut polling,
                "0{\"sid\":\"engine-1\",\"upgrades\":[\"websocket\"],\"pingInterval\":25000,\"pingTimeout\":20000,\"maxPayload\":1000000}",
            )
            .await;

            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_async(stream).await.unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "2probe"
            );
            socket.send(Message::Text("3probe".into())).await.unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "5"
            );
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "40/orders,{\"token\":\"secret\"}"
            );
            socket
                .send(Message::Text("40/orders,{\"sid\":\"socket-1\"}".into()))
                .await
                .unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "42/orders,1[\"message\",{\"id\":42}]"
            );
            socket
                .send(Message::Text(
                    "461-/orders,1[{\"_placeholder\":true,\"num\":0}]".into(),
                ))
                .await
                .unwrap();
            socket
                .send(Message::Binary(vec![9, 8].into()))
                .await
                .unwrap();
            socket
                .send(Message::Text(
                    "42/orders,[\"order.updated\",{\"id\":42,\"status\":\"ready\"}]".into(),
                ))
                .await
                .unwrap();
            socket
                .send(Message::Text(
                    "451-/orders,[\"order.binary\",{\"_placeholder\":true,\"num\":0}]".into(),
                ))
                .await
                .unwrap();
            socket
                .send(Message::Binary(vec![0, 1, 255].into()))
                .await
                .unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "41/orders,"
            );
        });

        let (event_sender, event_receiver) = std_mpsc::channel();
        let channel = Channel::<StreamEvent>::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                let _ = event_sender.send(serde_json::from_str::<Value>(&json)?);
            }
            Ok(())
        });
        let state = StreamingState::default();
        let output = connect_socket_io(
            SocketIoConnectInput {
                session_id: "socket-session".into(),
                url: format!("http://{address}/orders?token=abc"),
                headers: Vec::new(),
                path: "/custom".into(),
                auth_token: "secret".into(),
                event_listeners: vec!["order.updated".into(), "order.binary".into()],
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    ..Default::default()
                },
            },
            channel,
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        assert_eq!(output.http_version, "HTTP/1.1");
        assert_eq!(output.transport, "WebSocket");
        send_socket_io_message(
            "socket-session".into(),
            "message".into(),
            vec![serde_json::json!({ "id": 42 })],
            true,
            state.clone(),
        )
        .await
        .unwrap();

        let mut events = Vec::new();
        while events.len() < 8 {
            events.push(event_receiver.recv_timeout(Duration::from_secs(2)).unwrap());
            if events.iter().any(|event| event["kind"] == "message · ack")
                && events.iter().any(|event| {
                    event["direction"] == "incoming" && event["kind"] == "order.updated"
                })
                && events.iter().any(|event| {
                    event["direction"] == "incoming" && event["kind"] == "order.binary"
                })
            {
                break;
            }
        }
        assert!(events.iter().any(|event| {
            event["kind"] == "open"
                && event["text"]
                    .as_str()
                    .unwrap()
                    .contains("transport WebSocket")
        }));
        assert!(events.iter().any(|event| {
            event["kind"] == "upgrade" && event["text"] == "Upgraded from polling to WebSocket"
        }));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "outgoing" && event["kind"] == "message"));
        assert!(events.iter().any(|event| event["kind"] == "message · ack"));
        assert!(events.iter().any(|event| {
            event["kind"] == "message · ack" && event["text"].as_str().unwrap().contains("Buffer")
        }));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "incoming" && event["kind"] == "order.updated"));
        assert!(events.iter().any(|event| {
            event["direction"] == "incoming"
                && event["kind"] == "order.binary"
                && event["text"].as_str().unwrap().contains("255")
        }));
        disconnect_socket_io("socket-session".into(), state)
            .await
            .unwrap();
        server.await.unwrap();
    }

    #[allow(clippy::result_large_err)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn upgrades_socket_io_through_custom_http_proxy() {
        use tokio::net::TcpListener;

        let target_port = 31_338;

        let proxy_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_address = proxy_listener.local_addr().unwrap();
        let proxy = tokio::spawn(async move {
            let (mut polling, _) = proxy_listener.accept().await.unwrap();
            let request = read_test_http_request(&mut polling).await;
            assert_eq!(request.method, "GET");
            assert!(request
                .target
                .starts_with(&format!("http://upstream.invalid:{target_port}/custom/")));
            assert!(request.target.contains("transport=polling"));
            write_test_http_response(
                &mut polling,
                "0{\"sid\":\"proxy-engine\",\"upgrades\":[\"websocket\"],\"pingInterval\":25000,\"pingTimeout\":20000,\"maxPayload\":1000000}",
            )
            .await;

            let (downstream, _) = proxy_listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_hdr_async(
                downstream,
                move |request: &http::Request<()>, response: http::Response<()>| {
                    let target = request.uri().to_string();
                    assert!(target
                        .starts_with(&format!("http://upstream.invalid:{target_port}/custom/")));
                    assert!(target.contains("transport=websocket"));
                    assert!(target.contains("sid=proxy-engine"));
                    Ok(response)
                },
            )
            .await
            .unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "2probe"
            );
            socket.send(Message::Text("3probe".into())).await.unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "5"
            );
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "40/orders,"
            );
            socket
                .send(Message::Text("40/orders,{\"sid\":\"proxy-socket\"}".into()))
                .await
                .unwrap();
            assert_eq!(
                socket.next().await.unwrap().unwrap().into_text().unwrap(),
                "41/orders,"
            );
        });

        let state = StreamingState::default();
        let output = connect_socket_io(
            SocketIoConnectInput {
                session_id: "proxied-socket-io".into(),
                url: format!("http://upstream.invalid:{target_port}/orders"),
                headers: Vec::new(),
                path: "/custom".into(),
                auth_token: String::new(),
                event_listeners: Vec::new(),
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    proxy_mode: "custom".into(),
                    proxy_url: format!("http://127.0.0.1:{}", proxy_address.port()),
                    ..Default::default()
                },
            },
            discard_stream_channel(),
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 101);
        assert_eq!(output.transport, "WebSocket");
        disconnect_socket_io("proxied-socket-io".into(), state)
            .await
            .unwrap();
        proxy.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn keeps_socket_io_polling_when_websocket_upgrade_is_unavailable() {
        use std::{sync::mpsc as std_mpsc, time::Duration};
        use tauri::ipc::InvokeResponseBody;
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut open_stream, _) = listener.accept().await.unwrap();
            let open_request = read_test_http_request(&mut open_stream).await;
            assert_eq!(open_request.method, "GET");
            assert!(open_request.target.contains("transport=polling"));
            write_test_http_response(
                &mut open_stream,
                "0{\"sid\":\"polling-1\",\"upgrades\":[],\"pingInterval\":25000,\"pingTimeout\":20000,\"maxPayload\":1000000}",
            )
            .await;

            let (mut connect_stream, _) = listener.accept().await.unwrap();
            let connect_request = read_test_http_request(&mut connect_stream).await;
            assert_eq!(connect_request.method, "POST");
            assert!(connect_request.target.contains("sid=polling-1"));
            assert_eq!(connect_request.body, "40/orders,{\"token\":\"secret\"}");
            write_test_http_response(&mut connect_stream, "ok").await;

            let (mut namespace_stream, _) = listener.accept().await.unwrap();
            let namespace_request = read_test_http_request(&mut namespace_stream).await;
            assert_eq!(namespace_request.method, "GET");
            write_test_http_response(&mut namespace_stream, "40/orders,{\"sid\":\"socket-1\"}")
                .await;

            let mut pending_poll = None;
            let mut emitted = false;
            while pending_poll.is_none() || !emitted {
                let (mut stream, _) = listener.accept().await.unwrap();
                let request = read_test_http_request(&mut stream).await;
                if request.method == "GET" {
                    pending_poll = Some(stream);
                } else {
                    assert_eq!(request.method, "POST");
                    assert_eq!(request.body, "42/orders,1[\"message\",{\"id\":42}]");
                    write_test_http_response(&mut stream, "ok").await;
                    emitted = true;
                }
            }
            write_test_http_response(
                pending_poll.as_mut().unwrap(),
                "461-/orders,1[{\"_placeholder\":true,\"num\":0}]\u{001e}bCQg=\u{001e}42/orders,[\"order.updated\",{\"id\":42,\"status\":\"ready\"}]\u{001e}451-/orders,[\"order.binary\",{\"_placeholder\":true,\"num\":0}]\u{001e}bAAH/",
            )
            .await;

            let mut pending_poll = None;
            loop {
                let (mut stream, _) = listener.accept().await.unwrap();
                let request = read_test_http_request(&mut stream).await;
                if request.method == "GET" {
                    pending_poll = Some(stream);
                } else {
                    assert_eq!(request.method, "POST");
                    assert_eq!(request.body, "41/orders,");
                    write_test_http_response(&mut stream, "ok").await;
                    break;
                }
            }
            drop(pending_poll);
        });

        let (event_sender, event_receiver) = std_mpsc::channel();
        let channel = Channel::<StreamEvent>::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                let _ = event_sender.send(serde_json::from_str::<Value>(&json)?);
            }
            Ok(())
        });
        let state = StreamingState::default();
        let output = connect_socket_io(
            SocketIoConnectInput {
                session_id: "polling-session".into(),
                url: format!("http://{address}/orders"),
                headers: Vec::new(),
                path: "/custom".into(),
                auth_token: "secret".into(),
                event_listeners: vec!["order.updated".into(), "order.binary".into()],
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    ..Default::default()
                },
            },
            channel,
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 200);
        assert_eq!(output.http_version, "HTTP/1.1");
        assert_eq!(output.transport, "polling");
        send_socket_io_message(
            "polling-session".into(),
            "message".into(),
            vec![serde_json::json!({ "id": 42 })],
            true,
            state.clone(),
        )
        .await
        .unwrap();

        let mut events = Vec::new();
        while events.len() < 7 {
            events.push(event_receiver.recv_timeout(Duration::from_secs(2)).unwrap());
            if events.iter().any(|event| event["kind"] == "message · ack")
                && events.iter().any(|event| {
                    event["direction"] == "incoming" && event["kind"] == "order.updated"
                })
                && events.iter().any(|event| {
                    event["direction"] == "incoming" && event["kind"] == "order.binary"
                })
            {
                break;
            }
        }
        assert!(events.iter().any(|event| {
            event["kind"] == "open"
                && event["text"]
                    .as_str()
                    .unwrap()
                    .contains("transport polling")
        }));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "outgoing" && event["kind"] == "message"));
        assert!(events.iter().any(|event| event["kind"] == "message · ack"));
        assert!(events.iter().any(|event| {
            event["kind"] == "message · ack" && event["text"].as_str().unwrap().contains("Buffer")
        }));
        assert!(events
            .iter()
            .any(|event| event["direction"] == "incoming" && event["kind"] == "order.updated"));
        assert!(events.iter().any(|event| {
            event["direction"] == "incoming"
                && event["kind"] == "order.binary"
                && event["text"].as_str().unwrap().contains("255")
        }));
        disconnect_socket_io("polling-session".into(), state)
            .await
            .unwrap();
        server.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn reconnects_sse_with_server_retry_and_last_event_id() {
        use std::{sync::mpsc as std_mpsc, time::Duration};
        use tauri::ipc::InvokeResponseBody;
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut initial_stream, _) = listener.accept().await.unwrap();
            let initial_request = read_test_http_request(&mut initial_stream).await;
            assert_eq!(initial_request.method, "GET");
            assert_eq!(
                initial_request.headers.get("accept").map(String::as_str),
                Some("text/event-stream")
            );
            assert!(!initial_request.headers.contains_key("last-event-id"));
            write_test_http_response(
                &mut initial_stream,
                "id: order-1\nretry: 100\nevent: order.created\ndata: first\n\n",
            )
            .await;

            let (mut resumed_stream, _) = listener.accept().await.unwrap();
            let resumed_request = read_test_http_request(&mut resumed_stream).await;
            assert_eq!(
                resumed_request
                    .headers
                    .get("last-event-id")
                    .map(String::as_str),
                Some("order-1")
            );
            write_test_http_response(
                &mut resumed_stream,
                "id: order-2\nevent: order.updated\ndata: second\n\n",
            )
            .await;
        });

        let (event_sender, event_receiver) = std_mpsc::channel();
        let channel = Channel::<StreamEvent>::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                let _ = event_sender.send(serde_json::from_str::<Value>(&json)?);
            }
            Ok(())
        });
        let state = StreamingState::default();
        let output = connect_sse(
            StreamConnectInput {
                session_id: "sse-reconnect-session".into(),
                url: format!("http://{address}/events"),
                headers: Vec::new(),
                transport: crate::models::TransportConfig {
                    timeout_ms: 5_000,
                    ..Default::default()
                },
                sse: crate::models::SseConfig {
                    auto_reconnect: true,
                    reconnect_delay_ms: 1_000,
                    max_reconnects: 3,
                    respect_server_retry: true,
                    send_last_event_id: true,
                },
                graphql_subscription: None,
            },
            channel,
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(output.status, 200);
        assert_eq!(output.http_version, "HTTP/1.1");
        assert_eq!(output.transport, "Server-Sent Events");
        assert_eq!(
            output.headers.get("content-type").map(String::as_str),
            Some("text/plain; charset=UTF-8")
        );

        let mut events = Vec::new();
        while !events.iter().any(|event: &Value| event["text"] == "second") {
            events.push(event_receiver.recv_timeout(Duration::from_secs(3)).unwrap());
        }
        assert!(events
            .iter()
            .any(|event| event["kind"] == "order.created" && event["text"] == "first"));
        assert!(events.iter().any(|event| event["kind"] == "reconnecting"
            && event["text"].as_str().unwrap().contains("100 ms")));
        assert!(events.iter().any(|event| event["kind"] == "open"
            && event["text"].as_str().unwrap().contains("Reconnected")));

        disconnect_sse("sse-reconnect-session".into(), state)
            .await
            .unwrap();
        while !events.iter().any(|event| event["kind"] == "closed") {
            events.push(event_receiver.recv_timeout(Duration::from_secs(3)).unwrap());
        }
        server.await.unwrap();
    }

    #[test]
    fn parses_chunked_multiline_events_and_comments() {
        let mut parser = SseParser::default();
        assert!(parser.push(b": keepalive\nevent: upd").is_empty());
        let events = parser.push(b"ate\ndata: first\ndata: second\n\n");
        assert_eq!(
            events,
            vec![ParsedSseEvent {
                event: "update".into(),
                data: "first\nsecond".into(),
                id: None,
                retry_ms: None,
            }]
        );
    }

    #[test]
    fn supports_crlf_event_boundaries() {
        let mut parser = SseParser::default();
        assert_eq!(
            parser.push(b"data: hello\r\n\r\n"),
            vec![ParsedSseEvent {
                event: "message".into(),
                data: "hello".into(),
                id: None,
                retry_ms: None,
            }]
        );
    }

    #[test]
    fn preserves_last_event_id_and_server_retry_metadata() {
        let mut parser = SseParser::default();
        assert_eq!(
            parser.push(b"id: order-42\nretry: 2500\ndata: ready\n\n"),
            vec![ParsedSseEvent {
                event: "message".into(),
                data: "ready".into(),
                id: Some("order-42".into()),
                retry_ms: Some(2500),
            }]
        );
        assert_eq!(
            parser.push(b"retry: 1200\n\n"),
            vec![ParsedSseEvent {
                event: "message".into(),
                data: String::new(),
                id: None,
                retry_ms: Some(1200),
            }]
        );
        assert!(parser.push(b"id: bad\0id\n\n").is_empty());
    }

    #[test]
    fn applies_unlimited_and_bounded_reconnect_policies() {
        let mut config = crate::models::SseConfig::default();
        assert!(should_reconnect(&config, 50_000));

        config.max_reconnects = 2;
        assert!(should_reconnect(&config, 0));
        assert!(should_reconnect(&config, 1));
        assert!(!should_reconnect(&config, 2));

        config.auto_reconnect = false;
        assert!(!should_reconnect(&config, 0));
    }
}
