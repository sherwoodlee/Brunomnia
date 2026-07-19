use serde_json::{json, Value};
use std::process::Command;

fn output(program: &str, args: &[&str]) -> String {
    Command::new(program)
        .args(args)
        .output()
        .ok()
        .filter(|result| result.status.success())
        .map(|result| String::from_utf8_lossy(&result.stdout).trim().to_string())
        .unwrap_or_default()
}

fn architecture() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        "x86" => "ia32",
        "arm" => "arm",
        value => value,
    }
}

fn platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        value => value,
    }
}

fn release() -> String {
    #[cfg(unix)]
    {
        output("/usr/bin/uname", &["-r"])
    }
    #[cfg(windows)]
    {
        output("cmd", &["/C", "ver"])
    }
    #[cfg(not(any(unix, windows)))]
    {
        String::new()
    }
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| {
            #[cfg(unix)]
            {
                output("/bin/hostname", &[])
            }
            #[cfg(windows)]
            {
                output("hostname", &[])
            }
            #[cfg(not(any(unix, windows)))]
            {
                String::new()
            }
        })
}

#[cfg(target_os = "macos")]
fn free_memory() -> u64 {
    let source = output("/usr/bin/vm_stat", &[]);
    let page_size = source
        .lines()
        .next()
        .and_then(|line| line.split("page size of ").nth(1))
        .and_then(|value| value.split_whitespace().next())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(4_096);
    let pages = source
        .lines()
        .find(|line| line.starts_with("Pages free:"))
        .and_then(|line| line.split(':').nth(1))
        .map(|value| value.trim().trim_end_matches('.'))
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);
    pages.saturating_mul(page_size)
}

#[cfg(target_os = "linux")]
fn free_memory() -> u64 {
    std::fs::read_to_string("/proc/meminfo")
        .ok()
        .and_then(|source| {
            source
                .lines()
                .find(|line| line.starts_with("MemAvailable:"))
                .and_then(|line| line.split_whitespace().nth(1))
                .and_then(|value| value.parse::<u64>().ok())
        })
        .unwrap_or(0)
        .saturating_mul(1_024)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn free_memory() -> u64 {
    0
}

#[cfg(target_os = "macos")]
fn cpu_identity() -> (String, u64) {
    let model = output("/usr/sbin/sysctl", &["-n", "machdep.cpu.brand_string"]);
    let model = if model.is_empty() {
        output("/usr/sbin/sysctl", &["-n", "hw.model"])
    } else {
        model
    };
    let speed = output("/usr/sbin/sysctl", &["-n", "hw.cpufrequency"])
        .parse::<u64>()
        .unwrap_or(0)
        / 1_000_000;
    (model, speed)
}

#[cfg(target_os = "linux")]
fn cpu_identity() -> (String, u64) {
    let source = std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let value = |name: &str| {
        source
            .lines()
            .find(|line| line.starts_with(name))
            .and_then(|line| line.split(':').nth(1))
            .map(str::trim)
            .unwrap_or_default()
            .to_string()
    };
    let model = value("model name");
    let speed = value("cpu MHz").parse::<f64>().unwrap_or(0.0).round() as u64;
    (model, speed)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn cpu_identity() -> (String, u64) {
    (std::env::var("PROCESSOR_IDENTIFIER").unwrap_or_default(), 0)
}

fn cpus() -> Vec<Value> {
    let (model, speed) = cpu_identity();
    let count = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1);
    (0..count)
        .map(|_| {
            json!({
                "model": model,
                "speed": speed,
                "times": { "user": 0, "nice": 0, "sys": 0, "idle": 0, "irq": 0 }
            })
        })
        .collect()
}

fn user_info() -> Value {
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_default();
    let homedir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    let shell = std::env::var("SHELL").unwrap_or_default();
    #[cfg(unix)]
    let (uid, gid) = (
        output("/usr/bin/id", &["-u"]).parse::<u64>().unwrap_or(0),
        output("/usr/bin/id", &["-g"]).parse::<u64>().unwrap_or(0),
    );
    #[cfg(not(unix))]
    let (uid, gid) = (0, 0);
    json!({ "uid": uid, "gid": gid, "username": username, "homedir": homedir, "shell": shell })
}

pub fn info() -> Value {
    json!({
        "arch": architecture(),
        "platform": platform(),
        "release": release(),
        "cpus": cpus(),
        "hostname": hostname(),
        "freemem": free_memory(),
        "userInfo": user_info(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_the_source_shaped_os_contract() {
        let value = info();
        assert!(value["arch"].is_string());
        assert!(value["platform"].is_string());
        assert!(value["release"].is_string());
        assert!(value["hostname"].is_string());
        assert!(value["freemem"].is_number());
        assert!(value["cpus"].is_array());
        assert!(value["userInfo"]["username"].is_string());
    }
}
