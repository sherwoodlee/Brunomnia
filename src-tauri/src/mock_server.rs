use crate::models::{
    MockRouteInput, MockServerInput, MockServerOutput, MockServerUpdateInput,
    MockServerUpdateOutput,
};
use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{HeaderMap, Request},
    response::Response,
    Router,
};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{oneshot, Mutex, RwLock};

const MAX_TEMPLATE_REQUEST_BODY_BYTES: usize = 1_000_000;
const MAX_TEMPLATE_SOURCE_CHARS: usize = 1_000_000;
const MAX_TEMPLATE_TOKENS: usize = 1_000;
const MAX_TEMPLATE_NESTING: usize = 20;
const MAX_TEMPLATE_EXPANSION_BYTES: usize = 5_000_000;
const MAX_TEMPLATE_LOCALS: usize = 100;
const MAX_TEMPLATE_LOCAL_VALUE_BYTES: usize = 10_000;
const MAX_MULTIPART_PARTS: usize = 100;
const MAX_MULTIPART_HEADER_BYTES: usize = 16_000;
const MAX_MULTIPART_BOUNDARY_BYTES: usize = 200;
const MAX_MULTIPART_FIELD_NAME_BYTES: usize = 1_000;
const MAX_REQUEST_COLLECTION_VALUES: usize = 1_000;

type TemplateResult<T> = Result<T, String>;

#[derive(Clone, Default)]
pub struct MockServerState {
    servers: Arc<Mutex<HashMap<String, RunningServer>>>,
}

struct RunningServer {
    shutdown: oneshot::Sender<()>,
    routes: Arc<RwLock<Vec<MockRouteInput>>>,
}

#[derive(Clone)]
struct RouteState {
    routes: Arc<RwLock<Vec<MockRouteInput>>>,
}

pub async fn start(
    input: MockServerInput,
    state: MockServerState,
) -> Result<MockServerOutput, String> {
    if input.host != "127.0.0.1" {
        return Err("Mock servers must bind to 127.0.0.1 in this milestone.".into());
    }
    if state.servers.lock().await.contains_key(&input.server_id) {
        return Err("This mock server is already running.".into());
    }
    let listener = tokio::net::TcpListener::bind((input.host.as_str(), input.port))
        .await
        .map_err(|error| format!("Unable to bind mock server: {error}"))?;
    let address = listener.local_addr().map_err(|error| error.to_string())?;
    let route_count = input.routes.iter().filter(|route| route.enabled).count();
    let server_id = input.server_id.clone();
    let routes = Arc::new(RwLock::new(input.routes));
    let app = Router::new()
        .fallback(handle_request)
        .with_state(RouteState {
            routes: routes.clone(),
        });
    let (shutdown, shutdown_receiver) = oneshot::channel();
    let mut servers = state.servers.lock().await;
    if servers.contains_key(&server_id) {
        return Err("This mock server is already running.".into());
    }
    servers.insert(
        server_id.clone(),
        RunningServer {
            shutdown,
            routes: routes.clone(),
        },
    );
    drop(servers);
    let servers = state.servers.clone();
    let cleanup_routes = routes.clone();
    tokio::spawn(async move {
        let result = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_receiver.await;
            })
            .await;
        if let Err(error) = result {
            eprintln!("Mock server failed: {error}");
        }
        let mut servers = servers.lock().await;
        if servers
            .get(&server_id)
            .is_some_and(|server| Arc::ptr_eq(&server.routes, &cleanup_routes))
        {
            servers.remove(&server_id);
        }
    });
    Ok(MockServerOutput {
        base_url: format!("http://{}:{}", address.ip(), address.port()),
        route_count,
    })
}

pub async fn stop(server_id: String, state: MockServerState) -> Result<(), String> {
    let server = state
        .servers
        .lock()
        .await
        .remove(&server_id)
        .ok_or_else(|| "The mock server is not running.".to_string())?;
    server
        .shutdown
        .send(())
        .map_err(|_| "The mock server has already stopped.".to_string())
}

pub async fn update(
    input: MockServerUpdateInput,
    state: MockServerState,
) -> Result<MockServerUpdateOutput, String> {
    let routes = state
        .servers
        .lock()
        .await
        .get(&input.server_id)
        .map(|server| server.routes.clone())
        .ok_or_else(|| "The mock server is not running.".to_string())?;
    let route_count = input.routes.iter().filter(|route| route.enabled).count();
    *routes.write().await = input.routes;
    Ok(MockServerUpdateOutput { route_count })
}

async fn handle_request(State(state): State<RouteState>, request: Request<Body>) -> Response<Body> {
    let method = request.method().as_str();
    let path = request.uri().path();
    if method.eq_ignore_ascii_case("OPTIONS")
        && request
            .headers()
            .contains_key("access-control-request-method")
    {
        let routes = state.routes.read().await;
        let mut methods = routes
            .iter()
            .filter(|route| route.enabled && match_path(&route.path, path).is_some())
            .map(|route| route.method.to_uppercase())
            .collect::<Vec<_>>();
        methods.push("OPTIONS".into());
        methods.sort();
        methods.dedup();
        if methods.len() > 1 {
            return Response::builder()
                .status(204)
                .header("access-control-allow-origin", "*")
                .header("access-control-allow-methods", methods.join(", "))
                .header("access-control-allow-headers", "*")
                .header("access-control-max-age", "600")
                .body(Body::empty())
                .expect("valid mock preflight response");
        }
    }
    let matched = {
        let routes = state.routes.read().await;
        routes.iter().find_map(|route| {
            if route.enabled && route.method.eq_ignore_ascii_case(method) {
                match_path(&route.path, path).map(|parameters| (route.clone(), parameters))
            } else {
                None
            }
        })
    };

    let Some((route, parameters)) = matched else {
        return Response::builder()
            .status(404)
            .header("content-type", "application/json")
            .header("access-control-allow-origin", "*")
            .body(Body::from(
                r#"{"error":"No enabled mock route matched this request."}"#,
            ))
            .expect("valid mock 404 response");
    };
    let query = request.uri().query().unwrap_or_default().to_string();
    let request_path = request.uri().path().to_string();
    let headers = request.headers().clone();
    let (_, request_body) = request.into_parts();
    let request_bytes = to_bytes(request_body, MAX_TEMPLATE_REQUEST_BODY_BYTES)
        .await
        .unwrap_or_default();
    let template_data = RequestTemplateData::new(
        &headers,
        &query,
        &request_path,
        String::from_utf8(request_bytes.to_vec()).unwrap_or_default(),
        parameters,
    );
    if route.delay_ms > 0 {
        tokio::time::sleep(std::time::Duration::from_millis(route.delay_ms.min(30_000))).await;
    }
    let rendered_body = match render_template(&route.body, &template_data) {
        Ok(body) => body,
        Err(message) => {
            return Response::builder()
                .status(500)
                .header("content-type", "application/json")
                .header("access-control-allow-origin", "*")
                .header("access-control-expose-headers", "*")
                .header("x-brunomnia-mock-route", &route.id)
                .header("x-brunomnia-mock-name", &route.name)
                .body(Body::from(
                    serde_json::json!({
                        "error": "Error rendering body template",
                        "message": message,
                    })
                    .to_string(),
                ))
                .expect("valid mock template error response");
        }
    };
    let mut response = Response::builder()
        .status(route.status)
        .header("access-control-allow-origin", "*")
        .header("access-control-expose-headers", "*")
        .header("x-brunomnia-mock-route", &route.id)
        .header("x-brunomnia-mock-name", &route.name);
    for header in route.headers.iter().filter(|header| header.enabled) {
        response = response.header(&header.name, &header.value);
    }
    response
        .body(Body::from(rendered_body))
        .unwrap_or_else(|error| {
            Response::builder()
                .status(500)
                .body(Body::from(format!("Invalid mock response: {error}")))
                .expect("valid mock error response")
        })
}

#[derive(Debug, Default)]
struct RequestTemplateData {
    headers: HashMap<String, String>,
    query_params: JsonValue,
    path_segments: JsonValue,
    body: String,
    body_fields: JsonValue,
    path_parameters: HashMap<String, String>,
}

impl RequestTemplateData {
    fn new(
        headers: &HeaderMap,
        query: &str,
        path: &str,
        body: String,
        path_parameters: HashMap<String, String>,
    ) -> Self {
        let headers: HashMap<String, String> = headers
            .iter()
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.as_str().to_lowercase(), value.to_string()))
            })
            .collect();
        let mut query_fields = JsonMap::new();
        for (name, value) in
            url::form_urlencoded::parse(query.as_bytes()).take(MAX_REQUEST_COLLECTION_VALUES)
        {
            insert_repeated_field(&mut query_fields, name.into_owned(), value.into_owned());
        }
        let query_params = JsonValue::Object(query_fields);
        let path_segments = JsonValue::Array(
            path.trim_matches('/')
                .split('/')
                .filter(|segment| !segment.is_empty())
                .map(|segment| JsonValue::String(percent_decode_path_segment(segment)))
                .collect(),
        );
        let content_type = headers
            .get("content-type")
            .map(String::as_str)
            .unwrap_or_default();
        let body_fields = parse_body_fields(&body, content_type);
        Self {
            headers,
            query_params,
            path_segments,
            body,
            body_fields,
            path_parameters,
        }
    }
}

fn parse_body_fields(body: &str, content_type: &str) -> JsonValue {
    let mime_type = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    if mime_type == "application/json" || mime_type.ends_with("+json") {
        return serde_json::from_str(body).unwrap_or(JsonValue::Null);
    }
    if mime_type == "application/x-www-form-urlencoded" {
        let mut fields = JsonMap::new();
        for (name, value) in
            url::form_urlencoded::parse(body.as_bytes()).take(MAX_REQUEST_COLLECTION_VALUES)
        {
            insert_repeated_field(&mut fields, name.into_owned(), value.into_owned());
        }
        return JsonValue::Object(fields);
    }
    if matches!(
        mime_type.as_str(),
        "multipart/form-data" | "multipart/mixed" | "multipart/related" | "multipart/alternate"
    ) {
        return header_parameter(content_type, "boundary")
            .filter(|boundary| {
                !boundary.is_empty()
                    && boundary.len() <= MAX_MULTIPART_BOUNDARY_BYTES
                    && !boundary.contains(['\r', '\n', '\0'])
            })
            .and_then(|boundary| parse_multipart_fields(body, &boundary))
            .unwrap_or(JsonValue::Null);
    }
    JsonValue::Null
}

fn header_parameter(header: &str, target: &str) -> Option<String> {
    let parameters_start = header.find(';')? + 1;
    let mut segment_start = parameters_start;
    let mut quote = false;
    let mut escaped = false;
    let bytes = header.as_bytes();
    for index in parameters_start..=header.len() {
        let character = bytes.get(index).copied();
        if escaped {
            escaped = false;
            continue;
        }
        match character {
            Some(b'\\') if quote => escaped = true,
            Some(b'"') => quote = !quote,
            Some(b';') | None if !quote => {
                let segment = header[segment_start..index].trim();
                if let Some((name, value)) = segment.split_once('=') {
                    if name.trim().eq_ignore_ascii_case(target) {
                        let value = value.trim();
                        if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                            let mut unescaped = String::with_capacity(value.len() - 2);
                            let mut escaped = false;
                            for character in value[1..value.len() - 1].chars() {
                                if escaped {
                                    unescaped.push(character);
                                    escaped = false;
                                } else if character == '\\' {
                                    escaped = true;
                                } else {
                                    unescaped.push(character);
                                }
                            }
                            if escaped {
                                return None;
                            }
                            return Some(unescaped);
                        }
                        return Some(value.to_string());
                    }
                }
                segment_start = index + 1;
            }
            _ => {}
        }
    }
    None
}

struct MultipartBoundary {
    start: usize,
    after_line: usize,
    closing: bool,
}

fn find_multipart_boundary(body: &str, delimiter: &str, from: usize) -> Option<MultipartBoundary> {
    let mut cursor = from;
    while let Some(relative_start) = body[cursor..].find(delimiter) {
        let start = cursor + relative_start;
        let at_line_start = start == 0 || body.as_bytes().get(start - 1) == Some(&b'\n');
        let suffix = &body[start + delimiter.len()..];
        let (after_line, closing) = if let Some(after_close) = suffix.strip_prefix("--") {
            if after_close.is_empty() {
                (body.len(), true)
            } else if after_close.starts_with("\r\n") {
                (start + delimiter.len() + 4, true)
            } else if after_close.starts_with('\n') {
                (start + delimiter.len() + 3, true)
            } else {
                cursor = start + delimiter.len();
                continue;
            }
        } else if suffix.starts_with("\r\n") {
            (start + delimiter.len() + 2, false)
        } else if suffix.starts_with('\n') {
            (start + delimiter.len() + 1, false)
        } else {
            cursor = start + delimiter.len();
            continue;
        };
        if at_line_start {
            return Some(MultipartBoundary {
                start,
                after_line,
                closing,
            });
        }
        cursor = start + delimiter.len();
    }
    None
}

fn multipart_part(section: &str) -> Option<(String, String)> {
    let (headers, value) = section
        .split_once("\r\n\r\n")
        .or_else(|| section.split_once("\n\n"))?;
    if headers.len() > MAX_MULTIPART_HEADER_BYTES {
        return None;
    }
    let disposition = headers.lines().find_map(|line| {
        let (name, value) = line.trim_end_matches('\r').split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case("content-disposition")
            .then_some(value.trim())
    })?;
    let name = header_parameter(disposition, "name")?;
    if name.is_empty()
        || name.len() > MAX_MULTIPART_FIELD_NAME_BYTES
        || name.contains(['\r', '\n', '\0'])
    {
        return None;
    }
    Some((name, value.to_string()))
}

fn insert_repeated_field(fields: &mut JsonMap<String, JsonValue>, name: String, value: String) {
    let value = JsonValue::String(value);
    if let Some(existing) = fields.get_mut(&name) {
        if let JsonValue::Array(values) = existing {
            values.push(value);
        } else {
            let previous = std::mem::replace(existing, JsonValue::Null);
            *existing = JsonValue::Array(vec![previous, value]);
        }
    } else {
        fields.insert(name, value);
    }
}

fn parse_multipart_fields(body: &str, boundary: &str) -> Option<JsonValue> {
    let delimiter = format!("--{boundary}");
    let mut current = find_multipart_boundary(body, &delimiter, 0)?;
    let mut fields = JsonMap::new();
    let mut part_count = 0;
    loop {
        if current.closing {
            return Some(JsonValue::Object(fields));
        }
        let next = find_multipart_boundary(body, &delimiter, current.after_line)?;
        let section = body[current.after_line..next.start]
            .strip_suffix("\r\n")
            .or_else(|| body[current.after_line..next.start].strip_suffix('\n'))
            .unwrap_or(&body[current.after_line..next.start]);
        part_count += 1;
        if part_count > MAX_MULTIPART_PARTS {
            return None;
        }
        let (name, value) = multipart_part(section)?;
        insert_repeated_field(&mut fields, name, value);
        current = next;
    }
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_decode_path_segment(segment: &str) -> String {
    if !segment.contains('%') {
        return segment.to_string();
    }
    let bytes = segment.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
            {
                decoded.push(high * 16 + low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded).unwrap_or_else(|_| segment.to_string())
}

fn match_path(pattern: &str, actual: &str) -> Option<HashMap<String, String>> {
    let pattern_parts = pattern.trim_matches('/').split('/').collect::<Vec<_>>();
    let actual_parts = actual.trim_matches('/').split('/').collect::<Vec<_>>();
    if pattern_parts.len() != actual_parts.len() {
        return None;
    }
    let mut parameters = HashMap::new();
    for (expected, received) in pattern_parts.into_iter().zip(actual_parts) {
        let decoded = percent_decode_path_segment(received);
        if expected.starts_with('{') && expected.ends_with('}') {
            parameters.insert(expected.trim_matches(['{', '}']).to_string(), decoded);
        } else if expected != received && expected != decoded {
            return None;
        }
    }
    Some(parameters)
}

fn liquid_delimiter(input: &str, delimiter: &str) -> Option<usize> {
    let bytes = input.as_bytes();
    let mut quote = None;
    let mut escaped = false;
    let mut cursor = 0;
    while cursor < bytes.len() {
        let byte = bytes[cursor];
        if escaped {
            escaped = false;
            cursor += 1;
            continue;
        }
        if quote.is_some() && byte == b'\\' {
            escaped = true;
            cursor += 1;
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            if quote == Some(byte) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(byte);
            }
            cursor += 1;
            continue;
        }
        if quote.is_none()
            && input.is_char_boundary(cursor)
            && input[cursor..].starts_with(delimiter)
        {
            return Some(cursor);
        }
        cursor += 1;
    }
    None
}

fn liquid_hex_value(character: char) -> Option<u32> {
    match character {
        '0'..='9' => Some(character as u32 - '0' as u32),
        'a'..='f' => Some(character as u32 - 'a' as u32 + 10),
        'A'..='F' => Some(character as u32 - 'A' as u32 + 10),
        _ => None,
    }
}

fn liquid_octal_value(character: char) -> Option<u32> {
    match character {
        '0'..='7' => Some(character as u32 - '0' as u32),
        _ => None,
    }
}

fn parse_liquid_string_literal(expression: &str) -> TemplateResult<Option<String>> {
    let Some(quote) = expression.chars().next() else {
        return Ok(None);
    };
    if !matches!(quote, '\'' | '"') {
        return Ok(None);
    }
    if expression.len() < 2 || !expression.ends_with(quote) {
        return Err("Liquid string literal is not closed".into());
    }
    let interior = &expression[quote.len_utf8()..expression.len() - quote.len_utf8()];
    let mut characters = interior.chars().peekable();
    let mut output = String::with_capacity(interior.len());
    while let Some(character) = characters.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }
        let Some(escaped) = characters.next() else {
            return Err("Liquid string escape is incomplete".into());
        };
        match escaped {
            'b' => output.push('\u{0008}'),
            'f' => output.push('\u{000c}'),
            'n' => output.push('\n'),
            'r' => output.push('\r'),
            't' => output.push('\t'),
            'v' => output.push('\u{000b}'),
            'u' => {
                let mut value = 0;
                let mut digits = 0;
                while digits < 4 {
                    let Some(next) = characters.peek().copied() else {
                        break;
                    };
                    let Some(hex) = liquid_hex_value(next) else {
                        break;
                    };
                    characters.next();
                    value = value * 16 + hex;
                    digits += 1;
                }
                output.push(char::from_u32(value).unwrap_or('\u{fffd}'));
            }
            value if liquid_octal_value(value).is_some() => {
                let mut value = liquid_octal_value(value).expect("guarded octal digit");
                let mut digits = 1;
                while digits < 3 {
                    let Some(next) = characters.peek().copied() else {
                        break;
                    };
                    let Some(octal) = liquid_octal_value(next) else {
                        break;
                    };
                    characters.next();
                    value = value * 8 + octal;
                    digits += 1;
                }
                output.push(char::from_u32(value).unwrap_or('\u{fffd}'));
            }
            value => output.push(value),
        }
    }
    Ok(Some(output))
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum AccessPart {
    Literal(String),
    Dynamic(String),
}

fn access_path(suffix: &str) -> TemplateResult<Vec<AccessPart>> {
    let bytes = suffix.as_bytes();
    let mut cursor = 0;
    let mut path = Vec::new();
    while cursor < bytes.len() {
        match bytes[cursor] {
            b'.' => {
                cursor += 1;
                let start = cursor;
                while cursor < bytes.len() && !matches!(bytes[cursor], b'.' | b'[') {
                    cursor += 1;
                }
                if cursor == start {
                    return Err("Liquid property access is invalid".into());
                }
                path.push(AccessPart::Literal(suffix[start..cursor].to_string()));
            }
            b'[' => {
                cursor += 1;
                let start = cursor;
                let mut depth = 1;
                let mut quote = None;
                let mut escaped = false;
                while cursor < bytes.len() {
                    let byte = bytes[cursor];
                    if escaped {
                        escaped = false;
                        cursor += 1;
                        continue;
                    }
                    if quote.is_some() && byte == b'\\' {
                        escaped = true;
                        cursor += 1;
                        continue;
                    }
                    if matches!(byte, b'\'' | b'"') {
                        if quote == Some(byte) {
                            quote = None;
                        } else if quote.is_none() {
                            quote = Some(byte);
                        }
                        cursor += 1;
                        continue;
                    }
                    if quote.is_none() {
                        if byte == b'[' {
                            depth += 1;
                        } else if byte == b']' {
                            depth -= 1;
                            if depth == 0 {
                                break;
                            }
                        }
                    }
                    cursor += 1;
                }
                if cursor >= bytes.len() || quote.is_some() || escaped {
                    return Err("Liquid property access is not closed".into());
                }
                let segment = suffix[start..cursor].trim();
                cursor += 1;
                if segment.is_empty() {
                    return Err("Liquid property access is empty".into());
                }
                if let Some(value) = parse_liquid_string_literal(segment)? {
                    path.push(AccessPart::Literal(value));
                } else if segment.chars().all(|character| character.is_ascii_digit()) {
                    path.push(AccessPart::Literal(segment.to_string()));
                } else {
                    path.push(AccessPart::Dynamic(segment.to_string()));
                }
            }
            _ => return Err("Liquid property access is invalid".into()),
        }
    }
    if path.is_empty() {
        return Err("Liquid property access is empty".into());
    }
    Ok(path)
}

fn json_value_string(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => String::new(),
        JsonValue::String(value) => value.clone(),
        value => value.to_string(),
    }
}

#[derive(Clone, Debug)]
enum LiquidValue {
    Value(JsonValue),
    Empty,
    Blank,
}

fn liquid_value_string(value: &LiquidValue) -> String {
    match value {
        LiquidValue::Value(value) => json_value_string(value),
        LiquidValue::Empty | LiquidValue::Blank => String::new(),
    }
}

fn liquid_property_key(
    part: &AccessPart,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<String> {
    match part {
        AccessPart::Literal(value) => Ok(value.clone()),
        AccessPart::Dynamic(expression) => {
            expression_value_at_depth(expression, data, locals, depth + 1)
                .map(|value| liquid_value_string(&value))
        }
    }
}

fn json_property(value: &JsonValue, key: &str) -> JsonValue {
    match value {
        JsonValue::Object(object) => object.get(key).cloned().unwrap_or(JsonValue::Null),
        JsonValue::Array(array) => match key {
            "size" => JsonValue::from(array.len()),
            "first" => array.first().cloned().unwrap_or(JsonValue::Null),
            "last" => array.last().cloned().unwrap_or(JsonValue::Null),
            _ => key
                .parse::<usize>()
                .ok()
                .and_then(|index| array.get(index))
                .cloned()
                .unwrap_or(JsonValue::Null),
        },
        JsonValue::String(value) => match key {
            "size" => JsonValue::from(value.chars().count()),
            "first" => value
                .chars()
                .next()
                .map(|value| JsonValue::String(value.to_string()))
                .unwrap_or(JsonValue::Null),
            "last" => value
                .chars()
                .next_back()
                .map(|value| JsonValue::String(value.to_string()))
                .unwrap_or(JsonValue::Null),
            _ => key
                .parse::<usize>()
                .ok()
                .and_then(|index| value.chars().nth(index))
                .map(|value| JsonValue::String(value.to_string()))
                .unwrap_or(JsonValue::Null),
        },
        _ => JsonValue::Null,
    }
}

fn liquid_value_at_parts(
    mut value: LiquidValue,
    parts: &[AccessPart],
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    if depth > MAX_TEMPLATE_NESTING {
        return Err("Liquid expression nesting limit exceeded".into());
    }
    for part in parts {
        let key = liquid_property_key(part, data, locals, depth)?;
        value = match value {
            LiquidValue::Value(value) => LiquidValue::Value(json_property(&value, &key)),
            LiquidValue::Empty | LiquidValue::Blank => LiquidValue::Value(JsonValue::Null),
        };
    }
    Ok(value)
}

fn json_value_at_access_value(
    value: &JsonValue,
    suffix: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    if suffix.is_empty() {
        return Ok(LiquidValue::Value(value.clone()));
    }
    let path = access_path(suffix)?;
    liquid_value_at_parts(
        LiquidValue::Value(value.clone()),
        &path,
        data,
        locals,
        depth,
    )
}

#[cfg(test)]
fn json_value_at_access(value: &JsonValue, suffix: &str) -> Option<String> {
    json_value_at_access_value(
        value,
        suffix,
        &RequestTemplateData::default(),
        &HashMap::new(),
        0,
    )
    .ok()
    .map(|value| liquid_value_string(&value))
}

#[cfg(test)]
fn json_value_at_path(value: &JsonValue, path: &str) -> String {
    json_value_at_access(value, &format!(".{path}")).unwrap_or_default()
}

fn access_suffix<'a>(expression: &'a str, prefix: &str) -> Option<&'a str> {
    let suffix = expression.strip_prefix(prefix)?;
    (suffix.is_empty() || suffix.starts_with(['.', '['])).then_some(suffix)
}

fn variable_value_with_depth(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    if depth > MAX_TEMPLATE_NESTING {
        return Err("Liquid expression nesting limit exceeded".into());
    }
    let root_end = expression.find(['.', '[']).unwrap_or(expression.len());
    let root = &expression[..root_end];
    if let Some(value) = locals.get(root) {
        let suffix = &expression[root_end..];
        if suffix.is_empty() {
            return Ok(value.clone());
        }
        let path = access_path(suffix)?;
        return liquid_value_at_parts(value.clone(), &path, data, locals, depth + 1);
    }
    if let Some(name) = expression.strip_prefix("faker.") {
        return Ok(crate::mock_faker::value(name)
            .map(|value| LiquidValue::Value(JsonValue::String(value)))
            .unwrap_or(LiquidValue::Value(JsonValue::Null)));
    }
    if let Some(suffix) = access_suffix(expression, "faker") {
        if !suffix.is_empty() {
            let parts = access_path(suffix)?;
            if parts.len() == 1 {
                let name = liquid_property_key(&parts[0], data, locals, depth + 1)?;
                return Ok(crate::mock_faker::value(&name)
                    .map(|value| LiquidValue::Value(JsonValue::String(value)))
                    .unwrap_or(LiquidValue::Value(JsonValue::Null)));
            }
        }
    }
    match expression {
        "$timestamp" => {
            return Ok(LiquidValue::Value(JsonValue::String(
                chrono::Utc::now().to_rfc3339(),
            )))
        }
        "$randomUUID" => {
            return Ok(LiquidValue::Value(JsonValue::String(
                uuid::Uuid::new_v4().to_string(),
            )))
        }
        "req.body" => return Ok(LiquidValue::Value(JsonValue::String(data.body.clone()))),
        _ => {}
    }
    if let Some(suffix) = access_suffix(expression, "request.path") {
        let value = JsonValue::Object(
            data.path_parameters
                .iter()
                .map(|(key, value)| (key.clone(), JsonValue::String(value.clone())))
                .collect(),
        );
        return json_value_at_access_value(&value, suffix, data, locals, depth + 1);
    }
    if let Some(suffix) = access_suffix(expression, "req.headers") {
        if suffix.is_empty() {
            return Ok(LiquidValue::Value(JsonValue::Object(
                data.headers
                    .iter()
                    .map(|(key, value)| (key.clone(), JsonValue::String(value.clone())))
                    .collect(),
            )));
        }
        let mut parts = access_path(suffix)?;
        let first = liquid_property_key(&parts.remove(0), data, locals, depth + 1)?;
        let value = data
            .headers
            .get(&first.to_lowercase())
            .cloned()
            .map(JsonValue::String)
            .unwrap_or(JsonValue::Null);
        return liquid_value_at_parts(LiquidValue::Value(value), &parts, data, locals, depth + 1);
    }
    if let Some(suffix) = access_suffix(expression, "req.queryParams") {
        return json_value_at_access_value(&data.query_params, suffix, data, locals, depth + 1);
    }
    if let Some(suffix) = access_suffix(expression, "req.pathSegments") {
        return json_value_at_access_value(&data.path_segments, suffix, data, locals, depth + 1);
    }
    if let Some(suffix) = access_suffix(expression, "req.body") {
        return json_value_at_access_value(&data.body_fields, suffix, data, locals, depth + 1);
    }
    Ok(LiquidValue::Value(JsonValue::Null))
}

fn split_liquid_filters(expression: &str) -> Vec<&str> {
    let bytes = expression.as_bytes();
    let mut filters = Vec::new();
    let mut quote = None;
    let mut escaped = false;
    let mut brackets: usize = 0;
    let mut start = 0;
    let mut cursor = 0;
    while cursor < bytes.len() {
        let byte = bytes[cursor];
        if escaped {
            escaped = false;
            cursor += 1;
            continue;
        }
        if quote.is_some() && byte == b'\\' {
            escaped = true;
            cursor += 1;
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            if quote == Some(byte) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(byte);
            }
            cursor += 1;
            continue;
        }
        if quote.is_none() {
            match byte {
                b'[' => brackets += 1,
                b']' => brackets = brackets.saturating_sub(1),
                b'|' if brackets == 0 => {
                    filters.push(expression[start..cursor].trim());
                    start = cursor + 1;
                }
                _ => {}
            }
        }
        cursor += 1;
    }
    filters.push(expression[start..].trim());
    filters
}

fn validate_atomic_expression_syntax(expression: &str) -> TemplateResult<()> {
    let expression = expression.trim();
    if parse_liquid_string_literal(expression)?.is_some()
        || matches!(
            expression,
            "true" | "false" | "nil" | "null" | "empty" | "blank"
        )
        || expression.parse::<f64>().is_ok()
    {
        return Ok(());
    }
    let root_end = expression.find(['.', '[']).unwrap_or(expression.len());
    if root_end == 0 {
        return Err("Liquid expression is invalid".into());
    }
    let suffix = &expression[root_end..];
    if suffix.is_empty() {
        return Ok(());
    }
    for part in access_path(suffix)? {
        if let AccessPart::Dynamic(expression) = part {
            validate_output_expression(&expression)?;
        }
    }
    Ok(())
}

fn validate_output_expression(expression: &str) -> TemplateResult<()> {
    let filters = split_liquid_filters(expression);
    validate_atomic_expression_syntax(filters[0])?;
    for filter in &filters[1..] {
        let Some(default) = filter.strip_prefix("default:") else {
            let name = filter
                .split(|character: char| character == ':' || character.is_ascii_whitespace())
                .next()
                .unwrap_or(filter);
            return Err(format!("filter \"{name}\" unsupported"));
        };
        validate_atomic_expression_syntax(default.trim())?;
    }
    Ok(())
}

fn default_filter_value_at_depth(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    if depth > MAX_TEMPLATE_NESTING {
        return Err("Liquid expression nesting limit exceeded".into());
    }
    let filters = split_liquid_filters(expression);
    let mut value = atomic_expression_value_at_depth(filters[0], data, locals, depth + 1)?;
    for filter in &filters[1..] {
        let Some(default) = filter.strip_prefix("default:") else {
            let name = filter
                .split(|character: char| character == ':' || character.is_ascii_whitespace())
                .next()
                .unwrap_or(filter);
            return Err(format!("filter \"{name}\" unsupported"));
        };
        if liquid_default_empty(&value) {
            value = atomic_expression_value_at_depth(default.trim(), data, locals, depth + 1)?;
        }
    }
    Ok(value)
}

fn output_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
) -> TemplateResult<String> {
    default_filter_value_at_depth(expression, data, locals, 0)
        .map(|value| liquid_value_string(&value))
}

fn expression_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
) -> TemplateResult<LiquidValue> {
    expression_value_at_depth(expression, data, locals, 0)
}

fn expression_value_at_depth(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    default_filter_value_at_depth(expression, data, locals, depth)
}

fn atomic_expression_value_at_depth(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
    depth: usize,
) -> TemplateResult<LiquidValue> {
    if depth > MAX_TEMPLATE_NESTING {
        return Err("Liquid expression nesting limit exceeded".into());
    }
    let expression = expression.trim();
    if let Some(value) = parse_liquid_string_literal(expression)? {
        return Ok(LiquidValue::Value(JsonValue::String(value)));
    }
    match expression {
        "true" => Ok(LiquidValue::Value(JsonValue::Bool(true))),
        "false" => Ok(LiquidValue::Value(JsonValue::Bool(false))),
        "nil" | "null" => Ok(LiquidValue::Value(JsonValue::Null)),
        "empty" => Ok(LiquidValue::Empty),
        "blank" => Ok(LiquidValue::Blank),
        value if value.parse::<i64>().is_ok() => Ok(LiquidValue::Value(JsonValue::Number(
            value.parse::<i64>().expect("guarded integer parse").into(),
        ))),
        value if value.parse::<u64>().is_ok() => Ok(LiquidValue::Value(JsonValue::Number(
            value.parse::<u64>().expect("guarded integer parse").into(),
        ))),
        value if value.parse::<f64>().is_ok() => {
            serde_json::Number::from_f64(value.parse::<f64>().expect("guarded number parse"))
                .map(|value| LiquidValue::Value(JsonValue::Number(value)))
                .ok_or_else(|| "invalid numeric literal".to_string())
        }
        value => variable_value_with_depth(value, data, locals, depth + 1),
    }
}

impl From<JsonValue> for LiquidValue {
    fn from(value: JsonValue) -> Self {
        Self::Value(value)
    }
}

fn liquid_truthy(value: &LiquidValue) -> bool {
    !matches!(
        value,
        LiquidValue::Value(JsonValue::Null | JsonValue::Bool(false))
    )
}

fn liquid_default_empty(value: &LiquidValue) -> bool {
    match value {
        LiquidValue::Empty | LiquidValue::Blank => true,
        LiquidValue::Value(JsonValue::Null | JsonValue::Bool(false)) => true,
        LiquidValue::Value(JsonValue::String(value)) => value.is_empty(),
        LiquidValue::Value(JsonValue::Array(value)) => value.is_empty(),
        _ => false,
    }
}

fn liquid_empty_equals(value: &LiquidValue) -> bool {
    match value {
        LiquidValue::Empty | LiquidValue::Blank => false,
        LiquidValue::Value(JsonValue::String(value)) => value.is_empty(),
        LiquidValue::Value(JsonValue::Array(value)) => value.is_empty(),
        LiquidValue::Value(JsonValue::Object(value)) => value.is_empty(),
        _ => false,
    }
}

fn liquid_blank_equals(value: &LiquidValue) -> bool {
    match value {
        LiquidValue::Empty | LiquidValue::Blank => false,
        LiquidValue::Value(JsonValue::Null | JsonValue::Bool(false)) => true,
        LiquidValue::Value(JsonValue::String(value)) => value.trim().is_empty(),
        value => liquid_empty_equals(value),
    }
}

fn json_equals(left: &JsonValue, right: &JsonValue) -> bool {
    match (left, right) {
        (JsonValue::Number(left), JsonValue::Number(right)) => left.as_f64() == right.as_f64(),
        (JsonValue::Array(left), JsonValue::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right)
                    .all(|(left, right)| json_equals(left, right))
        }
        (JsonValue::Object(left), JsonValue::Object(right)) => {
            left.len() == right.len()
                && left.iter().all(|(key, value)| {
                    right
                        .get(key)
                        .is_some_and(|right| json_equals(value, right))
                })
        }
        _ => left == right,
    }
}

fn liquid_equals(left: &LiquidValue, right: &LiquidValue) -> bool {
    match left {
        LiquidValue::Empty => liquid_empty_equals(right),
        LiquidValue::Blank => liquid_blank_equals(right),
        LiquidValue::Value(left) => match right {
            LiquidValue::Empty => liquid_empty_equals(&LiquidValue::Value(left.clone())),
            LiquidValue::Blank => liquid_blank_equals(&LiquidValue::Value(left.clone())),
            LiquidValue::Value(right) => json_equals(left, right),
        },
    }
}

fn liquid_number(value: &LiquidValue) -> Option<f64> {
    match value {
        LiquidValue::Value(JsonValue::Number(value)) => value.as_f64(),
        LiquidValue::Value(JsonValue::Bool(value)) => Some(if *value { 1.0 } else { 0.0 }),
        LiquidValue::Value(JsonValue::String(value)) => {
            let value = value.trim();
            if value.is_empty() {
                Some(0.0)
            } else {
                value.parse().ok()
            }
        }
        _ => None,
    }
}

fn liquid_compare(left: &LiquidValue, right: &LiquidValue, operator: &str) -> bool {
    if matches!(
        left,
        LiquidValue::Empty | LiquidValue::Blank | LiquidValue::Value(JsonValue::Null)
    ) || matches!(
        right,
        LiquidValue::Empty | LiquidValue::Blank | LiquidValue::Value(JsonValue::Null)
    ) {
        return false;
    }
    if let (
        LiquidValue::Value(JsonValue::String(left)),
        LiquidValue::Value(JsonValue::String(right)),
    ) = (left, right)
    {
        return match operator {
            ">" => left > right,
            "<" => left < right,
            ">=" => left >= right,
            "<=" => left <= right,
            _ => false,
        };
    }
    let Some(left) = liquid_number(left) else {
        return false;
    };
    let Some(right) = liquid_number(right) else {
        return false;
    };
    match operator {
        ">" => left > right,
        "<" => left < right,
        ">=" => left >= right,
        "<=" => left <= right,
        _ => false,
    }
}

fn liquid_contains(left: &LiquidValue, right: &LiquidValue) -> bool {
    match left {
        LiquidValue::Value(JsonValue::String(left)) => left.contains(&liquid_value_string(right)),
        LiquidValue::Value(JsonValue::Array(left)) => left
            .iter()
            .any(|value| liquid_equals(&LiquidValue::Value(value.clone()), right)),
        _ => false,
    }
}

fn condition_operator<'a, 'b>(
    expression: &'a str,
    operators: &'b [&'b str],
) -> Option<(&'a str, &'b str, &'a str)> {
    let bytes = expression.as_bytes();
    let mut quote = None;
    let mut escaped = false;
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if escaped {
            escaped = false;
            index += 1;
            continue;
        }
        if quote.is_some() && byte == b'\\' {
            escaped = true;
            index += 1;
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            if quote == Some(byte) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(byte);
            }
            index += 1;
            continue;
        }
        if quote.is_none() && expression.is_char_boundary(index) {
            for operator in operators {
                if !expression[index..].starts_with(operator) {
                    continue;
                }
                let word = operator.bytes().all(|byte| byte.is_ascii_alphabetic());
                if word {
                    let left = index == 0 || bytes[index - 1].is_ascii_whitespace();
                    let end = index + operator.len();
                    let right = end == bytes.len() || bytes[end].is_ascii_whitespace();
                    if !left || !right {
                        continue;
                    }
                }
                let end = index + operator.len();
                return Some((&expression[..index], operator, &expression[end..]));
            }
        }
        index += 1;
    }
    None
}

fn condition_expression(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
) -> TemplateResult<LiquidValue> {
    let expression = expression.trim();
    if let Some((left, operator, right)) = condition_operator(expression, &["and", "or"]) {
        let left = condition_expression(left, data, locals)?;
        let right = condition_expression(right, data, locals)?;
        return Ok(LiquidValue::Value(JsonValue::Bool(if operator == "and" {
            liquid_truthy(&left) && liquid_truthy(&right)
        } else {
            liquid_truthy(&left) || liquid_truthy(&right)
        })));
    }
    if let Some(rest) = expression.strip_prefix("not ") {
        return Ok(LiquidValue::Value(JsonValue::Bool(!liquid_truthy(
            &condition_expression(rest, data, locals)?,
        ))));
    }
    if let Some((left, operator, right)) =
        condition_operator(expression, &[">=", "<=", "==", "!=", ">", "<", "contains"])
    {
        let left = expression_value(left, data, locals)?;
        let right = expression_value(right, data, locals)?;
        let matches = match operator {
            "==" => liquid_equals(&left, &right),
            "!=" => !liquid_equals(&left, &right),
            "contains" => liquid_contains(&left, &right),
            operator => liquid_compare(&left, &right, operator),
        };
        return Ok(LiquidValue::Value(JsonValue::Bool(matches)));
    }
    expression_value(expression, data, locals)
}

fn condition_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, LiquidValue>,
) -> TemplateResult<bool> {
    condition_expression(expression, data, locals).map(|value| liquid_truthy(&value))
}

struct ConditionalParts<'a> {
    initial: &'a str,
    elsif: Vec<(&'a str, &'a str)>,
    fallback: &'a str,
    remaining: &'a str,
}

struct RawParts<'a> {
    body: &'a str,
    remaining: &'a str,
}

fn raw_parts<'a>(template: &'a str, token_budget: &mut usize) -> TemplateResult<RawParts<'a>> {
    let mut cursor = 0;
    while let Some(relative_start) = template[cursor..].find("{%") {
        if *token_budget == 0 {
            return Err("Liquid render token limit exceeded".into());
        }
        *token_budget -= 1;
        let tag_start = cursor + relative_start;
        let tag_body = &template[tag_start + 2..];
        let tag_end = liquid_delimiter(tag_body, "%}")
            .ok_or_else(|| "Liquid tag is not closed".to_string())?;
        let after_tag = tag_start + 2 + tag_end + 2;
        if tag_body[..tag_end].trim() == "endraw" {
            return Ok(RawParts {
                body: &template[..tag_start],
                remaining: &template[after_tag..],
            });
        }
        cursor = after_tag;
    }
    Err("tag raw not closed".into())
}

fn conditional_parts<'a>(
    template: &'a str,
    closing_tag: &'static str,
    token_budget: &mut usize,
) -> TemplateResult<ConditionalParts<'a>> {
    let mut cursor = 0;
    let mut closing_tags = vec![closing_tag];
    let mut in_raw = false;
    let mut branch_start = 0;
    let mut initial = None;
    let mut current_elsif = None;
    let mut elsif = Vec::new();
    let mut in_else = false;
    loop {
        let output_start = template[cursor..].find("{{").map(|start| cursor + start);
        let tag_start = template[cursor..].find("{%").map(|start| cursor + start);
        if let Some(output_start) = output_start {
            if tag_start.is_none() || Some(output_start) < tag_start {
                let output = &template[output_start + 2..];
                let output_end = liquid_delimiter(output, "}}")
                    .ok_or_else(|| "Liquid output is not closed".to_string())?;
                validate_output_expression(&output[..output_end])?;
                cursor = output_start + 2 + output_end + 2;
                continue;
            }
        }
        let Some(tag_start) = tag_start else {
            break;
        };
        if *token_budget == 0 {
            return Err("Liquid render token limit exceeded".into());
        }
        *token_budget -= 1;
        let tag_body = &template[tag_start + 2..];
        let tag_end = liquid_delimiter(tag_body, "%}")
            .ok_or_else(|| "Liquid tag is not closed".to_string())?;
        let after_tag = tag_start + 2 + tag_end + 2;
        let tag = tag_body[..tag_end].trim();
        if in_raw {
            if tag == "endraw" {
                in_raw = false;
            }
            cursor = after_tag;
            continue;
        }
        match tag.split_whitespace().next().unwrap_or_default() {
            "raw" => in_raw = true,
            "if" => closing_tags.push("endif"),
            "unless" => closing_tags.push("endunless"),
            "endif" | "endunless" if closing_tags.last() == Some(&tag) => {
                closing_tags.pop();
                if closing_tags.is_empty() {
                    let body = &template[branch_start..tag_start];
                    let fallback = if in_else {
                        body
                    } else {
                        if let Some(condition) = current_elsif {
                            elsif.push((condition, body));
                        } else {
                            initial = Some(body);
                        }
                        ""
                    };
                    return Ok(ConditionalParts {
                        initial: initial.unwrap_or_default(),
                        elsif,
                        fallback,
                        remaining: &template[after_tag..],
                    });
                }
            }
            "elsif" if closing_tags.len() == 1 && !in_else => {
                let condition = tag
                    .strip_prefix("elsif")
                    .ok_or_else(|| "invalid elsif tag".to_string())?
                    .trim();
                if condition.is_empty() {
                    return Err("elsif requires a condition".into());
                }
                let body = &template[branch_start..tag_start];
                if let Some(previous) = current_elsif.replace(condition) {
                    elsif.push((previous, body));
                } else {
                    initial = Some(body);
                }
                branch_start = after_tag;
            }
            "else" if closing_tags.len() == 1 && !in_else && tag == "else" => {
                let body = &template[branch_start..tag_start];
                if let Some(condition) = current_elsif.take() {
                    elsif.push((condition, body));
                } else {
                    initial = Some(body);
                }
                in_else = true;
                branch_start = after_tag;
            }
            "elsif" if closing_tags.len() == 1 && in_else => {
                return Err("unexpected elsif after else".into())
            }
            "else" if closing_tags.len() == 1 && in_else => return Err("duplicated else".into()),
            "assign" | "elsif" | "else" | "endif" | "endunless" => {}
            name if !name.is_empty() => return Err(format!("tag \"{name}\" unsupported")),
            _ => {}
        }
        cursor = after_tag;
    }
    Err(format!("tag {closing_tag} not closed"))
}

fn render_fragment(
    template: &str,
    data: &RequestTemplateData,
    locals: &mut HashMap<String, LiquidValue>,
    depth: usize,
    token_budget: &mut usize,
    expansion_budget: &mut usize,
) -> TemplateResult<String> {
    if depth > MAX_TEMPLATE_NESTING {
        return Err("Liquid conditional nesting limit exceeded".into());
    }
    let mut output = String::with_capacity(template.len());
    let mut remaining = template;
    loop {
        let output_start = remaining.find("{{");
        let tag_start = remaining.find("{%");
        let next = match (output_start, tag_start) {
            (None, None) => {
                output.push_str(remaining);
                break;
            }
            (Some(output_start), None) => (output_start, true),
            (None, Some(tag_start)) => (tag_start, false),
            (Some(output_start), Some(tag_start)) if output_start <= tag_start => {
                (output_start, true)
            }
            (Some(_), Some(tag_start)) => (tag_start, false),
        };
        if *token_budget == 0 {
            return Err("Liquid render token limit exceeded".into());
        }
        *token_budget -= 1;
        output.push_str(&remaining[..next.0]);
        if next.1 {
            let token = &remaining[next.0 + 2..];
            let end = liquid_delimiter(token, "}}")
                .ok_or_else(|| "Liquid output is not closed".to_string())?;
            let expression = &token[..end];
            let value = output_value(expression, data, locals)?;
            if value.len() > *expansion_budget {
                return Err("Liquid dynamic expansion limit exceeded".into());
            }
            output.push_str(&value);
            *expansion_budget -= value.len();
            remaining = &token[end + 2..];
            continue;
        }

        let tag_body = &remaining[next.0 + 2..];
        let end = liquid_delimiter(tag_body, "%}")
            .ok_or_else(|| "Liquid tag is not closed".to_string())?;
        let tag = tag_body[..end].trim();
        let after_tag = &tag_body[end + 2..];
        if tag == "raw" {
            let parts = raw_parts(after_tag, token_budget)?;
            output.push_str(parts.body);
            remaining = parts.remaining;
            continue;
        }
        if let Some(assignment) = tag.strip_prefix("assign ") {
            let (name, expression) = assignment
                .split_once('=')
                .ok_or_else(|| "assign requires a name and value".to_string())?;
            let name = name.trim();
            if name.is_empty()
                || name.len() > 100
                || !name
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '_')
            {
                return Err("assign variable name is invalid".into());
            }
            let value = expression_value(expression, data, locals)?;
            if liquid_value_string(&value).len() > MAX_TEMPLATE_LOCAL_VALUE_BYTES {
                return Err("Liquid assigned value limit exceeded".into());
            }
            if !locals.contains_key(name) && locals.len() >= MAX_TEMPLATE_LOCALS {
                return Err("Liquid local variable limit exceeded".into());
            }
            locals.insert(name.to_string(), value);
            remaining = after_tag;
            continue;
        }
        let conditional = tag
            .strip_prefix("if ")
            .map(|condition| (condition, false, "endif"))
            .or_else(|| {
                tag.strip_prefix("unless ")
                    .map(|condition| (condition, true, "endunless"))
            });
        if let Some((condition, invert, closing_tag)) = conditional {
            if depth >= MAX_TEMPLATE_NESTING {
                return Err("Liquid conditional nesting limit exceeded".into());
            }
            let parts = conditional_parts(after_tag, closing_tag, token_budget)?;
            let matches = condition_value(condition, data, locals)? != invert;
            let mut branch = if matches {
                parts.initial
            } else {
                parts.fallback
            };
            if !matches {
                for (condition, body) in &parts.elsif {
                    if condition_value(condition, data, locals)? {
                        branch = body;
                        break;
                    }
                }
            }
            output.push_str(&render_fragment(
                branch,
                data,
                locals,
                depth + 1,
                token_budget,
                expansion_budget,
            )?);
            remaining = parts.remaining;
            continue;
        }
        let name = tag.split_whitespace().next().unwrap_or_default();
        return Err(format!("tag \"{name}\" unsupported"));
    }
    Ok(output)
}

fn render_template(body: &str, data: &RequestTemplateData) -> TemplateResult<String> {
    if body.chars().count() > MAX_TEMPLATE_SOURCE_CHARS {
        return Err("Liquid parse limit exceeded".into());
    }
    let mut token_budget = MAX_TEMPLATE_TOKENS;
    let mut expansion_budget = MAX_TEMPLATE_EXPANSION_BYTES;
    render_fragment(
        body,
        data,
        &mut HashMap::new(),
        0,
        &mut token_budget,
        &mut expansion_budget,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::KeyValue;

    fn render(template: &str, data: &RequestTemplateData) -> String {
        render_template(template, data).expect("template should render")
    }

    #[test]
    fn matches_parameterized_routes() {
        let parameters = match_path("/orders/{orderId}", "/orders/ord_123").unwrap();
        assert_eq!(parameters.get("orderId"), Some(&"ord_123".to_string()));
        let decoded = match_path("/files/{name}", "/files/caf%C3%A9%20menu").unwrap();
        assert_eq!(decoded.get("name"), Some(&"café menu".to_string()));
        assert!(match_path("/café", "/caf%C3%A9").is_some());
        assert!(match_path("/orders/{orderId}", "/customers/ord_123").is_none());
    }

    #[test]
    fn renders_path_and_dynamic_tokens() {
        let data = RequestTemplateData {
            path_parameters: HashMap::from([("id".to_string(), "abc".to_string())]),
            ..Default::default()
        };
        let rendered = render("{{request.path.id}} {{$randomUUID}}", &data);
        assert!(rendered.starts_with("abc "));
        assert!(!rendered.contains("{{$randomUUID}}"));
    }

    #[test]
    fn renders_request_aware_outputs_and_defaults() {
        let data = RequestTemplateData {
            headers: HashMap::from([("content-type".into(), "application/json".into())]),
            query_params: serde_json::json!({ "order": "ord 42" }),
            path_segments: serde_json::json!(["v1", "orders"]),
            body: r#"{"customer":{"name":"Ada"},"quantity":2}"#.into(),
            body_fields: serde_json::json!({ "customer": { "name": "Ada" }, "quantity": 2 }),
            path_parameters: HashMap::new(),
        };
        let rendered = render(
            "{{ req.headers['Content-Type'] }} {{ req.queryParams.order }} {{ req.pathSegments[1] }} {{ req.body.customer.name }} {{ req.body.quantity }} {{ req.body.missing | default: \"fallback\" }} X{{ req.queryParams.missing }}Y {{ future.value }}",
            &data,
        );
        assert_eq!(
            rendered,
            "application/json ord 42 orders Ada 2 fallback XY "
        );
    }

    #[test]
    fn renders_assign_conditionals_and_raw_blocks() {
        let data = RequestTemplateData {
            query_params: serde_json::json!({ "role": "admin" }),
            body_fields: serde_json::json!({
                "customer": { "name": "Ada" },
                "disabled": false
            }),
            ..Default::default()
        };
        let rendered = render(
            r#"{% if req.queryParams.role == "admin" %}{% assign greeting = "Hello" %}{{ greeting }} {{ req.body.customer.name }}{% unless req.body.disabled %}!{% endunless %}{% else %}denied{% endif %}|{{ greeting }}|{% unless req.body.disabled %}enabled{% endunless %}|{% raw %}{{ req.body.customer.name }} {% if future.value %}{%   endraw   %}"#,
            &data,
        );
        assert_eq!(
            rendered,
            "Hello Ada!|Hello|enabled|{{ req.body.customer.name }} {% if future.value %}"
        );
    }

    #[test]
    fn renders_liquid_condition_operators_elsif_and_truthiness() {
        let data = RequestTemplateData {
            query_params: serde_json::json!({
                "count": "12",
                "role": "editor",
                "empty": "",
                "phrase": "salt and or pepper"
            }),
            body_fields: serde_json::json!({
                "tags": ["one", "two"],
                "emptyArray": [],
                "enabled": false,
                "zero": 0,
                "and": "property",
                "café": "oui"
            }),
            ..Default::default()
        };
        let rendered = render(
            concat!(
                r#"{% if req.queryParams.count > 20 %}high{% elsif req.queryParams.count >= 10 and req.queryParams.role contains "dit" %}mid{% else %}low{% endif %}"#,
                r#"|{% if req.queryParams.count == 12 %}coerced{% else %}strict{% endif %}"#,
                r#"|{% if req.body.tags contains "two" %}contains{% endif %}"#,
                r#"|{% if not req.body.enabled %}not{% endif %}"#,
                r#"|{% if false and false or true %}wrong{% else %}right{% endif %}"#,
                r#"|{% if req.queryParams.empty %}empty-string{% endif %}"#,
                r#"|{% if req.body.emptyArray %}empty-array{% endif %}"#,
                r#"|{% if req.queryParams.missing %}missing{% endif %}"#,
                r#"|{% if req.queryParams.count <= 12 %}lte{% endif %}"#,
                r#"|{% if req.queryParams.empty == empty and req.body.emptyArray == empty %}empty{% endif %}"#,
                r#"|{% if "   " == blank %}blank{% endif %}"#,
                r#"|{% if req.queryParams.phrase contains "and or" and req.body.and == "property" %}quoted{% endif %}"#,
                r#"|{% if req.body.café == "oui" %}unicode{% endif %}"#,
                r#"|{% unless true %}first{% elsif req.queryParams.count == "12" %}second{% else %}third{% endunless %}"#,
            ),
            &data,
        );
        assert_eq!(
            rendered,
            "mid|strict|contains|not|right|empty-string|empty-array||lte|empty|blank|quoted|unicode|second"
        );
    }

    #[test]
    fn renders_liquid_escaped_strings_and_dynamic_properties() {
        let data = RequestTemplateData {
            headers: HashMap::from([("x-client".to_string(), "client".to_string())]),
            body_fields: serde_json::json!({
                "keys": { "selected": "profile.name" },
                "profile.name": "Ada",
                "lookup": { "one": "found" },
                "items": ["zero", "one"],
                "headerName": "X-Client",
                "what's this": "quoted"
            }),
            ..Default::default()
        };
        let rendered = render(
            r#"{% assign key = req.body.keys.selected %}{% assign copy = req.body.items %}{{ req.body[key] }}|{{ req.body.lookup[req.body.items[1]] }}|{{ copy[1] }}|{{ copy.size }}|{{ req.headers[req.body.headerName] }}|{{ req.body["what\'s this"] }}|{{ "line\nquote:\" slash:\\ tab:\t unicode:\u263a octal:\101 unknown:\z close:}}" }}|{{ req.body.missing | default: "a|b" }}|{{ req.body.missing | default: "" | default: "second" }}|{% assign marker = "%} }}" %}{{ marker }}|{% if true %}{{ "{% endif %}" }}{% endif %}"#,
            &data,
        );
        assert_eq!(
            rendered,
            "Ada|found|one|2|client|quoted|line\nquote:\" slash:\\ tab:\t unicode:☺ octal:A unknown:z close:}}|a|b|second|%} }}|{% endif %}"
        );
    }

    #[test]
    fn applies_liquid_default_to_false_nil_and_empty_collections_only() {
        let data = RequestTemplateData {
            query_params: serde_json::json!({ "empty": "" }),
            body_fields: serde_json::json!({
                "enabled": false,
                "emptyArray": [],
                "zero": 0
            }),
            ..Default::default()
        };
        assert_eq!(
            render(
                r#"{{ req.body.enabled | default: "false" }}|{{ req.body.missing | default: "nil" }}|{{ req.body.emptyArray | default: "array" }}|{{ req.queryParams.empty | default: "string" }}|{{ req.body.zero | default: "zero" }}"#,
                &data,
            ),
            "false|nil|array|string|0"
        );
    }

    #[test]
    fn renders_faker_outputs_and_empty_unknown_names() {
        let rendered = render(
            "{{ faker.guid }}|{{ faker.randomFullName }}|{{ faker.randomBoolean }}|{{ faker.notDocumented }}",
            &RequestTemplateData::default(),
        );
        let values = rendered.split('|').collect::<Vec<_>>();
        assert_eq!(values.len(), 4);
        assert!(uuid::Uuid::parse_str(values[0]).is_ok());
        assert!(!values[1].is_empty());
        assert!(matches!(values[2], "true" | "false"));
        assert_eq!(values[3], "");
    }

    #[test]
    fn bounds_nested_and_total_control_evaluation() {
        assert_eq!(
            render_template(
                &"x".repeat(MAX_TEMPLATE_SOURCE_CHARS + 1),
                &RequestTemplateData::default(),
            )
            .unwrap_err(),
            "Liquid parse limit exceeded"
        );
        let nested = format!(
            "{}value{}",
            "{% if true %}".repeat(MAX_TEMPLATE_NESTING + 1),
            "{% endif %}".repeat(MAX_TEMPLATE_NESTING + 1)
        );
        assert!(render_template(&nested, &RequestTemplateData::default())
            .unwrap_err()
            .contains("nesting limit"));

        let repeated = "{{ req.queryParams.missing }}".repeat(MAX_TEMPLATE_TOKENS + 1);
        assert!(render_template(&repeated, &RequestTemplateData::default())
            .unwrap_err()
            .contains("token limit"));

        let expansion_data = RequestTemplateData {
            body: "x".repeat(MAX_TEMPLATE_REQUEST_BODY_BYTES),
            ..Default::default()
        };
        let expansion = "{{ req.body }}".repeat(6);
        assert!(render_template(&expansion, &expansion_data)
            .unwrap_err()
            .contains("expansion limit"));

        let oversized_local_data = RequestTemplateData {
            body: "x".repeat(MAX_TEMPLATE_LOCAL_VALUE_BYTES + 1),
            ..Default::default()
        };
        let oversized_assignment = "{% assign copy = req.body %}{{ copy }}";
        assert!(render_template(oversized_assignment, &oversized_local_data)
            .unwrap_err()
            .contains("assigned value limit"));

        let unsupported = "{% for item in items %}x{% endfor %}";
        assert_eq!(
            render_template(unsupported, &RequestTemplateData::default()).unwrap_err(),
            "tag \"for\" unsupported"
        );
    }

    #[test]
    fn rejects_unsupported_filters_and_malformed_control_syntax() {
        let data = RequestTemplateData::default();
        assert_eq!(
            render_template("{{ req.body | uppercase }}", &data).unwrap_err(),
            "filter \"uppercase\" unsupported"
        );
        assert!(render_template("{% if true %}open", &data)
            .unwrap_err()
            .contains("endif not closed"));
        assert_eq!(
            render_template("{% raw %}open", &data).unwrap_err(),
            "tag raw not closed"
        );
        assert_eq!(
            render_template("{% if false %}a{% else %}b{% else %}c{% endif %}", &data).unwrap_err(),
            "duplicated else"
        );
        assert_eq!(
            render_template(
                "{% if false %}a{% else %}b{% elsif true %}c{% endif %}",
                &data,
            )
            .unwrap_err(),
            "unexpected elsif after else"
        );
        assert_eq!(
            render_template("{% assign invalid-name = true %}", &data).unwrap_err(),
            "assign variable name is invalid"
        );
        assert_eq!(
            render_template(
                "{% if false %}{% for item in items %}x{% endfor %}{% endif %}",
                &data
            )
            .unwrap_err(),
            "tag \"for\" unsupported"
        );
        assert_eq!(
            render_template("{{ req.body", &data).unwrap_err(),
            "Liquid output is not closed"
        );
        assert_eq!(
            render_template("{{ req.body[missing }}", &data).unwrap_err(),
            "Liquid property access is not closed"
        );
        assert_eq!(
            render_template("{{ \"open }}", &data).unwrap_err(),
            "Liquid output is not closed"
        );
        assert_eq!(
            render_template(
                "{% if false %}{{ req.body | uppercase }}{% else %}ok{% endif %}",
                &data,
            )
            .unwrap_err(),
            "filter \"uppercase\" unsupported"
        );
    }

    #[test]
    fn parses_json_and_form_request_fields() {
        let json = parse_body_fields(
            r#"{"items":[{"id":"one"}],"profile.name":"Ada"}"#,
            "application/problem+json",
        );
        assert_eq!(
            json_value_at_access(&json, ".items[0]['id']"),
            Some("one".into())
        );
        assert_eq!(
            json_value_at_access(&json, "['profile.name']"),
            Some("Ada".into())
        );
        assert_eq!(json_value_at_path(&json, "items.0.id"), "one");
        assert_eq!(
            json_value_at_path(
                &parse_body_fields("name=Ada+Lovelace", "application/x-www-form-urlencoded"),
                "name"
            ),
            "Ada Lovelace"
        );
    }

    #[test]
    fn preserves_repeated_query_and_form_values_with_bounded_access() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "content-type",
            "application/x-www-form-urlencoded".parse().unwrap(),
        );
        let data = RequestTemplateData::new(
            &headers,
            "tag=one&tag=two&na.me=query+value",
            "/caf%C3%A9/a%2Fb/+",
            "tag=red&tag=blue&profile.name=Ada+Lovelace".into(),
            HashMap::new(),
        );
        let rendered = render(
            "{{ req.queryParams.tag[0] }}|{{ req.queryParams.tag.1 }}|{{ req.queryParams['na.me'] }}|{{ req.body.tag[0] }}|{{ req.body['tag'][1] }}|{{ req.body['profile.name'] }}|{{ req.pathSegments[0] }}|{{ req.pathSegments.1 }}|{{ req.pathSegments[2] }}",
            &data,
        );
        assert_eq!(
            rendered,
            "one|two|query value|red|blue|Ada Lovelace|café|a/b|+"
        );

        let repeated = (0..=MAX_REQUEST_COLLECTION_VALUES)
            .map(|index| format!("item={index}"))
            .collect::<Vec<_>>()
            .join("&");
        let bounded = RequestTemplateData::new(
            &HeaderMap::new(),
            &repeated,
            "/",
            String::new(),
            HashMap::new(),
        );
        assert_eq!(
            json_value_at_access(&bounded.query_params, ".item[999]"),
            Some("999".into())
        );
        assert_eq!(
            json_value_at_access(&bounded.query_params, ".item[1000]"),
            Some(String::new())
        );
        assert_eq!(percent_decode_path_segment("bad%FFvalue"), "bad%FFvalue");
    }

    #[test]
    fn parses_bounded_multipart_fields_and_repeated_values() {
        let body = concat!(
            "preamble\r\n",
            "--AaB03x\r\n",
            "Content-Disposition: form-data; name=\"tag\"\r\n\r\n",
            "one\r\n",
            "--AaB03x\r\n",
            "Content-Disposition: form-data; name=\"tag\"\r\n\r\n",
            "two\r\n",
            "--AaB03x\r\n",
            "Content-Disposition: form-data; name=\"upload\"; filename=\"hello.txt\"\r\n",
            "Content-Type: text/plain\r\n\r\n",
            "hello\n--AaB03x-not-a-boundary\nworld\r\n",
            "--AaB03x--\r\n",
            "epilogue"
        );
        for media_type in [
            "multipart/form-data",
            "multipart/mixed",
            "multipart/related",
            "multipart/alternate",
        ] {
            let fields = parse_body_fields(
                body,
                &format!("{media_type}; charset=utf-8; boundary=\"AaB03x\""),
            );
            assert_eq!(json_value_at_path(&fields, "tag.0"), "one");
            assert_eq!(json_value_at_path(&fields, "tag.1"), "two");
            assert_eq!(
                json_value_at_path(&fields, "upload"),
                "hello\n--AaB03x-not-a-boundary\nworld"
            );
        }
    }

    #[test]
    fn refuses_malformed_or_over_limit_multipart_fields() {
        assert_eq!(
            parse_body_fields("--missing--", "multipart/form-data"),
            JsonValue::Null
        );
        assert_eq!(
            parse_body_fields("", "multipart/form-data; boundary=bad\r\nvalue"),
            JsonValue::Null
        );
        assert_eq!(
            parse_body_fields(
                "",
                &format!(
                    "multipart/form-data; boundary={}",
                    "x".repeat(MAX_MULTIPART_BOUNDARY_BYTES + 1)
                )
            ),
            JsonValue::Null
        );

        let lf_only = "--line\nContent-Disposition: form-data; name=field\n\nvalue\n--line--\n";
        assert_eq!(
            json_value_at_path(
                &parse_body_fields(lf_only, "multipart/form-data; boundary=line"),
                "field"
            ),
            "value"
        );

        let mut too_many = String::new();
        for index in 0..=MAX_MULTIPART_PARTS {
            too_many.push_str(&format!(
                "--limit\r\nContent-Disposition: form-data; name=\"field{index}\"\r\n\r\nvalue\r\n"
            ));
        }
        too_many.push_str("--limit--\r\n");
        assert_eq!(
            parse_body_fields(&too_many, "multipart/form-data; boundary=limit"),
            JsonValue::Null
        );

        let oversized_headers = format!(
            "--limit\r\nContent-Disposition: form-data; name=\"field\"\r\nX-Padding: {}\r\n\r\nvalue\r\n--limit--\r\n",
            "x".repeat(MAX_MULTIPART_HEADER_BYTES)
        );
        assert_eq!(
            parse_body_fields(&oversized_headers, "multipart/form-data; boundary=limit"),
            JsonValue::Null
        );

        let oversized_name = format!(
            "--limit\r\nContent-Disposition: form-data; name=\"{}\"\r\n\r\nvalue\r\n--limit--\r\n",
            "x".repeat(MAX_MULTIPART_FIELD_NAME_BYTES + 1)
        );
        assert_eq!(
            parse_body_fields(&oversized_name, "multipart/form-data; boundary=limit"),
            JsonValue::Null
        );
    }

    #[tokio::test]
    async fn renders_incoming_request_data_through_the_handler() {
        let state = RouteState {
            routes: Arc::new(RwLock::new(vec![MockRouteInput {
                id: "request-aware".into(),
                name: "Request-aware route".into(),
                enabled: true,
                method: "POST".into(),
                path: "/orders/{id}".into(),
                status: 201,
                headers: vec![KeyValue {
                    name: "content-type".into(),
                    value: "application/json".into(),
                    enabled: true,
                }],
                body: r#"{"id":"{{ request.path.id }}","query":"{{ req.queryParams.expand[1] }}","segment":"{{ req.pathSegments[0] }}","customer":"{{ req.body.customer.name }}","client":"{{ req.headers['X-Client'] }}"}"#.into(),
                delay_ms: 0,
            }])),
        };
        let request = Request::builder()
            .method("POST")
            .uri("/orders/ord%201?expand=summary&expand=full")
            .header("content-type", "application/json")
            .header("x-client", "desktop")
            .body(Body::from(r#"{"customer":{"name":"Ada"}}"#))
            .unwrap();
        let response = handle_request(State(state), request).await;
        assert_eq!(response.status(), 201);
        let body = to_bytes(response.into_body(), 10_000).await.unwrap();
        assert_eq!(
            String::from_utf8(body.to_vec()).unwrap(),
            r#"{"id":"ord 1","query":"full","segment":"orders","customer":"Ada","client":"desktop"}"#
        );
    }

    #[tokio::test]
    async fn returns_structured_template_errors_through_the_handler() {
        let state = RouteState {
            routes: Arc::new(RwLock::new(vec![MockRouteInput {
                id: "broken-template".into(),
                name: "Broken template".into(),
                enabled: true,
                method: "GET".into(),
                path: "/broken".into(),
                status: 202,
                headers: vec![],
                body: "{{ req.body | uppercase }}".into(),
                delay_ms: 0,
            }])),
        };
        let response = handle_request(
            State(state),
            Request::builder()
                .uri("/broken")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
        assert_eq!(response.status(), 500);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/json"
        );
        assert_eq!(
            response.headers().get("x-brunomnia-mock-route").unwrap(),
            "broken-template"
        );
        let body = to_bytes(response.into_body(), 10_000).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<JsonValue>(&body).unwrap(),
            serde_json::json!({
                "error": "Error rendering body template",
                "message": "filter \"uppercase\" unsupported"
            })
        );
    }

    #[tokio::test]
    async fn renders_multipart_fields_through_the_handler() {
        let state = RouteState {
            routes: Arc::new(RwLock::new(vec![MockRouteInput {
                id: "multipart-aware".into(),
                name: "Multipart-aware route".into(),
                enabled: true,
                method: "POST".into(),
                path: "/uploads".into(),
                status: 200,
                headers: vec![],
                body: "{{ req.body.tag.0 }}|{{ req.body.tag.1 }}|{{ req.body.upload }}".into(),
                delay_ms: 0,
            }])),
        };
        let request = Request::builder()
            .method("POST")
            .uri("/uploads")
            .header("content-type", "multipart/form-data; boundary=fixture")
            .body(Body::from(concat!(
                "--fixture\r\n",
                "Content-Disposition: form-data; name=\"tag\"\r\n\r\n",
                "one\r\n",
                "--fixture\r\n",
                "Content-Disposition: form-data; name=\"tag\"\r\n\r\n",
                "two\r\n",
                "--fixture\r\n",
                "Content-Disposition: form-data; name=\"upload\"; filename=\"hello.txt\"\r\n",
                "Content-Type: text/plain\r\n\r\n",
                "hello\r\n",
                "--fixture--\r\n"
            )))
            .unwrap();
        let response = handle_request(State(state), request).await;
        assert_eq!(response.status(), 200);
        let body = to_bytes(response.into_body(), 10_000).await.unwrap();
        assert_eq!(String::from_utf8(body.to_vec()).unwrap(), "one|two|hello");
    }

    #[tokio::test]
    async fn updates_running_routes_without_rebinding_the_handler() {
        let routes = Arc::new(RwLock::new(vec![MockRouteInput {
            id: "before".into(),
            name: "Before".into(),
            enabled: true,
            method: "GET".into(),
            path: "/before".into(),
            status: 200,
            headers: vec![],
            body: "before".into(),
            delay_ms: 0,
        }]));
        let route_state = RouteState {
            routes: routes.clone(),
        };
        let state = MockServerState::default();
        let (shutdown, _shutdown_receiver) = oneshot::channel();
        state
            .servers
            .lock()
            .await
            .insert("live-server".into(), RunningServer { shutdown, routes });

        let before = handle_request(
            State(route_state.clone()),
            Request::builder()
                .uri("/before")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
        assert_eq!(before.status(), 200);

        let output = update(
            MockServerUpdateInput {
                server_id: "live-server".into(),
                routes: vec![MockRouteInput {
                    id: "after".into(),
                    name: "After".into(),
                    enabled: true,
                    method: "GET".into(),
                    path: "/after".into(),
                    status: 202,
                    headers: vec![],
                    body: "after".into(),
                    delay_ms: 0,
                }],
            },
            state,
        )
        .await
        .unwrap();
        assert_eq!(output.route_count, 1);

        let removed = handle_request(
            State(route_state.clone()),
            Request::builder()
                .uri("/before")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
        assert_eq!(removed.status(), 404);
        let after = handle_request(
            State(route_state),
            Request::builder()
                .uri("/after")
                .body(Body::empty())
                .unwrap(),
        )
        .await;
        assert_eq!(after.status(), 202);
        let body = to_bytes(after.into_body(), 100).await.unwrap();
        assert_eq!(body.as_ref(), b"after");
    }

    #[tokio::test]
    async fn serves_and_stops_a_loopback_mock() {
        let state = MockServerState::default();
        let output = start(
            MockServerInput {
                server_id: "test-server".into(),
                host: "127.0.0.1".into(),
                port: 0,
                routes: vec![MockRouteInput {
                    id: "get-order".into(),
                    name: "Get order".into(),
                    enabled: true,
                    method: "GET".into(),
                    path: "/orders/{id}".into(),
                    status: 200,
                    headers: vec![KeyValue {
                        name: "content-type".into(),
                        value: "application/json".into(),
                        enabled: true,
                    }],
                    body: r#"{"id":"{{request.path.id}}"}"#.into(),
                    delay_ms: 0,
                }],
            },
            state.clone(),
        )
        .await
        .unwrap();
        let response = reqwest::get(format!("{}/orders/ord_42", output.base_url))
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert_eq!(response.text().await.unwrap(), r#"{"id":"ord_42"}"#);
        let preflight = reqwest::Client::new()
            .request(
                reqwest::Method::OPTIONS,
                format!("{}/orders/ord_42", output.base_url),
            )
            .header("access-control-request-method", "GET")
            .send()
            .await
            .unwrap();
        assert_eq!(preflight.status(), 204);
        assert_eq!(
            preflight
                .headers()
                .get("access-control-allow-methods")
                .unwrap(),
            "GET, OPTIONS"
        );
        let updated = update(
            MockServerUpdateInput {
                server_id: "test-server".into(),
                routes: vec![MockRouteInput {
                    id: "updated-order".into(),
                    name: "Updated order".into(),
                    enabled: true,
                    method: "GET".into(),
                    path: "/orders/{id}".into(),
                    status: 202,
                    headers: vec![],
                    body: r#"{"updated":"{{request.path.id}}"}"#.into(),
                    delay_ms: 0,
                }],
            },
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(updated.route_count, 1);
        let response = reqwest::get(format!("{}/orders/ord_42", output.base_url))
            .await
            .unwrap();
        assert_eq!(response.status(), 202);
        assert_eq!(
            response.headers().get("x-brunomnia-mock-route").unwrap(),
            "updated-order"
        );
        assert_eq!(response.text().await.unwrap(), r#"{"updated":"ord_42"}"#);
        stop("test-server".into(), state).await.unwrap();
    }
}
