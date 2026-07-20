use encoding_rs::UTF_8;
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaChatMessage, LlamaModel},
    sampling::LlamaSampler,
    TokenToStringError,
};
use serde::{Deserialize, Serialize};
use std::{
    ffi::OsStr,
    fs,
    io::{Read, Write},
    num::NonZeroU32,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const MODELS_FOLDER: &str = "llms";
const WORKER_ARGUMENT: &str = "--brunomnia-gguf-worker";
const CONTEXT_TOKENS: u32 = 8_192;
const PROMPT_BATCH_TOKENS: usize = 512;
const MAX_GENERATED_TOKENS: u32 = 4_096;
const MAX_PROMPT_BYTES: usize = 1_000_000;
const MAX_WORKER_INPUT_BYTES: u64 = 1_100_000;
const MAX_WORKER_OUTPUT_BYTES: u64 = 10_000_000;
const MAX_WORKER_ERROR_BYTES: u64 = 64_000;
const WORKER_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GgufModel {
    pub name: String,
    pub size: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GgufModelCatalog {
    pub directory: String,
    pub models: Vec<GgufModel>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GgufGenerationInput {
    pub model: String,
    pub prompt: String,
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: i32,
    pub seed: bool,
    pub repeat_penalty: f32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerRequest {
    model_path: PathBuf,
    generation: GgufGenerationInput,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum WorkerResponse {
    Ok { text: String },
    Error { error: String },
}

fn ensure_models_root(app_data: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(app_data)
        .map_err(|error| format!("Unable to create the Brunomnia app-data folder: {error}"))?;
    let app_data = app_data
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the Brunomnia app-data folder: {error}"))?;
    let models = app_data.join(MODELS_FOLDER);
    match fs::symlink_metadata(&models) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err("The local-model folder cannot be a symlink.".into())
        }
        Ok(metadata) if !metadata.is_dir() => {
            return Err("The local-model path exists but is not a folder.".into())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir(&models)
            .map_err(|error| format!("Unable to create the local-model folder: {error}"))?,
        Err(error) => return Err(format!("Unable to inspect the local-model folder: {error}")),
    }
    let models = models
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the local-model folder: {error}"))?;
    if !models.starts_with(&app_data) {
        return Err("The local-model folder escaped Brunomnia app data.".into());
    }
    Ok(models)
}

fn is_gguf_name(name: &OsStr) -> bool {
    Path::new(name)
        .extension()
        .and_then(OsStr::to_str)
        .is_some_and(|extension| extension.eq_ignore_ascii_case("gguf"))
}

fn list_models_in(app_data: &Path) -> Result<GgufModelCatalog, String> {
    let root = ensure_models_root(app_data)?;
    let mut models = Vec::new();
    for entry in fs::read_dir(&root)
        .map_err(|error| format!("Unable to read the local-model folder: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Unable to read a local-model entry: {error}"))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Unable to inspect a local-model entry: {error}"))?;
        if metadata.file_type().is_symlink()
            || !metadata.is_file()
            || !is_gguf_name(&entry.file_name())
        {
            continue;
        }
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("Unable to resolve a local-model entry: {error}"))?;
        if !canonical.starts_with(&root) {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        models.push(GgufModel {
            name,
            size: metadata.len(),
        });
    }
    models.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(GgufModelCatalog {
        directory: root.to_string_lossy().into_owned(),
        models,
    })
}

fn selected_model_path(app_data: &Path, model: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(model);
    if model.is_empty()
        || candidate.is_absolute()
        || candidate.components().count() != 1
        || !matches!(candidate.components().next(), Some(Component::Normal(_)))
        || !is_gguf_name(candidate.as_os_str())
    {
        return Err("Choose a GGUF file from Brunomnia's local-model folder.".into());
    }
    let root = ensure_models_root(app_data)?;
    let path = root.join(candidate);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Unable to inspect the selected GGUF model: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("The selected GGUF model must be a regular file, not a symlink.".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to resolve the selected GGUF model: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("The selected GGUF model escaped Brunomnia's local-model folder.".into());
    }
    Ok(canonical)
}

fn app_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

pub fn list_models(app: &AppHandle) -> Result<GgufModelCatalog, String> {
    list_models_in(&app_data_path(app)?)
}

pub fn open_models_folder(app: &AppHandle) -> Result<String, String> {
    let directory = ensure_models_root(&app_data_path(app)?)?;

    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer.exe");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("/usr/bin/xdg-open");

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        command
            .arg(&directory)
            .spawn()
            .map_err(|error| format!("Unable to open the local-model folder: {error}"))?;
        Ok(directory.to_string_lossy().into_owned())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = directory;
        Err("Opening the local-model folder is not supported on this platform.".into())
    }
}

fn validate_generation(input: &GgufGenerationInput) -> Result<(), String> {
    if input.prompt.is_empty() {
        return Err("The GGUF prompt cannot be empty.".into());
    }
    if input.prompt.len() > MAX_PROMPT_BYTES {
        return Err("The GGUF prompt exceeds the 1 MB safety limit.".into());
    }
    if input.prompt.contains('\0') {
        return Err("The GGUF prompt cannot contain null bytes.".into());
    }
    if !input.temperature.is_finite() || !(0.0..=2.0).contains(&input.temperature) {
        return Err("GGUF temperature must be between 0 and 2.".into());
    }
    if !input.top_p.is_finite() || !(0.0..=1.0).contains(&input.top_p) {
        return Err("GGUF top P must be between 0 and 1.".into());
    }
    if !(0..=100).contains(&input.top_k) {
        return Err("GGUF top K must be between 0 and 100.".into());
    }
    if !input.repeat_penalty.is_finite() || !(0.0..=10.0).contains(&input.repeat_penalty) {
        return Err("GGUF repeat penalty must be between 0 and 10.".into());
    }
    Ok(())
}

fn read_bounded(mut reader: impl Read, limit: u64, label: &str) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .by_ref()
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read GGUF worker {label}: {error}"))?;
    if bytes.len() as u64 > limit {
        return Err(format!("GGUF worker {label} exceeded its safety limit."));
    }
    Ok(bytes)
}

fn worker_failure(status: std::process::ExitStatus, stderr: &[u8]) -> String {
    let detail = String::from_utf8_lossy(stderr).trim().to_string();
    if detail.is_empty() {
        format!("The isolated GGUF worker exited unexpectedly ({status}).")
    } else {
        format!(
            "The isolated GGUF worker exited unexpectedly ({status}): {}",
            detail.chars().take(2_000).collect::<String>()
        )
    }
}

fn run_worker_process(request: WorkerRequest) -> Result<String, String> {
    let payload = serde_json::to_vec(&request)
        .map_err(|error| format!("Unable to encode the GGUF worker request: {error}"))?;
    if payload.len() as u64 > MAX_WORKER_INPUT_BYTES {
        return Err("The GGUF worker request exceeds its safety limit.".into());
    }
    let executable = std::env::current_exe()
        .map_err(|error| format!("Unable to locate the Brunomnia executable: {error}"))?;
    let mut child = Command::new(executable)
        .arg(WORKER_ARGUMENT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start the isolated GGUF worker: {error}"))?;
    child
        .stdin
        .take()
        .ok_or_else(|| "Unable to open the GGUF worker input.".to_string())?
        .write_all(&payload)
        .map_err(|error| format!("Unable to send the GGUF worker request: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to open the GGUF worker output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to open the GGUF worker diagnostics.".to_string())?;
    let stdout_reader =
        thread::spawn(move || read_bounded(stdout, MAX_WORKER_OUTPUT_BYTES, "output"));
    let stderr_reader =
        thread::spawn(move || read_bounded(stderr, MAX_WORKER_ERROR_BYTES, "diagnostics"));

    let started = Instant::now();
    let status = loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Unable to wait for the GGUF worker: {error}"))?
        {
            break status;
        }
        if started.elapsed() >= WORKER_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err("The isolated GGUF worker exceeded its ten-minute deadline.".into());
        }
        thread::sleep(Duration::from_millis(50));
    };
    let stdout = stdout_reader
        .join()
        .map_err(|_| "The GGUF worker output reader failed.".to_string())??;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "The GGUF worker diagnostics reader failed.".to_string())??;
    if !status.success() {
        return Err(worker_failure(status, &stderr));
    }
    let response: WorkerResponse = serde_json::from_slice(&stdout)
        .map_err(|error| format!("The GGUF worker returned an invalid response: {error}"))?;
    match response {
        WorkerResponse::Ok { text } => Ok(text),
        WorkerResponse::Error { error } => Err(error),
    }
}

pub async fn generate(app: AppHandle, input: GgufGenerationInput) -> Result<String, String> {
    validate_generation(&input)?;
    let model_path = selected_model_path(&app_data_path(&app)?, &input.model)?;
    tokio::task::spawn_blocking(move || {
        run_worker_process(WorkerRequest {
            model_path,
            generation: input,
        })
    })
    .await
    .map_err(|error| format!("The GGUF worker task failed: {error}"))?
}

fn formatted_prompt(model: &LlamaModel, prompt: &str) -> Result<String, String> {
    match model.chat_template(None) {
        Ok(template) => {
            let message = LlamaChatMessage::new("user".into(), prompt.into())
                .map_err(|error| format!("Unable to prepare the GGUF chat message: {error}"))?;
            model
                .apply_chat_template(&template, &[message], true)
                .map_err(|error| format!("Unable to apply the GGUF model's chat template: {error}"))
        }
        Err(_) => Ok(prompt.to_string()),
    }
}

fn run_inference(request: &WorkerRequest) -> Result<String, String> {
    validate_generation(&request.generation)?;
    let metadata = fs::metadata(&request.model_path)
        .map_err(|error| format!("Unable to inspect the GGUF model: {error}"))?;
    if !metadata.is_file() || !is_gguf_name(request.model_path.as_os_str()) {
        return Err("The GGUF worker requires a regular .gguf model file.".into());
    }

    let mut backend =
        LlamaBackend::init().map_err(|error| format!("Unable to initialize llama.cpp: {error}"))?;
    #[cfg(not(test))]
    backend.void_logs();
    #[cfg(test)]
    if std::env::var_os("BRUNOMNIA_GGUF_TEST_LOGS").is_none() {
        backend.void_logs();
    }
    let use_accelerator = cfg!(target_os = "macos") && backend.supports_gpu_offload();
    if use_accelerator {
        return match run_inference_attempt(request, &backend, true) {
            Ok(output) => Ok(output),
            Err(accelerator_error) => run_inference_attempt(request, &backend, false).map_err(
                |cpu_error| {
                    format!(
                        "GGUF accelerator inference failed ({accelerator_error}); CPU fallback also failed: {cpu_error}"
                    )
                },
            ),
        };
    }
    run_inference_attempt(request, &backend, false)
}

fn run_inference_attempt(
    request: &WorkerRequest,
    backend: &LlamaBackend,
    use_accelerator: bool,
) -> Result<String, String> {
    let model_params = if use_accelerator {
        LlamaModelParams::default().with_n_gpu_layers(u32::MAX)
    } else {
        LlamaModelParams::default().with_n_gpu_layers(0)
    };
    let model = LlamaModel::load_from_file(backend, &request.model_path, &model_params)
        .map_err(|error| format!("Unable to load the GGUF model: {error}"))?;
    let threads = thread::available_parallelism()
        .map(|count| i32::try_from(count.get()).unwrap_or(i32::MAX))
        .unwrap_or(4)
        .max(1);
    let context_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(CONTEXT_TOKENS))
        .with_n_batch(PROMPT_BATCH_TOKENS as u32)
        .with_n_ubatch(PROMPT_BATCH_TOKENS as u32)
        .with_n_threads(threads)
        .with_n_threads_batch(threads)
        .with_offload_kqv(use_accelerator)
        .with_op_offload(use_accelerator);
    let mut context = model
        .new_context(backend, context_params)
        .map_err(|error| format!("Unable to create the GGUF context: {error}"))?;
    let prompt = formatted_prompt(&model, &request.generation.prompt)?;
    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|error| format!("Unable to tokenize the GGUF prompt: {error}"))?;
    if tokens.is_empty() {
        return Err("The GGUF model produced no prompt tokens.".into());
    }
    if tokens.len() >= CONTEXT_TOKENS as usize {
        return Err(format!(
            "The GGUF prompt uses {} tokens and does not fit the 8K context.",
            tokens.len()
        ));
    }

    for (chunk_index, chunk) in tokens.chunks(PROMPT_BATCH_TOKENS).enumerate() {
        let start = chunk_index * PROMPT_BATCH_TOKENS;
        let mut batch = LlamaBatch::new(chunk.len(), 1);
        for (offset, token) in chunk.iter().enumerate() {
            let position = i32::try_from(start + offset)
                .map_err(|_| "The GGUF prompt position exceeded its limit.".to_string())?;
            let logits = start + offset + 1 == tokens.len();
            batch
                .add(*token, position, &[0], logits)
                .map_err(|error| format!("Unable to prepare the GGUF prompt batch: {error}"))?;
        }
        context
            .decode(&mut batch)
            .map_err(|error| format!("Unable to decode the GGUF prompt: {error}"))?;
    }

    let random_seed = if request.generation.seed { u32::MAX } else { 0 };
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::penalties(-1, request.generation.repeat_penalty, 0.0, 0.0),
        LlamaSampler::top_k(request.generation.top_k),
        LlamaSampler::top_p(request.generation.top_p, 1),
        LlamaSampler::temp(request.generation.temperature),
        LlamaSampler::dist(random_seed),
    ]);
    sampler.accept_many(tokens.iter());
    let available = CONTEXT_TOKENS.saturating_sub(tokens.len() as u32);
    let generation_limit = available.min(MAX_GENERATED_TOKENS);
    let mut decoder = UTF_8.new_decoder();
    let mut output = String::new();

    for (position, generated) in (tokens.len()..).zip(0..generation_limit) {
        let token = sampler.sample(&context, -1);
        sampler.accept(token);
        if model.is_eog_token(token) {
            break;
        }
        let piece = match model.token_to_piece(token, &mut decoder, false, None) {
            Ok(piece) => piece,
            Err(TokenToStringError::UnknownTokenType) => String::new(),
            Err(error) => return Err(format!("Unable to decode GGUF output text: {error}")),
        };
        output.push_str(&piece);
        if output.len() as u64 > MAX_WORKER_OUTPUT_BYTES {
            return Err("GGUF output exceeded the 10 MB safety limit.".into());
        }
        if generated + 1 == generation_limit {
            break;
        }
        let mut batch = LlamaBatch::new(1, 1);
        batch
            .add(
                token,
                i32::try_from(position)
                    .map_err(|_| "The GGUF generation position exceeded its limit.".to_string())?,
                &[0],
                true,
            )
            .map_err(|error| format!("Unable to prepare a GGUF output token: {error}"))?;
        context
            .decode(&mut batch)
            .map_err(|error| format!("Unable to decode a GGUF output token: {error}"))?;
    }
    let mut tail = String::with_capacity(4);
    let _ = decoder.decode_to_string(b"", &mut tail, true);
    output.push_str(&tail);
    Ok(output)
}

pub fn run_worker() -> i32 {
    let response = (|| {
        let stdin = std::io::stdin();
        let payload = read_bounded(stdin.lock(), MAX_WORKER_INPUT_BYTES, "request")?;
        let request: WorkerRequest = serde_json::from_slice(&payload)
            .map_err(|error| format!("Unable to decode the GGUF worker request: {error}"))?;
        run_inference(&request)
    })();
    let response = match response {
        Ok(text) => WorkerResponse::Ok { text },
        Err(error) => WorkerResponse::Error { error },
    };
    let stdout = std::io::stdout();
    match serde_json::to_writer(stdout.lock(), &response) {
        Ok(()) => 0,
        Err(_) => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generation(model: &str) -> GgufGenerationInput {
        GgufGenerationInput {
            model: model.into(),
            prompt: "Reply with hello.".into(),
            temperature: 0.6,
            top_p: 0.9,
            top_k: 40,
            seed: false,
            repeat_penalty: 1.1,
        }
    }

    #[test]
    fn creates_lists_and_selects_only_regular_gguf_files() {
        let directory = tempfile::tempdir().unwrap();
        let app_data = directory.path().join("app-data");
        let root = ensure_models_root(&app_data).unwrap();
        fs::write(root.join("zeta.GGUF"), b"model-two").unwrap();
        fs::write(root.join("Alpha.gguf"), b"model-one").unwrap();
        fs::write(root.join("notes.txt"), b"ignored").unwrap();
        fs::create_dir(root.join("folder.gguf")).unwrap();

        let catalog = list_models_in(&app_data).unwrap();
        assert_eq!(catalog.directory, root.to_string_lossy());
        assert_eq!(
            catalog
                .models
                .iter()
                .map(|model| (model.name.as_str(), model.size))
                .collect::<Vec<_>>(),
            vec![("Alpha.gguf", 9), ("zeta.GGUF", 9)]
        );
        assert_eq!(
            selected_model_path(&app_data, "Alpha.gguf").unwrap(),
            root.join("Alpha.gguf")
        );
    }

    #[test]
    fn rejects_model_traversal_and_invalid_generation_parameters() {
        let directory = tempfile::tempdir().unwrap();
        let app_data = directory.path().join("app-data");
        ensure_models_root(&app_data).unwrap();
        for model in ["", "model.bin", "../model.gguf", "nested/model.gguf"] {
            assert!(selected_model_path(&app_data, model).is_err(), "{model}");
        }
        let mut input = generation("model.gguf");
        input.temperature = f32::NAN;
        assert!(validate_generation(&input).is_err());
        input.temperature = 0.6;
        input.top_p = 1.1;
        assert!(validate_generation(&input).is_err());
        input.top_p = 0.9;
        input.top_k = 101;
        assert!(validate_generation(&input).is_err());
        input.top_k = 40;
        input.repeat_penalty = -0.1;
        assert!(validate_generation(&input).is_err());
        input.repeat_penalty = 1.1;
        input.prompt = "x".repeat(MAX_PROMPT_BYTES + 1);
        assert!(validate_generation(&input).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_model_folders_and_files() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().unwrap();
        let app_data = directory.path().join("app-data");
        fs::create_dir(&app_data).unwrap();
        let outside = directory.path().join("outside");
        fs::create_dir(&outside).unwrap();
        symlink(&outside, app_data.join(MODELS_FOLDER)).unwrap();
        assert!(ensure_models_root(&app_data).is_err());

        fs::remove_file(app_data.join(MODELS_FOLDER)).unwrap();
        let root = ensure_models_root(&app_data).unwrap();
        let outside_model = outside.join("outside.gguf");
        fs::write(&outside_model, b"model").unwrap();
        symlink(&outside_model, root.join("linked.gguf")).unwrap();
        assert!(selected_model_path(&app_data, "linked.gguf").is_err());
        assert!(list_models_in(&app_data).unwrap().models.is_empty());
    }

    #[test]
    #[ignore = "requires BRUNOMNIA_GGUF_FIXTURE pointing to a local GGUF model"]
    fn generates_with_a_live_gguf_fixture() {
        let model_path = std::env::var_os("BRUNOMNIA_GGUF_FIXTURE")
            .map(PathBuf::from)
            .expect("set BRUNOMNIA_GGUF_FIXTURE");
        let request = WorkerRequest {
            model_path,
            generation: generation("fixture.gguf"),
        };
        assert!(!run_inference(&request).unwrap().trim().is_empty());
    }
}
