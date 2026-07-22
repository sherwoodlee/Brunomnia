use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

const STABLE_ENDPOINT: &str =
    "https://github.com/sherwoodlee/brunomnia/releases/download/updater-stable/latest.json";
const BETA_ENDPOINT: &str =
    "https://github.com/sherwoodlee/brunomnia/releases/download/updater-beta/latest.json";

#[derive(Clone, Copy, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopUpdateChannel {
    Stable,
    Beta,
}

impl DesktopUpdateChannel {
    fn endpoint(self) -> &'static str {
        match self {
            Self::Stable => STABLE_ENDPOINT,
            Self::Beta => BETA_ENDPOINT,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateSupport {
    pub enabled: bool,
    pub can_install: bool,
    pub notice_only: bool,
    pub platform: String,
    pub current_version: String,
    pub disabled_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateMetadata {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub can_install: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateProgress {
    pub phase: &'static str,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
}

struct DownloadedDesktopUpdate {
    update: Update,
    bytes: Vec<u8>,
}

#[derive(Default)]
pub struct DesktopUpdateState {
    busy: AtomicBool,
    downloaded: Mutex<Option<DownloadedDesktopUpdate>>,
}

struct BusyGuard<'a>(&'a AtomicBool);

impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn begin_operation(state: &DesktopUpdateState) -> Result<BusyGuard<'_>, String> {
    state
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "Another update operation is already running.".to_string())?;
    Ok(BusyGuard(&state.busy))
}

fn truthy_environment_value(value: Option<std::ffi::OsString>) -> bool {
    value
        .and_then(|value| value.into_string().ok())
        .map(|value| {
            let value = value.trim().to_ascii_lowercase();
            !value.is_empty() && value != "0" && value != "false" && value != "no"
        })
        .unwrap_or(false)
}

fn administrator_disabled() -> bool {
    truthy_environment_value(std::env::var_os("BRUNOMNIA_DISABLE_AUTOMATIC_UPDATES"))
        || truthy_environment_value(std::env::var_os("INSOMNIA_DISABLE_AUTOMATIC_UPDATES"))
}

fn portable_windows_build() -> bool {
    cfg!(target_os = "windows")
        && (std::env::var_os("PORTABLE_EXECUTABLE_DIR").is_some()
            || std::env::var_os("PORTABLE_EXECUTABLE_FILE").is_some())
}

fn support_for(
    platform: &str,
    current_version: String,
    development: bool,
    admin_disabled: bool,
    portable: bool,
) -> DesktopUpdateSupport {
    let disabled_reason = if development {
        Some("Updates are disabled in development builds.".to_string())
    } else if admin_disabled {
        Some("Updates are disabled by the device administrator.".to_string())
    } else if portable {
        Some("Updates are disabled for portable Windows builds.".to_string())
    } else {
        None
    };
    let can_install = platform == "macos" || platform == "windows";
    DesktopUpdateSupport {
        enabled: disabled_reason.is_none(),
        can_install,
        notice_only: platform == "linux",
        platform: platform.to_string(),
        current_version,
        disabled_reason,
    }
}

pub fn support(app: &AppHandle) -> DesktopUpdateSupport {
    support_for(
        std::env::consts::OS,
        app.package_info().version.to_string(),
        cfg!(debug_assertions),
        administrator_disabled(),
        portable_windows_build(),
    )
}

fn endpoint(channel: DesktopUpdateChannel) -> Result<Url, String> {
    Url::parse(channel.endpoint()).map_err(|error| error.to_string())
}

async fn check(app: &AppHandle, channel: DesktopUpdateChannel) -> Result<Option<Update>, String> {
    let support = support(app);
    if let Some(reason) = support.disabled_reason {
        return Err(reason);
    }
    app.updater_builder()
        .endpoints(vec![endpoint(channel)?])
        .map_err(|error| error.to_string())?
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

fn metadata(update: Update, can_install: bool) -> DesktopUpdateMetadata {
    DesktopUpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: update.date.map(|date| date.to_string()),
        notes: update.body.clone(),
        can_install,
    }
}

#[tauri::command]
pub fn desktop_update_support(app: AppHandle) -> DesktopUpdateSupport {
    support(&app)
}

#[tauri::command]
pub async fn desktop_update_check(
    app: AppHandle,
    channel: DesktopUpdateChannel,
    state: State<'_, DesktopUpdateState>,
) -> Result<Option<DesktopUpdateMetadata>, String> {
    let _guard = begin_operation(state.inner())?;
    let can_install = support(&app).can_install;
    Ok(check(&app, channel)
        .await?
        .map(|update| metadata(update, can_install)))
}

#[tauri::command]
pub async fn desktop_update_download(
    app: AppHandle,
    channel: DesktopUpdateChannel,
    version: String,
    on_event: Channel<DesktopUpdateProgress>,
    state: State<'_, DesktopUpdateState>,
) -> Result<(), String> {
    let _guard = begin_operation(state.inner())?;
    if !support(&app).can_install {
        return Err(
            "This platform reports releases but does not apply in-place updates.".to_string(),
        );
    }
    let update = check(&app, channel)
        .await?
        .ok_or_else(|| "The selected update is no longer available.".to_string())?;
    if update.version != version {
        return Err(format!(
            "The available update changed from {version} to {}. Check again before downloading.",
            update.version
        ));
    }
    let mut downloaded_bytes = 0_u64;
    let _ = on_event.send(DesktopUpdateProgress {
        phase: "started",
        downloaded_bytes,
        total_bytes: None,
    });
    let bytes = update
        .download(
            |chunk_length, total_bytes| {
                downloaded_bytes = downloaded_bytes.saturating_add(chunk_length as u64);
                let _ = on_event.send(DesktopUpdateProgress {
                    phase: "progress",
                    downloaded_bytes,
                    total_bytes,
                });
            },
            || {},
        )
        .await
        .map_err(|error| error.to_string())?;
    let _ = on_event.send(DesktopUpdateProgress {
        phase: "finished",
        downloaded_bytes,
        total_bytes: Some(downloaded_bytes),
    });
    *state
        .downloaded
        .lock()
        .map_err(|_| "The downloaded update lock is unavailable.".to_string())? =
        Some(DownloadedDesktopUpdate { update, bytes });
    Ok(())
}

#[tauri::command]
pub fn desktop_update_install_and_restart(
    app: AppHandle,
    version: String,
    state: State<'_, DesktopUpdateState>,
) -> Result<(), String> {
    let _guard = begin_operation(state.inner())?;
    let downloaded = state
        .downloaded
        .lock()
        .map_err(|_| "The downloaded update lock is unavailable.".to_string())?;
    let downloaded = downloaded
        .as_ref()
        .ok_or_else(|| "No verified update is ready to install.".to_string())?;
    if downloaded.update.version != version {
        return Err("The staged update does not match the requested version.".to_string());
    }
    downloaded
        .update
        .install(&downloaded.bytes)
        .map_err(|error| error.to_string())?;
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channels_use_separate_rolling_release_manifests() {
        assert!(DesktopUpdateChannel::Stable
            .endpoint()
            .ends_with("updater-stable/latest.json"));
        assert!(DesktopUpdateChannel::Beta
            .endpoint()
            .ends_with("updater-beta/latest.json"));
    }

    #[test]
    fn support_matches_platform_and_policy_contracts() {
        let mac = support_for("macos", "1.2.3".into(), false, false, false);
        assert!(mac.enabled && mac.can_install && !mac.notice_only);
        let linux = support_for("linux", "1.2.3".into(), false, false, false);
        assert!(linux.enabled && !linux.can_install && linux.notice_only);
        let development = support_for("windows", "1.2.3".into(), true, false, false);
        assert!(!development.enabled);
        assert_eq!(
            development.disabled_reason.as_deref(),
            Some("Updates are disabled in development builds.")
        );
        let portable = support_for("windows", "1.2.3".into(), false, false, true);
        assert!(!portable.enabled);
    }

    #[test]
    fn environment_switches_require_explicit_truthy_values() {
        assert!(truthy_environment_value(Some("1".into())));
        assert!(truthy_environment_value(Some("true".into())));
        assert!(!truthy_environment_value(Some("false".into())));
        assert!(!truthy_environment_value(Some("0".into())));
        assert!(!truthy_environment_value(None));
    }
}
