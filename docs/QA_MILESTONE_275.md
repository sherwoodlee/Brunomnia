# Milestone 275 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: add unsigned cross-platform Tauri desktop installers, checksums, direct GitHub build provenance, retained workflow artifacts, and tagged releases without claiming operating-system signing, notarization, updater, universal-macOS, or accessibility completion.

## Implementation

- `.github/workflows/desktop-release.yml` uses only full commit-SHA action references and a three-runner matrix: macOS 15 ARM64 `app,dmg`, Windows 2022 x64 `nsis,msi`, and Ubuntu 22.04 x64 `appimage,deb,rpm`. The explicit current Apple-silicon label avoids the deprecated macOS 14 runner.
- The job exports `CI=true` and `CARGO_INCREMENTAL=0`, installs the Linux WebKit/AppIndicator/SVG/patchelf/OpenSSL/RPM prerequisites, runs the ordinary production build through Tauri, and passes `--no-sign` on every platform.
- `scripts/desktop-artifact-manifest.mjs` accepts only the expected final Tauri directory/extension pairs for the selected platform. It ignores app internals and stale `macos/rw.*.dmg` staging images, sorts paths, hashes exact bytes, records version/revision/platform/size/digest in JSON, and emits release-basename SHA-256 sums.
- Unsupported platform names, non-full lowercase commit SHAs, absent/empty bundle roots, line-breaking paths, and colliding release basenames fail closed.
- GitHub build provenance uses `subject-checksums`, making each installer digest a direct attestation subject rather than attesting only the JSON manifest. Main artifacts retain installers and both evidence files for 30 days; `v*` pushes create a GitHub release from all three platform artifacts.
- `src-tauri/tauri.conf.json` raises the macOS deployment floor from 10.13 to 10.15. The pinned llama.cpp dependency uses C++ filesystem symbols absent from the older deployment target.
- The bundle config names the existing square 512×512 PNG for AppImage and existing six-resolution `.ico` for MSI; the focused regression validates both formats before a long native matrix can start.
- No account, plan, license, hosted build vendor, telemetry, entitlement, signing identity, or updater service is involved.

## Automated gates

| Gate | Result |
| --- | --- |
| Manifest/workflow regressions | Pass — 1 file/4 tests covers stable exact hashes, stale-DMG/app-file exclusion, flat release checksums, malformed/empty/duplicate-name rejection, valid square PNG/six-resolution ICO inputs, the current three-runner architecture matrix, immutable action pins, `CI=true`, explicit `--no-sign`, final-directory-only upload paths, direct installer provenance, 30-day retention, and tagged publication |
| Full frontend suite | Pass in required partition — 105 regular files/725 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 726 active frontend tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,547 transformed modules, and the generated 23,684,253-byte CLI bundle completed; CLI SHA-256 is `aefe09d6f643ab9f8587237fd6c3ef0ce65b0d3141d0195918604a2c8fa061e0` |
| Packaged CLI smokes | Pass — template/file grants, authoritative physical store, runner/config/plugin/transport/report matrices, and the pinned non-root/no-network/read-only container matrix passed; the container was rerun from the Docker-shared workspace after the isolated `/private/tmp` source mount was unavailable |
| Native aggregate suite | Pass outside the localhost sandbox — 189 tests passed and 4 opt-in public/model fixtures were ignored |
| Native formatting, check, and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics with `CARGO_INCREMENTAL=0` |
| Local release bundle | Pass — the final explicit-icon `CI=true` ARM64 release build produced `Brunomnia.app` and `Brunomnia_0.1.0_aarch64.dmg`; the DMG is 12,158,985 bytes with SHA-256 `b1e4939b25be158137bcccb80d662bee3821991716ae933fb7f9271ff6e73355` |

## Local bundle inspection

- `LSMinimumSystemVersion` is exactly `10.15` in the generated app `Info.plist`.
- `hdiutil verify` reports a valid disk image and valid CRC32 across the protective MBR, GPT headers/tables, Apple HFS payload, and complete image.
- CI mode adds create-dmg's `--skip-jenkins` argument, avoiding Finder AppleScript and making the DMG path headless. A non-CI local diagnostic correctly isolated Finder AppleEvent timeout `-1712`; the release workflow always sets `CI=true`.
- `codesign -dv --verbose=4` identifies the app executable as linker-signed ad hoc with no team identifier and no sealed resources. The DMG reports `code object is not signed at all`.
- Gatekeeper assessment does not accept either object. This is expected evidence for the explicit unsigned boundary, not a signing/notarization claim.
- The generated manifest records only `dmg/Brunomnia_0.1.0_aarch64.dmg`; two intentionally retained failed-attempt `macos/rw.*.dmg` images are excluded. The flat checksum name matches the eventual GitHub release asset.

## Manual/rendered QA

Rendered/manual and assistive-technology QA remain omitted under the standing project direction. M275 makes no observed installation-wizard, screen-reader, focus-ring, SmartScreen, Gatekeeper-dialog, desktop-menu, or update-flow claim beyond deterministic configuration, tests, release compilation, bundle metadata, exact hashes, and command-line signature/image inspection.

## Acceptance boundary

M275 closes the named Windows/Linux desktop-release-artifact gap and gives every published installer checksum plus direct GitHub provenance. It does not create signed or notarized binaries, a universal/x64 macOS artifact, an updater, or completed accessibility evidence. `Preferences, shortcuts, themes, accessibility, and packaging` remains `Baseline`; exactly five parity rows remain incomplete, so Brunomnia is not feature-complete.
