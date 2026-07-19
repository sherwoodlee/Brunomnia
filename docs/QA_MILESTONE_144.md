# Milestone 144 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close keyboard-equivalent collection-tree reordering through the existing validated mixed-resource move contract without changing pointer drag/drop, search semantics, or the broader Collections baseline.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference for collection tree actions and drag/drop placement semantics.
- Pinned sidebar movement distinguishes collection ordering, mixed request/folder sibling placement, moving inside folders, and moving resources to collection roots.
- Brunomnia's existing `moveWorkspaceResource` already validates the equivalent before/after, inside, cross-collection, subtree, collision, and cycle behavior; the missing gap was a focusable keyboard planner.
- The keyboard mapping is a Brunomnia accessibility surface rather than a claim that pinned Insomnia uses these exact keystrokes: Option on macOS or Alt elsewhere plus arrows/Home/End drives the same move outcomes.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused resource-planner regressions | Pass — 1 file, 10 tests |
| Full Vitest suite | Pass — 63 files, 450 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 507 renderer modules; 7.64 kB lazy StreamConsole chunk; 347.25 kB main renderer; 5,281,322-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The pure planner derives a validated `WorkspaceResourceMove` instead of mutating hierarchy state independently, so keyboard and pointer paths share cycle, collision, subtree, parent, and ordering defenses.
- Up/down and first/last operate on the current mixed request/folder sibling list, preserving resource identities and parent assignment.
- Indent succeeds only when the preceding mixed sibling is a folder. Outdent succeeds only with a valid parent and places the resource immediately after that parent.
- Collections support sibling up/down/first/last only. Collection indent/outdent, root outdent, impossible indent, missing targets, and boundary movement are no-ops.
- Request rows, folder-name buttons, and collection-name buttons remain ordinary focusable controls and advertise their `aria-keyshortcuts` values.
- Sidebar search disables keyboard planning just as it disables drag/drop because filtered hidden siblings make apparent order ambiguous.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-focus, keyboard-interaction, screen-reader, or visual-layout claim beyond source-backed focusable controls, shortcut metadata, strict compilation, pure move evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 144 accepts single-resource keyboard-equivalent collection-tree movement. Multi-select/bulk resource actions, environment-tree ordering, richer collected data, legacy history reconstruction, byte-exact wire diagnostics, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 145.
