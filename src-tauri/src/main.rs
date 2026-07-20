fn main() {
    if std::env::args_os().nth(1).as_deref()
        == Some(std::ffi::OsStr::new("--brunomnia-gguf-worker"))
    {
        std::process::exit(brunomnia_lib::run_gguf_worker());
    }
    brunomnia_lib::run();
}
