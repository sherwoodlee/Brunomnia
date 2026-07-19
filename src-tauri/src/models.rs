use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub name: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePayload {
    pub file_name: String,
    pub mime_type: String,
    pub data_base64: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultipartPart {
    pub name: String,
    pub value: String,
    pub enabled: bool,
    pub kind: String,
    pub file: Option<FilePayload>,
    #[serde(default)]
    pub content_type: String,
    #[serde(default)]
    pub file_name: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransportConfig {
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_true")]
    pub validate_certificates: bool,
    #[serde(default)]
    pub proxy_mode: String,
    #[serde(default)]
    pub proxy_url: String,
    #[serde(default)]
    pub proxy_exclusions: String,
    #[serde(default)]
    pub client_certificate_pem: String,
    #[serde(default)]
    pub client_key_pem: String,
    #[serde(default)]
    pub client_certificate_domains: String,
    #[serde(default)]
    pub preferred_http_version: String,
    #[serde(default = "default_max_redirects")]
    pub max_redirects: i64,
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            follow_redirects: true,
            timeout_ms: default_timeout(),
            validate_certificates: true,
            proxy_mode: "system".into(),
            proxy_url: String::new(),
            proxy_exclusions: String::new(),
            client_certificate_pem: String::new(),
            client_key_pem: String::new(),
            client_certificate_domains: String::new(),
            preferred_http_version: String::new(),
            max_redirects: default_max_redirects(),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseConfig {
    #[serde(default = "default_true")]
    pub auto_reconnect: bool,
    #[serde(default = "default_sse_reconnect_delay")]
    pub reconnect_delay_ms: u64,
    #[serde(default)]
    pub max_reconnects: u32,
    #[serde(default = "default_true")]
    pub respect_server_retry: bool,
    #[serde(default = "default_true")]
    pub send_last_event_id: bool,
}

impl Default for SseConfig {
    fn default() -> Self {
        Self {
            auto_reconnect: true,
            reconnect_delay_ms: default_sse_reconnect_delay(),
            max_reconnects: 0,
            respect_server_retry: true,
            send_last_event_id: true,
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_timeout() -> u64 {
    60_000
}

fn default_max_redirects() -> i64 {
    10
}

fn default_sse_reconnect_delay() -> u64 {
    1_000
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAuthConfig {
    #[serde(default)]
    pub auth_type: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub ntlm_domain: String,
    #[serde(default)]
    pub ntlm_workstation: String,
    #[serde(default)]
    pub netrc: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestInput {
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValue>,
    pub body_mode: String,
    pub body: String,
    pub form_body: Vec<KeyValue>,
    pub multipart_body: Vec<MultipartPart>,
    pub binary_body: Option<FilePayload>,
    #[serde(default)]
    pub auth: NativeAuthConfig,
    #[serde(default)]
    pub transport: TransportConfig,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponseOutput {
    pub status: u16,
    pub status_text: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_base64: Option<String>,
    pub duration_ms: u128,
    pub size_bytes: usize,
    pub set_cookies: Vec<String>,
    pub http_version: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamConnectInput {
    pub session_id: String,
    pub url: String,
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub transport: TransportConfig,
    #[serde(default)]
    pub sse: SseConfig,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamConnectOutput {
    pub status: u16,
    pub status_text: String,
    pub headers: BTreeMap<String, String>,
    pub http_version: String,
    pub duration_ms: u128,
    pub transport: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SocketIoConnectInput {
    pub session_id: String,
    pub url: String,
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub auth_token: String,
    #[serde(default)]
    pub event_listeners: Vec<String>,
    #[serde(default)]
    pub transport: TransportConfig,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEvent {
    pub session_id: String,
    pub direction: String,
    pub kind: String,
    pub text: String,
    pub timestamp: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcSchemaInput {
    pub endpoint: String,
    pub source: String,
    pub proto_text: String,
    pub metadata: Vec<KeyValue>,
    #[serde(default)]
    pub transport: TransportConfig,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMethodInfo {
    pub name: String,
    pub full_name: String,
    pub client_streaming: bool,
    pub server_streaming: bool,
    pub input_type: String,
    pub output_type: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcServiceInfo {
    pub name: String,
    pub full_name: String,
    pub methods: Vec<GrpcMethodInfo>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcSchemaOutput {
    pub services: Vec<GrpcServiceInfo>,
    pub descriptor_set_base64: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcCallInput {
    pub endpoint: String,
    pub service: String,
    pub method: String,
    pub descriptor_set_base64: String,
    pub messages_json: String,
    pub metadata: Vec<KeyValue>,
    #[serde(default)]
    pub transport: TransportConfig,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcCallOutput {
    pub status: String,
    pub call_type: String,
    pub messages: Vec<serde_json::Value>,
    pub duration_ms: u128,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRouteInput {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub headers: Vec<KeyValue>,
    pub body: String,
    pub delay_ms: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerInput {
    pub server_id: String,
    pub host: String,
    pub port: u16,
    pub routes: Vec<MockRouteInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerUpdateInput {
    pub server_id: String,
    pub routes: Vec<MockRouteInput>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerOutput {
    pub base_url: String,
    pub route_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockServerUpdateOutput {
    pub route_count: usize,
}

impl StreamEvent {
    pub fn system(session_id: &str, kind: &str, text: impl Into<String>) -> Self {
        Self {
            session_id: session_id.to_string(),
            direction: "system".to_string(),
            kind: kind.to_string(),
            text: text.into(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn incoming(session_id: &str, kind: &str, text: impl Into<String>) -> Self {
        Self {
            session_id: session_id.to_string(),
            direction: "incoming".to_string(),
            kind: kind.to_string(),
            text: text.into(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn outgoing(session_id: &str, kind: &str, text: impl Into<String>) -> Self {
        Self {
            session_id: session_id.to_string(),
            direction: "outgoing".to_string(),
            kind: kind.to_string(),
            text: text.into(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}
