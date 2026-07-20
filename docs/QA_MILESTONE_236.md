# Milestone 236 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add reviewed MCP server-initiated roots, elicitation, and sampling requests across native Streamable HTTP and persistent STDIO, including account-free configured-provider sampling drafts that never bypass explicit user approval.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/main/network/mcp.ts` advertises `roots.listChanged`, elicitation, and sampling client capabilities through the locked MCP SDK.
- Pinned `packages/insomnia/src/main/mcp/client-requests.ts` resolves elicitation through submit/decline/cancel and sampling through explicit approve/reject actions while retaining the originating request identity.
- Pinned `elicitation-form.tsx`, `sampling-form.tsx`, and `event-view.tsx` render server requests inside the MCP event workflow. Upstream AI sampling is feature-gated; Brunomnia instead lets any explicitly configured provider generate an editable draft for free and still requires a separate approval before returning it.

## Implementation

- HTTP and persistent STDIO initialization advertise roots/list-change, elicitation, and sampling. Native POST SSE now emits a server request immediately instead of waiting for the matching operation result; the existing GET task already delivers idle stream requests through its retained renderer channel.
- Persistent STDIO sessions share a concurrency-safe child writer, current roots, a bounded pending-request registry, and a refreshable event channel. Reviewed requests are registered before emission, so an immediate response cannot outrun native state; response claiming is atomic and restores the pending request if writing fails.
- `roots/list` is answered natively for STDIO and through the authenticated session-bound HTTP path. Editing connected roots updates native state and sends `notifications/roots/list_changed`. Server `notifications/cancelled` removes the matching pending review.
- The renderer parses live request/cancellation events, deduplicates at most 100 reviews by client/request identity, and routes responses through authenticated HTTP POST or the native STDIO response command while the originating operation remains active.
- Elicitation reuses the bounded recursive schema form and exposes accept, decline, and cancel. Sampling exposes request context, editable text/role/model/stop-reason fields, approve/reject, and an optional configured-provider draft action. AI output only fills the form; no provider is bundled and no output is auto-approved.
- Native roots and pending reviews are capped at 100, aggregate roots and response payloads at 1 MB, root URIs at 8,192 bytes, and session identities at 512 bytes. Existing message, stream, event, cancellation, process, and HTTP SSE limits remain unchanged.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP server-request suites | Passed: 2 frontend files, 18 tests; 2 native live-lifecycle regressions |
| Full Vitest suite | Passed: 80 files, 596 tests |
| Full native suite | Passed: 125 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 530 modules; 177.47 kB CSS, 96.34 kB Integration workbench, 434.16 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The real STDIO fixture sends sampling, roots, elicitation, and cancellation messages while a tools request remains pending, verifies concurrent client responses, and confirms the original operation completes. The HTTP fixture holds POST SSE open and proves the sampling request reaches the native channel before the matching result is released. The generated CLI remains byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9` because this milestone changes desktop MCP transport and renderer integration only.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic native-channel, real-child, and raw-loopback fixtures verify ordering and response routing; strict React/TypeScript compilation plus the rebuilt packaged app verify the renderer boundary without external MCP credentials or paid AI access.

## Remote gate

Main commit `216f6c55168ccb85290cfe5ef74ec6184e69182c` completed verify and publish in [Actions run 29713885967](https://github.com/sherwoodlee/Brunomnia/actions/runs/29713885967). Node 22 rebuilt the generated CLI, passed freshness plus non-root/no-network trust smokes, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:73195bbde6210a779b9bd0e88a5207715f6aebde2285d942bda4d0607a53411f
```

Independent manifest inspection resolved AMD64 `sha256:67090a2eaf1efefd8bbb62854f467da962abc32f69068b18e307bf741c1d4c00`, ARM64 `sha256:83854befa8a83eb698eab8799e257e42a845d98cc4beb9f1992969d8011caa63`, and their attached attestation manifests. Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, validated the M236 commit and published digest claims plus the trusted certificate chain, and found transparency-log entry `2204707440`.

## Acceptance boundary

M236 closes the named roots/list-change, elicitation, reviewed sampling, cancellation, and server-request response controls. It does not add multiple authorization-server failover, DPoP, live third-party fixtures, OS-keychain-wrapped runtime credentials, or direct `.gguf` loading. MCP and AI clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
