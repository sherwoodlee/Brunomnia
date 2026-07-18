use crate::models::{MockRouteInput, MockServerInput, MockServerOutput};
use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{HeaderMap, Request},
    response::Response,
    Router,
};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{oneshot, Mutex};

const MAX_TEMPLATE_REQUEST_BODY_BYTES: usize = 1_000_000;
const MAX_TEMPLATE_TOKENS: usize = 1_000;
const MAX_TEMPLATE_NESTING: usize = 20;
const MAX_TEMPLATE_EXPANSION_BYTES: usize = 5_000_000;
const MAX_TEMPLATE_LOCALS: usize = 100;
const MAX_TEMPLATE_LOCAL_VALUE_BYTES: usize = 10_000;

#[derive(Clone, Default)]
pub struct MockServerState {
    servers: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
}

#[derive(Clone)]
struct RouteState {
    routes: Arc<Vec<MockRouteInput>>,
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
    let routes = Arc::new(input.routes);
    let app = Router::new()
        .fallback(handle_request)
        .with_state(RouteState { routes });
    let (shutdown, shutdown_receiver) = oneshot::channel();
    state
        .servers
        .lock()
        .await
        .insert(server_id.clone(), shutdown);
    let servers = state.servers.clone();
    tokio::spawn(async move {
        let result = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_receiver.await;
            })
            .await;
        if let Err(error) = result {
            eprintln!("Mock server failed: {error}");
        }
        servers.lock().await.remove(&server_id);
    });
    Ok(MockServerOutput {
        base_url: format!("http://{}:{}", address.ip(), address.port()),
        route_count,
    })
}

pub async fn stop(server_id: String, state: MockServerState) -> Result<(), String> {
    let shutdown = state
        .servers
        .lock()
        .await
        .remove(&server_id)
        .ok_or_else(|| "The mock server is not running.".to_string())?;
    shutdown
        .send(())
        .map_err(|_| "The mock server has already stopped.".to_string())
}

async fn handle_request(State(state): State<RouteState>, request: Request<Body>) -> Response<Body> {
    let method = request.method().as_str();
    let path = request.uri().path();
    if method.eq_ignore_ascii_case("OPTIONS")
        && request
            .headers()
            .contains_key("access-control-request-method")
    {
        let mut methods = state
            .routes
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
    let matched = state.routes.iter().find_map(|route| {
        if route.enabled && route.method.eq_ignore_ascii_case(method) {
            match_path(&route.path, path).map(|parameters| (route, parameters))
        } else {
            None
        }
    });

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
        .body(Body::from(render_template(&route.body, &template_data)))
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
    query_params: HashMap<String, String>,
    path_segments: Vec<String>,
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
        let query_params = url::form_urlencoded::parse(query.as_bytes())
            .map(|(name, value)| (name.into_owned(), value.into_owned()))
            .collect();
        let path_segments = path
            .trim_matches('/')
            .split('/')
            .filter(|segment| !segment.is_empty())
            .map(str::to_string)
            .collect();
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
        let fields = url::form_urlencoded::parse(body.as_bytes())
            .map(|(name, value)| (name.into_owned(), JsonValue::String(value.into_owned())))
            .collect::<JsonMap<String, JsonValue>>();
        return JsonValue::Object(fields);
    }
    JsonValue::Null
}

fn match_path(pattern: &str, actual: &str) -> Option<HashMap<String, String>> {
    let pattern_parts = pattern.trim_matches('/').split('/').collect::<Vec<_>>();
    let actual_parts = actual.trim_matches('/').split('/').collect::<Vec<_>>();
    if pattern_parts.len() != actual_parts.len() {
        return None;
    }
    let mut parameters = HashMap::new();
    for (expected, received) in pattern_parts.into_iter().zip(actual_parts) {
        if expected.starts_with('{') && expected.ends_with('}') {
            parameters.insert(
                expected.trim_matches(['{', '}']).to_string(),
                received.to_string(),
            );
        } else if expected != received {
            return None;
        }
    }
    Some(parameters)
}

fn bracket_or_dot_key<'a>(expression: &'a str, prefix: &str) -> Option<&'a str> {
    let suffix = expression.strip_prefix(prefix)?;
    if let Some(key) = suffix.strip_prefix('.') {
        return Some(key);
    }
    suffix
        .strip_prefix('[')
        .and_then(|key| key.strip_suffix(']'))
        .map(|key| key.trim().trim_matches(['\'', '"']))
}

fn json_value_at_path(value: &JsonValue, path: &str) -> String {
    let mut current = value;
    for part in path.split('.').filter(|part| !part.is_empty()) {
        current = match current {
            JsonValue::Object(object) => object.get(part).unwrap_or(&JsonValue::Null),
            JsonValue::Array(array) => part
                .parse::<usize>()
                .ok()
                .and_then(|index| array.get(index))
                .unwrap_or(&JsonValue::Null),
            _ => &JsonValue::Null,
        };
    }
    match current {
        JsonValue::Null => String::new(),
        JsonValue::String(value) => value.clone(),
        value => value.to_string(),
    }
}

fn variable_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, String>,
) -> Option<String> {
    if let Some(value) = locals.get(expression) {
        return Some(value.clone());
    }
    match expression {
        "$timestamp" => return Some(chrono::Utc::now().to_rfc3339()),
        "$randomUUID" => return Some(uuid::Uuid::new_v4().to_string()),
        "req.body" => return Some(data.body.clone()),
        _ => {}
    }
    if let Some(key) = expression.strip_prefix("request.path.") {
        return Some(data.path_parameters.get(key).cloned().unwrap_or_default());
    }
    if let Some(key) = bracket_or_dot_key(expression, "req.headers") {
        return Some(
            data.headers
                .get(&key.to_lowercase())
                .cloned()
                .unwrap_or_default(),
        );
    }
    if let Some(key) = bracket_or_dot_key(expression, "req.queryParams") {
        return Some(data.query_params.get(key).cloned().unwrap_or_default());
    }
    if let Some(key) = bracket_or_dot_key(expression, "req.pathSegments") {
        return Some(
            key.parse::<usize>()
                .ok()
                .and_then(|index| data.path_segments.get(index))
                .cloned()
                .unwrap_or_default(),
        );
    }
    expression
        .strip_prefix("req.body.")
        .map(|path| json_value_at_path(&data.body_fields, path))
}

fn output_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, String>,
) -> Option<String> {
    let (variable, filter) = expression
        .split_once('|')
        .map(|(variable, filter)| (variable.trim(), Some(filter.trim())))
        .unwrap_or((expression.trim(), None));
    let value = variable_value(variable, data, locals)?;
    if !value.is_empty() {
        return Some(value);
    }
    let Some(filter) = filter else {
        return Some(value);
    };
    let default = filter
        .strip_prefix("default:")?
        .trim()
        .trim_matches(['\'', '"'])
        .to_string();
    Some(default)
}

fn expression_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, String>,
) -> Option<String> {
    let expression = expression.trim();
    if expression.len() >= 2
        && ((expression.starts_with('"') && expression.ends_with('"'))
            || (expression.starts_with('\'') && expression.ends_with('\'')))
    {
        return Some(expression[1..expression.len() - 1].to_string());
    }
    match expression {
        "true" => Some("true".into()),
        "false" | "nil" | "null" => Some(String::new()),
        value if value.parse::<f64>().is_ok() => Some(value.to_string()),
        value => output_value(value, data, locals),
    }
}

fn condition_value(
    expression: &str,
    data: &RequestTemplateData,
    locals: &HashMap<String, String>,
) -> bool {
    if let Some((left, right)) = expression.split_once("!=") {
        return expression_value(left, data, locals).unwrap_or_default()
            != expression_value(right, data, locals).unwrap_or_default();
    }
    if let Some((left, right)) = expression.split_once("==") {
        return expression_value(left, data, locals).unwrap_or_default()
            == expression_value(right, data, locals).unwrap_or_default();
    }
    expression_value(expression, data, locals)
        .map(|value| !value.is_empty() && value != "false")
        .unwrap_or(false)
}

struct ConditionalParts<'a> {
    when_true: &'a str,
    when_false: &'a str,
    remaining: &'a str,
}

struct RawParts<'a> {
    body: &'a str,
    remaining: &'a str,
}

fn raw_parts<'a>(template: &'a str, token_budget: &mut usize) -> Option<RawParts<'a>> {
    let mut cursor = 0;
    while let Some(relative_start) = template[cursor..].find("{%") {
        if *token_budget == 0 {
            return None;
        }
        *token_budget -= 1;
        let tag_start = cursor + relative_start;
        let tag_body = &template[tag_start + 2..];
        let tag_end = tag_body.find("%}")?;
        let after_tag = tag_start + 2 + tag_end + 2;
        if tag_body[..tag_end].trim() == "endraw" {
            return Some(RawParts {
                body: &template[..tag_start],
                remaining: &template[after_tag..],
            });
        }
        cursor = after_tag;
    }
    None
}

fn conditional_parts<'a>(
    template: &'a str,
    closing_tag: &'static str,
    token_budget: &mut usize,
) -> Option<ConditionalParts<'a>> {
    let mut cursor = 0;
    let mut closing_tags = vec![closing_tag];
    let mut in_raw = false;
    let mut else_start = None;
    let mut else_body_start = None;
    while let Some(relative_start) = template[cursor..].find("{%") {
        if *token_budget == 0 {
            return None;
        }
        *token_budget -= 1;
        let tag_start = cursor + relative_start;
        let tag_body = &template[tag_start + 2..];
        let tag_end = tag_body.find("%}")?;
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
                    let true_end = else_start.unwrap_or(tag_start);
                    return Some(ConditionalParts {
                        when_true: &template[..true_end],
                        when_false: else_body_start
                            .map(|start| &template[start..tag_start])
                            .unwrap_or_default(),
                        remaining: &template[after_tag..],
                    });
                }
            }
            "else" if closing_tags.len() == 1 && else_start.is_none() => {
                else_start = Some(tag_start);
                else_body_start = Some(after_tag);
            }
            _ => {}
        }
        cursor = after_tag;
    }
    None
}

fn render_fragment(
    template: &str,
    data: &RequestTemplateData,
    locals: &mut HashMap<String, String>,
    depth: usize,
    token_budget: &mut usize,
    expansion_budget: &mut usize,
) -> String {
    if depth > MAX_TEMPLATE_NESTING || *token_budget == 0 || *expansion_budget == 0 {
        return template.to_string();
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
        if *token_budget == 0 || *expansion_budget == 0 {
            output.push_str(remaining);
            break;
        }
        *token_budget -= 1;
        output.push_str(&remaining[..next.0]);
        if next.1 {
            let token = &remaining[next.0 + 2..];
            let Some(end) = token.find("}}") else {
                output.push_str(&remaining[next.0..]);
                break;
            };
            let expression = &token[..end];
            if let Some(value) = output_value(expression, data, locals) {
                if value.len() <= *expansion_budget {
                    output.push_str(&value);
                    *expansion_budget -= value.len();
                } else {
                    output.push_str("{{");
                    output.push_str(expression);
                    output.push_str("}}");
                    *expansion_budget = 0;
                }
            } else {
                output.push_str("{{");
                output.push_str(expression);
                output.push_str("}}");
            }
            remaining = &token[end + 2..];
            continue;
        }

        let tag_body = &remaining[next.0 + 2..];
        let Some(end) = tag_body.find("%}") else {
            output.push_str(&remaining[next.0..]);
            break;
        };
        let tag = tag_body[..end].trim();
        let after_tag = &tag_body[end + 2..];
        if tag == "raw" {
            if let Some(parts) = raw_parts(after_tag, token_budget) {
                output.push_str(parts.body);
                remaining = parts.remaining;
            } else {
                output.push_str(&remaining[next.0..]);
                break;
            }
            continue;
        }
        if let Some(assignment) = tag.strip_prefix("assign ") {
            if let Some((name, expression)) = assignment.split_once('=') {
                let name = name.trim();
                if !name.is_empty()
                    && name.len() <= 100
                    && name
                        .chars()
                        .all(|character| character.is_ascii_alphanumeric() || character == '_')
                {
                    if let Some(value) = expression_value(expression, data, locals) {
                        if value.len() <= MAX_TEMPLATE_LOCAL_VALUE_BYTES
                            && (locals.contains_key(name) || locals.len() < MAX_TEMPLATE_LOCALS)
                        {
                            locals.insert(name.to_string(), value);
                            remaining = after_tag;
                            continue;
                        }
                    }
                }
            }
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
                output.push_str(&remaining[next.0..]);
                break;
            }
            if let Some(parts) = conditional_parts(after_tag, closing_tag, token_budget) {
                let matches = condition_value(condition, data, locals) != invert;
                output.push_str(&render_fragment(
                    if matches {
                        parts.when_true
                    } else {
                        parts.when_false
                    },
                    data,
                    locals,
                    depth + 1,
                    token_budget,
                    expansion_budget,
                ));
                remaining = parts.remaining;
                continue;
            }
        }
        output.push_str("{%");
        output.push_str(&tag_body[..end]);
        output.push_str("%}");
        remaining = after_tag;
    }
    output
}

fn render_template(body: &str, data: &RequestTemplateData) -> String {
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

    #[test]
    fn matches_parameterized_routes() {
        let parameters = match_path("/orders/{orderId}", "/orders/ord_123").unwrap();
        assert_eq!(parameters.get("orderId"), Some(&"ord_123".to_string()));
        assert!(match_path("/orders/{orderId}", "/customers/ord_123").is_none());
    }

    #[test]
    fn renders_path_and_dynamic_tokens() {
        let data = RequestTemplateData {
            path_parameters: HashMap::from([("id".to_string(), "abc".to_string())]),
            ..Default::default()
        };
        let rendered = render_template("{{request.path.id}} {{$randomUUID}}", &data);
        assert!(rendered.starts_with("abc "));
        assert!(!rendered.contains("{{$randomUUID}}"));
    }

    #[test]
    fn renders_request_aware_outputs_and_defaults() {
        let data = RequestTemplateData {
            headers: HashMap::from([("content-type".into(), "application/json".into())]),
            query_params: HashMap::from([("order".into(), "ord 42".into())]),
            path_segments: vec!["v1".into(), "orders".into()],
            body: r#"{"customer":{"name":"Ada"},"quantity":2}"#.into(),
            body_fields: serde_json::json!({ "customer": { "name": "Ada" }, "quantity": 2 }),
            path_parameters: HashMap::new(),
        };
        let rendered = render_template(
            "{{ req.headers['Content-Type'] }} {{ req.queryParams.order }} {{ req.pathSegments[1] }} {{ req.body.customer.name }} {{ req.body.quantity }} {{ req.body.missing | default: \"fallback\" }} X{{ req.queryParams.missing }}Y {{ future.value }}",
            &data,
        );
        assert_eq!(
            rendered,
            "application/json ord 42 orders Ada 2 fallback XY {{ future.value }}"
        );
    }

    #[test]
    fn renders_assign_conditionals_and_raw_blocks() {
        let data = RequestTemplateData {
            query_params: HashMap::from([("role".into(), "admin".into())]),
            body_fields: serde_json::json!({
                "customer": { "name": "Ada" },
                "disabled": false
            }),
            ..Default::default()
        };
        let rendered = render_template(
            r#"{% if req.queryParams.role == "admin" %}{% assign greeting = "Hello" %}{{ greeting }} {{ req.body.customer.name }}{% unless req.body.disabled %}!{% endunless %}{% else %}denied{% endif %}|{{ greeting }}|{% unless req.body.disabled %}enabled{% endunless %}|{% raw %}{{ req.body.customer.name }} {% if future.value %}{%   endraw   %}"#,
            &data,
        );
        assert_eq!(
            rendered,
            "Hello Ada!|Hello|enabled|{{ req.body.customer.name }} {% if future.value %}"
        );
    }

    #[test]
    fn bounds_nested_and_total_control_evaluation() {
        let nested = format!(
            "{}value{}",
            "{% if true %}".repeat(MAX_TEMPLATE_NESTING + 1),
            "{% endif %}".repeat(MAX_TEMPLATE_NESTING + 1)
        );
        let nested_rendered = render_template(&nested, &RequestTemplateData::default());
        assert!(nested_rendered.contains("{% if true %}value{% endif %}"));

        let repeated = "{{ req.queryParams.missing }}".repeat(MAX_TEMPLATE_TOKENS + 1);
        let repeated_rendered = render_template(&repeated, &RequestTemplateData::default());
        assert_eq!(repeated_rendered, "{{ req.queryParams.missing }}");

        let expansion_data = RequestTemplateData {
            body: "x".repeat(MAX_TEMPLATE_REQUEST_BODY_BYTES),
            ..Default::default()
        };
        let expansion = "{{ req.body }}".repeat(6);
        let expansion_rendered = render_template(&expansion, &expansion_data);
        assert_eq!(
            expansion_rendered.len(),
            MAX_TEMPLATE_EXPANSION_BYTES + "{{ req.body }}".len()
        );
        assert!(expansion_rendered.ends_with("{{ req.body }}"));

        let oversized_local_data = RequestTemplateData {
            body: "x".repeat(MAX_TEMPLATE_LOCAL_VALUE_BYTES + 1),
            ..Default::default()
        };
        let oversized_assignment = "{% assign copy = req.body %}{{ copy }}";
        assert_eq!(
            render_template(oversized_assignment, &oversized_local_data),
            oversized_assignment
        );

        let unsupported = "{% for item in items %}x{% endfor %}";
        assert_eq!(
            render_template(unsupported, &RequestTemplateData::default()),
            unsupported
        );
    }

    #[test]
    fn parses_json_and_form_request_fields() {
        assert_eq!(
            json_value_at_path(
                &parse_body_fields(r#"{"items":[{"id":"one"}]}"#, "application/problem+json"),
                "items.0.id"
            ),
            "one"
        );
        assert_eq!(
            json_value_at_path(
                &parse_body_fields("name=Ada+Lovelace", "application/x-www-form-urlencoded"),
                "name"
            ),
            "Ada Lovelace"
        );
    }

    #[tokio::test]
    async fn renders_incoming_request_data_through_the_handler() {
        let state = RouteState {
            routes: Arc::new(vec![MockRouteInput {
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
                body: r#"{"id":"{{ request.path.id }}","query":"{{ req.queryParams.expand }}","segment":"{{ req.pathSegments[0] }}","customer":"{{ req.body.customer.name }}","client":"{{ req.headers['X-Client'] }}"}"#.into(),
                delay_ms: 0,
            }]),
        };
        let request = Request::builder()
            .method("POST")
            .uri("/orders/ord_1?expand=full")
            .header("content-type", "application/json")
            .header("x-client", "desktop")
            .body(Body::from(r#"{"customer":{"name":"Ada"}}"#))
            .unwrap();
        let response = handle_request(State(state), request).await;
        assert_eq!(response.status(), 201);
        let body = to_bytes(response.into_body(), 10_000).await.unwrap();
        assert_eq!(
            String::from_utf8(body.to_vec()).unwrap(),
            r#"{"id":"ord_1","query":"full","segment":"orders","customer":"Ada","client":"desktop"}"#
        );
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
        stop("test-server".into(), state).await.unwrap();
    }
}
