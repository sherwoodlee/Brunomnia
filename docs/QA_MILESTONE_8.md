# Milestone 8 verification

Verified on 2026-07-16 on macOS against the Phase 8 MCP, optional AI, and pull-only Konnect baseline.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project check | Pass |
| Vitest single-worker suite | Pass — 16 files, 69 tests |
| Vite production bundle | Pass — 143 modules transformed; 335.74 KB main chunk plus route-level lazy chunks; no chunk-size warning |
| Bundled CLI build and local smoke run | Pass — 295.5 KB CommonJS executable; 1 request and 2 assertions passed |
| `cargo fmt --all -- --check` | Pass |
| `cargo check` | Pass |
| `cargo test --all-targets` | Pass — 20 native tests |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |

The final TypeScript, Vite, Vitest, CLI, and Tauri CLI invocations used the bundled Node.js 24.14 runtime directly because the local Node.js 26 process intermittently slept during tool startup. The Tauri `beforeBuildCommand` repeated the already-green TypeScript/Vite/CLI pipeline but stopped producing progress, so the final native bundle invocation disabled only that hook and consumed the independently verified production `dist` output. Rust compilation and macOS app bundling then completed normally. The Rust suite's loopback-only mock-server integration ran outside the filesystem/network sandbox; all 20 tests passed.

## Focused integration evidence

- Workspace tests cover v8 migration/default normalization and import-time authority stripping for MCP, AI, and Konnect.
- Project tests round-trip MCP clients through their owned split-YAML directory while leaving unmanaged files untouched.
- MCP frontend tests cover JSON responses, JSON-bearing SSE notifications, matched JSON-RPC errors, and pre-network rejection of raw bearer tokens.
- The native MCP test covers method allowlisting and bounded argument validation. The implementation also has direct-process spawning, deadline, stdout/stderr/message/parameter, event-count, roots, and sampling/elicitation refusal boundaries.
- AI tests cover plain/fenced/explanatory structured output and pre-network rejection of raw hosted-provider keys. Runtime validation constrains prompt/diff size, mock routes/methods/paths/status/headers/delay/port, output size, suggested paths, group count, and message/comment length.
- Konnect tests cover HTTP route mapping, proxy-host environment generation, preservation of local params/body/custom headers, remote header replacement, unsupported-route isolation, and pre-network rejection of raw tokens.
- Security tests cover integration credential detection and require a complete local-vault or approved external-vault tag rather than allowing plaintext concatenated with a tag.
- The production bundle proves the Integration, AI mock, and AI Git suggestion surfaces compile and code-split. This milestone does not claim a fresh interactive rendered-QA pass or live-provider/tenant connectivity; no external credentials were available or added to the repository.

## Deliberate bounds

- At this milestone, HTTP MCP automatic OAuth discovery/callback, long-lived streaming sessions, cancellation, interactive elicitation, approved sampling, server-request response UI, and live notification cache refresh remained open. Milestones 92–95 and 227 later close OAuth, redirects, and guided parameters; Milestone 228 closes active discovery and invocation cancellation; Milestone 229 adds reusable project-scoped HTTP connections, protocol/session headers, explicit termination, and bounded expired-session replacement. Long-lived GET/POST SSE resumption/reconnect, elicitation/sampling UI, notification response UI, and live notification cache refresh remain.
- STDIO starts a fresh direct child process for each operation. Milestone 228 adds active-operation protocol cancellation and child termination; persistent sessions, persistent-session reconnect semantics, sampling review, and elicitation forms remain open.
- Brunomnia supports local models through a user-run OpenAI-compatible loopback endpoint; it does not load `.gguf` files directly.
- AI mock input is explicitly pasted prompt/spec/example material. Automatic URL fetching and response-to-mock context selection remain open.
- AI and Konnect response limits are checked after the shared HTTP transport buffers the response, so a pre-allocation network body limit is not claimed.
- Konnect is pull-only and the repository has no live PAT fixture. Unsupported or unassociated routes are retained as skipped metadata rather than treated as executable HTTP requests.
- The complete remaining parity surface stays tracked in [PARITY.md](PARITY.md); this milestone does not declare full Insomnia parity.
