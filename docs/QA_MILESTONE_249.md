# Milestone 249 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: add pinned-shaped named project snapshots, newest-first history, typed-file counts, and confirmed full-project restoration without accounts or paid storage.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.create-snapshot.tsx` requires a snapshot message, creates the snapshot before any optional push, and invalidates stale comparison state.
- Pinned `insomnia-sync.sync-data.tsx` loads snapshot history and count, sorting history newest first. `sync-history-modal.tsx` exposes Message, When, Author, Objects, and a confirmed Restore action.
- Pinned cloud-sync `vcs.ts` stores named snapshots with IDs, parents, creation times, and state; `getHistory` can return all or a recent suffix, while rollback computes the selected snapshot delta and applies it to current local documents.
- Brunomnia has no hosted branch backend. Its one-document local project therefore snapshots the complete project document while reporting the same typed top-level files exposed by the project manager.

## Implementation

- Project history stores named immutable full-project snapshots with stable IDs, RFC 3339 creation times, typed-file counts, exact byte sizes, a 100 MB per-version ceiling, and newest-first listing. The latest 50 valid versions are retained per project.
- Native snapshots use a project-confined regular directory and regular files only. Symlinked stores/files are rejected, malformed or oversized entries are not exposed, and runtime OAuth/MCP credentials remain inside the existing authenticated Keychain-backed envelope rather than plaintext snapshot JSON.
- Browser development mirrors snapshot creation, validation, ordering, retention, restore, and exact-key bounds in local storage. Browser storage remains a development fallback without native Keychain authority.
- Restore validates the selected project/snapshot identity, saves the selected full workspace through the ordinary rotating-backup path, opens it as the active project, and leaves history intact for later restores.
- Snapshot history follows its owning project into Recently Deleted. Restore reattaches it, exact purge and Empty remove it, and an orphan current-history collision refuses instead of associating another project's versions with a restored or reused ID.
- The project manager adds Project history with an explicit message prompt, local retention disclosure, newest-first message/time/file-count/size rows, and confirmed Restore. Snapshot creation flushes the active autosave generation first; restore uses the existing active-work gate and runtime reset.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused browser/native project-catalog matrix | Passed: all 41 storage tests and 12 native catalog tests, including full restore, newest-first history, 50-version retention, typed-file counts, exact sizes, trash reparenting, purge/empty ownership, orphan collision refusal, symlink denial, and encrypted native runtime credentials |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 86 files and 632 tests; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 145 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied under the declared MSRV |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,516 modules; 184.89 kB CSS, 15.91 kB Workspace switcher, 29.83 kB catalog, 441.90 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,298-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 94,587,736-byte native binary in a 92,376 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 remains `5ac96310ca6504b87cf4ab21a72b414ed0b5fdc27dd6c60a3c5b3fca3ab138de` because this desktop-only change does not alter the CLI bundle.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI/container smokes were run outside it rather than weakening fixtures or production policy. The full native run observed the established login-shell timing fallback; its exact fixture passed on immediate rerun. No failure involved changed snapshot paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React controls, strict compilation, deterministic browser/native model regressions, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Main implementation commit `1cf3270b4910446a0506211db3cdd4fe30b1fc81` completed verify and publish in [Actions run 29740510830](https://github.com/sherwoodlee/Brunomnia/actions/runs/29740510830). The verify job reproduced the committed CLI under the configured Node runtime, passed freshness, built the verification image, and passed both ordinary and extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:51dcc2b1627f61f61d004cfae7898d1c999bc909040166040601c1d7c9460155
```

Independent manifest inspection resolved AMD64 `sha256:c9be6de9066e1d992ad2c62feb945cd76da447a8ce0f74835b182aee3b2ebce4`, ARM64 `sha256:3a4009d93341a9c9fc00d8d46e94818bb218d8848bc2e1c41672ba1ae19c48fc`, and attached attestation manifests `sha256:4b867c415043cb4fd9bcd79f0ada82a687c3dd64e7002b8ca15a0ac19e7e0f50` plus `sha256:55f2f903d7042a442d7dd7a1aa69b0cfdf43ddddad6fce4691db221d3bb088a2`. Independent Cosign 3.1.2 verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2205909370`.

Both jobs and every required step completed successfully.

## Acceptance boundary

M249 closes account-free named multi-version project snapshots and exact restore, including native credential protection and project-delete ownership. Brunomnia intentionally retains the newest 50 valid full-project versions rather than an unbounded hosted branch graph. Separate per-file physical records, truly empty projects, per-file cookie/certificate isolation, cloud discovery, and provider onboarding remain; exactly 15 parity rows are incomplete, so Brunomnia is not feature-complete.
