# Milestone 56 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: match Insomnia's friendly response routing precedence for valid JSON and leading HTML doctypes even when servers provide missing or misleading Content-Type headers, including inside selected multipart sections.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) attempts `JSON.parse()` against the entity before every declared type, then looks for a case-insensitive HTML doctype in the trimmed first 100 bytes, then returns the header type. Brunomnia now uses that order for top-level and recursively selected multipart response bodies.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 40 files, 243 tests |
| Vite production build | Pass — 168 modules; 498.23 KB / 498,231-byte main JavaScript chunk; 15,919-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,776-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 27 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 28-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Valid UTF-8 JSON objects and scalar values override misleading `image/png` and `text/plain` declarations before the media/text branches can claim them.
- The detector uses the exact entity byte surface, matching the upstream inspection order rather than trusting an already charset-decoded string.
- A trimmed case-insensitive `<!doctype html...>` within the first 100 bytes routes to Brunomnia's existing network-blocked, script-disabled iframe. Bare `<html>` and a doctype after byte 100 do not produce a claim.
- Failed JSON parsing is silent and proceeds to the bounded HTML-prefix check, then returns the original declaration.
- Original Content-Type spelling and parameters remain byte-for-byte unchanged on fallback, preserving `boundary=InnerCase` for aggregate and nested multipart parsing.
- Selected multipart parts run the same detection before friendly media, HTML, CSV, or nested dispatch; media artifacts still consume the exact part bytes.
- Detection code remains reachable only through the lazy response-preview component. The main renderer stays byte-identical to Phases 54–55.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Misleading-header route changes and safe HTML/media presentation are compile-, detection-, parser-, and artifact-byte-verified only in this phase.

## Acceptance boundary

JSON detection decodes and parses the complete entity as UTF-8, matching upstream and requiring the body to remain buffered. HTML detection requires a doctype within the first 100 bytes. Brunomnia does not sniff bare HTML/XML, images, PDFs, audio, archives, or other signatures. Content detection changes only the friendly viewer choice; stored headers and response bytes remain unchanged. Safe HTML stays non-interactive, and rendered behavior remains unverified by standing direction.
