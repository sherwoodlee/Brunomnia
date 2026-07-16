use crate::models::{MockRouteInput, MockServerInput, MockServerOutput};
use axum::{body::Body, extract::State, http::Request, response::Response, Router};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{oneshot, Mutex};

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
        .body(Body::from(render_template(&route.body, &parameters)))
        .unwrap_or_else(|error| {
            Response::builder()
                .status(500)
                .body(Body::from(format!("Invalid mock response: {error}")))
                .expect("valid mock error response")
        })
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

fn render_template(body: &str, parameters: &HashMap<String, String>) -> String {
    let mut output = body
        .replace("{{$timestamp}}", &chrono::Utc::now().to_rfc3339())
        .replace("{{$randomUUID}}", &uuid::Uuid::new_v4().to_string());
    for (name, value) in parameters {
        output = output.replace(&format!("{{{{request.path.{name}}}}}"), value);
    }
    output
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
        let parameters = HashMap::from([("id".to_string(), "abc".to_string())]);
        let rendered = render_template("{{request.path.id}} {{$randomUUID}}", &parameters);
        assert!(rendered.starts_with("abc "));
        assert!(!rendered.contains("{{$randomUUID}}"));
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
