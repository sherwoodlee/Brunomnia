use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet, VecDeque};

pub const MANIFEST_FORMAT: &str = "brunomnia-project-store";
pub const RECORD_FORMAT: &str = "brunomnia-project-file";
const FORMAT_VERSION: u32 = 1;
const MAX_RECORDS: usize = 20_000;
const MAX_FILE_ID_CHARS: usize = 500;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordReference {
    pub key: String,
    pub scope: String,
    pub id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    format: String,
    version: u32,
    workspace: Value,
    records: Vec<RecordReference>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct IndexedValue {
    index: usize,
    value: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhysicalRecord {
    format: String,
    version: u32,
    scope: String,
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_state: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collection: Option<IndexedValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    design: Option<IndexedValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generated_collection: Option<IndexedValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mock_server: Option<IndexedValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    environments: Option<Vec<IndexedValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mcp_client: Option<IndexedValue>,
}

fn valid_scope(scope: &str) -> bool {
    matches!(
        scope,
        "collection" | "design" | "mock-server" | "environment" | "mcp"
    )
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().count() <= MAX_FILE_ID_CHARS
}

fn value_id(value: &Value) -> Option<&str> {
    value
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| valid_id(id))
}

fn array(value: &Value, key: &str) -> Result<Vec<Value>, String> {
    match value.get(key) {
        Some(value) => value
            .as_array()
            .cloned()
            .ok_or_else(|| format!("The workspace {key} list is invalid.")),
        None => Ok(Vec::new()),
    }
}

fn shell_object(workspace: &mut Value) -> Result<&mut Map<String, Value>, String> {
    workspace
        .as_object_mut()
        .ok_or_else(|| "The workspace shell is invalid.".to_string())
}

fn physical_key(index: usize) -> String {
    format!("record-{index:05}.json")
}

struct RecordCollector<'a> {
    records: Vec<(String, Value)>,
    references: Vec<RecordReference>,
    seen_ids: HashSet<String>,
    shell_file_state: &'a mut Map<String, Value>,
    source_file_state: &'a Map<String, Value>,
}

impl RecordCollector<'_> {
    fn add(&mut self, scope: &str, id: &str, mut record: PhysicalRecord) -> Result<(), String> {
        if !valid_id(id) || !self.seen_ids.insert(id.to_string()) {
            return Err(format!(
                "Project file identity '{}' is invalid or duplicated.",
                if id.is_empty() { "(empty)" } else { id }
            ));
        }
        let key = physical_key(self.records.len());
        record.file_state = self.source_file_state.get(id).cloned();
        if record.file_state.is_some() {
            self.shell_file_state.remove(id);
        }
        self.references.push(RecordReference {
            key: key.clone(),
            scope: scope.to_string(),
            id: id.to_string(),
        });
        self.records.push((
            key,
            serde_json::to_value(record).map_err(|error| error.to_string())?,
        ));
        Ok(())
    }
}

fn record_base(scope: &str, id: &str) -> PhysicalRecord {
    PhysicalRecord {
        format: RECORD_FORMAT.to_string(),
        version: FORMAT_VERSION,
        scope: scope.to_string(),
        id: id.to_string(),
        file_state: None,
        collection: None,
        design: None,
        generated_collection: None,
        mock_server: None,
        environments: None,
        mcp_client: None,
    }
}

fn environment_branches(
    environments: &[Value],
) -> Result<Vec<(String, Vec<IndexedValue>)>, String> {
    let mut by_id = HashMap::new();
    let mut by_parent: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, environment) in environments.iter().enumerate() {
        let id = value_id(environment)
            .ok_or_else(|| "An environment file identity is invalid.".to_string())?;
        if by_id.insert(id.to_string(), index).is_some() {
            return Err(format!("Environment identity '{id}' is duplicated."));
        }
        let parent_id = environment
            .get("parentId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        by_parent
            .entry(parent_id.to_string())
            .or_default()
            .push(index);
    }
    let mut roots = environments
        .iter()
        .enumerate()
        .filter_map(|(index, environment)| {
            let parent_id = environment
                .get("parentId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            (parent_id.is_empty() || !by_id.contains_key(parent_id)).then_some(index)
        })
        .collect::<Vec<_>>();
    let mut assigned = HashSet::new();
    let mut branches = Vec::new();
    roots.extend(0..environments.len());
    for root_index in roots {
        let root_id = value_id(&environments[root_index]).unwrap().to_string();
        if assigned.contains(&root_id) {
            continue;
        }
        let mut values = Vec::new();
        let mut pending = VecDeque::from([root_index]);
        while let Some(index) = pending.pop_front() {
            let id = value_id(&environments[index]).unwrap();
            if !assigned.insert(id.to_string()) {
                continue;
            }
            values.push(IndexedValue {
                index,
                value: environments[index].clone(),
            });
            pending.extend(by_parent.get(id).into_iter().flatten().copied());
        }
        if !values.is_empty() {
            branches.push((root_id, values));
        }
    }
    Ok(branches)
}

pub fn split(workspace: &Value) -> Result<(Value, Vec<(String, Value)>), String> {
    if workspace.get("format").and_then(Value::as_str) != Some("brunomnia") {
        return Err("The project is not a valid Brunomnia workspace.".into());
    }
    let collections = array(workspace, "collections")?;
    let designs = array(workspace, "apiDesigns")?;
    let mock_servers = array(workspace, "mockServers")?;
    let environments = array(workspace, "environments")?;
    let mcp_clients = array(workspace, "mcpClients")?;
    let source_file_state = workspace
        .get("fileState")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut shell = workspace.clone();
    let shell = shell_object(&mut shell)?;
    for key in [
        "collections",
        "apiDesigns",
        "mockServers",
        "environments",
        "mcpClients",
    ] {
        shell.insert(key.to_string(), Value::Array(Vec::new()));
    }
    if !shell.get("fileState").is_some_and(Value::is_object) {
        shell.insert("fileState".into(), Value::Object(Map::new()));
    }
    let shell_file_state = shell.get_mut("fileState").unwrap().as_object_mut().unwrap();
    let generated_ids = designs
        .iter()
        .filter_map(|design| design.get("generatedCollectionId").and_then(Value::as_str))
        .collect::<HashSet<_>>();
    let mut consumed_generated_ids = HashSet::new();
    let mut collector = RecordCollector {
        records: Vec::new(),
        references: Vec::new(),
        seen_ids: HashSet::new(),
        shell_file_state,
        source_file_state: &source_file_state,
    };

    for (index, collection) in collections.iter().enumerate() {
        let id = value_id(collection)
            .ok_or_else(|| "A collection file identity is invalid.".to_string())?;
        if generated_ids.contains(id) {
            continue;
        }
        let mut physical = record_base("collection", id);
        physical.collection = Some(IndexedValue {
            index,
            value: collection.clone(),
        });
        collector.add("collection", id, physical)?;
    }
    for (index, design) in designs.iter().enumerate() {
        let id = value_id(design)
            .ok_or_else(|| "An API design file identity is invalid.".to_string())?;
        let mut physical = record_base("design", id);
        physical.design = Some(IndexedValue {
            index,
            value: design.clone(),
        });
        if let Some(generated_id) = design
            .get("generatedCollectionId")
            .and_then(Value::as_str)
            .filter(|generated_id| consumed_generated_ids.insert((*generated_id).to_string()))
        {
            if let Some((generated_index, collection)) = collections
                .iter()
                .enumerate()
                .find(|(_, collection)| value_id(collection) == Some(generated_id))
            {
                physical.generated_collection = Some(IndexedValue {
                    index: generated_index,
                    value: collection.clone(),
                });
            }
        }
        collector.add("design", id, physical)?;
    }
    for (index, collection) in collections.iter().enumerate() {
        let id = value_id(collection)
            .ok_or_else(|| "A collection file identity is invalid.".to_string())?;
        if !generated_ids.contains(id) || consumed_generated_ids.contains(id) {
            continue;
        }
        let mut physical = record_base("collection", id);
        physical.collection = Some(IndexedValue {
            index,
            value: collection.clone(),
        });
        collector.add("collection", id, physical)?;
    }
    for (index, mock_server) in mock_servers.iter().enumerate() {
        let id = value_id(mock_server)
            .ok_or_else(|| "A mock-server file identity is invalid.".to_string())?;
        let mut physical = record_base("mock-server", id);
        physical.mock_server = Some(IndexedValue {
            index,
            value: mock_server.clone(),
        });
        collector.add("mock-server", id, physical)?;
    }
    for (id, values) in environment_branches(&environments)? {
        let mut physical = record_base("environment", &id);
        physical.environments = Some(values);
        collector.add("environment", &id, physical)?;
    }
    for (index, mcp_client) in mcp_clients.iter().enumerate() {
        let id = value_id(mcp_client)
            .ok_or_else(|| "An MCP-client file identity is invalid.".to_string())?;
        let mut physical = record_base("mcp", id);
        physical.mcp_client = Some(IndexedValue {
            index,
            value: mcp_client.clone(),
        });
        collector.add("mcp", id, physical)?;
    }
    let RecordCollector {
        records,
        references,
        ..
    } = collector;
    if records.len() > MAX_RECORDS {
        return Err(format!(
            "A project may contain at most {MAX_RECORDS} physical files."
        ));
    }
    let manifest = Manifest {
        format: MANIFEST_FORMAT.to_string(),
        version: FORMAT_VERSION,
        workspace: Value::Object(shell.clone()),
        records: references,
    };
    Ok((
        serde_json::to_value(manifest).map_err(|error| error.to_string())?,
        records,
    ))
}

fn parse_manifest(value: &Value) -> Option<Manifest> {
    let manifest = serde_json::from_value::<Manifest>(value.clone()).ok()?;
    if manifest.format != MANIFEST_FORMAT
        || manifest.version != FORMAT_VERSION
        || manifest.records.len() > MAX_RECORDS
        || manifest.workspace.get("format").and_then(Value::as_str) != Some("brunomnia")
    {
        return None;
    }
    let mut keys = HashSet::new();
    let mut ids = HashSet::new();
    if manifest.records.iter().any(|reference| {
        !valid_scope(&reference.scope)
            || !valid_id(&reference.id)
            || !valid_record_key(&reference.key)
            || !keys.insert(reference.key.clone())
            || !ids.insert(reference.id.clone())
    }) {
        return None;
    }
    Some(manifest)
}

pub fn is_manifest(value: &Value) -> bool {
    parse_manifest(value).is_some()
}

#[cfg(test)]
pub fn record_keys(value: &Value) -> Vec<String> {
    parse_manifest(value)
        .map(|manifest| {
            manifest
                .records
                .into_iter()
                .map(|reference| reference.key)
                .collect()
        })
        .unwrap_or_default()
}

pub fn valid_record_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 128
        && !key.contains(['/', '\\'])
        && key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn push_indexed(
    target: &mut Vec<IndexedValue>,
    value: Option<IndexedValue>,
    expected_id: Option<&str>,
) -> Option<()> {
    let value = value?;
    let id = value_id(&value.value)?;
    if !value.value.is_object() || expected_id.is_some_and(|expected| id != expected) {
        return None;
    }
    target.push(value);
    Some(())
}

fn sorted_values(mut values: Vec<IndexedValue>) -> Vec<Value> {
    values.sort_by_key(|value| value.index);
    values.into_iter().map(|value| value.value).collect()
}

fn unique_ids(values: &[Value]) -> bool {
    let mut ids = HashSet::new();
    values
        .iter()
        .all(|value| value_id(value).is_some_and(|id| ids.insert(id.to_string())))
}

fn unique_indexes(values: &[IndexedValue]) -> bool {
    let mut indexes = HashSet::new();
    values.iter().all(|value| indexes.insert(value.index))
}

pub fn assemble<F>(manifest_value: &Value, mut read_record: F) -> Option<Value>
where
    F: FnMut(&str) -> Option<Value>,
{
    let manifest = parse_manifest(manifest_value)?;
    let mut workspace = manifest.workspace;
    let workspace_object = workspace.as_object_mut()?;
    for key in [
        "collections",
        "apiDesigns",
        "mockServers",
        "environments",
        "mcpClients",
    ] {
        if !workspace_object.get(key)?.as_array()?.is_empty() {
            return None;
        }
    }
    let file_state = workspace_object.get_mut("fileState")?.as_object_mut()?;
    let mut collections = Vec::new();
    let mut designs = Vec::new();
    let mut mock_servers = Vec::new();
    let mut environments = Vec::new();
    let mut mcp_clients = Vec::new();
    for reference in manifest.records {
        let physical =
            serde_json::from_value::<PhysicalRecord>(read_record(&reference.key)?).ok()?;
        if physical.format != RECORD_FORMAT
            || physical.version != FORMAT_VERSION
            || physical.scope != reference.scope
            || physical.id != reference.id
        {
            return None;
        }
        if let Some(file_state_value) = physical.file_state {
            if !file_state_value.is_object() {
                return None;
            }
            file_state.insert(physical.id.clone(), file_state_value);
        }
        match physical.scope.as_str() {
            "collection" => {
                push_indexed(&mut collections, physical.collection, Some(&physical.id))?
            }
            "design" => {
                let design = physical.design?;
                if value_id(&design.value) != Some(physical.id.as_str()) {
                    return None;
                }
                let generated_id = design
                    .value
                    .get("generatedCollectionId")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                designs.push(design);
                if let Some(generated_collection) = physical.generated_collection {
                    let expected_id = generated_id.as_deref()?;
                    push_indexed(
                        &mut collections,
                        Some(generated_collection),
                        Some(expected_id),
                    )?;
                }
            }
            "mock-server" => {
                push_indexed(&mut mock_servers, physical.mock_server, Some(&physical.id))?
            }
            "environment" => {
                let branch = physical.environments?;
                if branch.is_empty() || branch.len() > 10_000 {
                    return None;
                }
                for (index, environment) in branch.into_iter().enumerate() {
                    push_indexed(
                        &mut environments,
                        Some(environment),
                        (index == 0).then_some(physical.id.as_str()),
                    )?;
                }
            }
            "mcp" => push_indexed(&mut mcp_clients, physical.mcp_client, Some(&physical.id))?,
            _ => return None,
        }
    }
    if !unique_indexes(&collections)
        || !unique_indexes(&designs)
        || !unique_indexes(&mock_servers)
        || !unique_indexes(&environments)
        || !unique_indexes(&mcp_clients)
    {
        return None;
    }
    let collections = sorted_values(collections);
    let designs = sorted_values(designs);
    let mock_servers = sorted_values(mock_servers);
    let environments = sorted_values(environments);
    let mcp_clients = sorted_values(mcp_clients);
    if !unique_ids(&collections)
        || !unique_ids(&designs)
        || !unique_ids(&mock_servers)
        || !unique_ids(&environments)
        || !unique_ids(&mcp_clients)
    {
        return None;
    }
    workspace_object.insert("collections".into(), Value::Array(collections));
    workspace_object.insert("apiDesigns".into(), Value::Array(designs));
    workspace_object.insert("mockServers".into(), Value::Array(mock_servers));
    workspace_object.insert("environments".into(), Value::Array(environments));
    workspace_object.insert("mcpClients".into(), Value::Array(mcp_clients));
    Some(workspace)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workspace() -> Value {
        serde_json::json!({
            "format": "brunomnia",
            "version": 43,
            "name": "Physical",
            "collections": [
                { "id": "collection", "name": "Collection" },
                { "id": "generated", "name": "Generated" }
            ],
            "apiDesigns": [{ "id": "design", "name": "Design", "generatedCollectionId": "generated" }],
            "mockServers": [{ "id": "mock", "name": "Mock" }],
            "environments": [
                { "id": "environment", "name": "Base", "parentId": "" },
                { "id": "child", "name": "Child", "parentId": "environment" }
            ],
            "mcpClients": [{ "id": "mcp", "name": "MCP" }],
            "fileState": { "design": { "cookies": [], "certificates": { "caPem": "ca", "clientCertificates": [] } } }
        })
    }

    #[test]
    fn round_trips_typed_files_and_state() {
        let source = workspace();
        let (manifest, records) = split(&source).unwrap();
        let by_key = records.into_iter().collect::<HashMap<_, _>>();
        let assembled = assemble(&manifest, |key| by_key.get(key).cloned()).unwrap();
        assert_eq!(assembled, source);
        assert!(is_manifest(&manifest));
        assert_eq!(record_keys(&manifest).len(), 5);
    }

    #[test]
    fn rejects_missing_and_mismatched_records() {
        let (manifest, records) = split(&workspace()).unwrap();
        let by_key = records.into_iter().collect::<HashMap<_, _>>();
        assert!(assemble(&manifest, |_| None).is_none());
        assert!(assemble(&manifest, |key| {
            let mut value = by_key.get(key)?.clone();
            value["id"] = Value::String("wrong".into());
            Some(value)
        })
        .is_none());
        assert!(assemble(&manifest, |key| {
            let mut value = by_key.get(key)?.clone();
            if value["scope"] == "collection" {
                value["collection"]["value"]["id"] = Value::String("wrong".into());
            }
            Some(value)
        })
        .is_none());
    }
}
