# Milestone 275 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: add unsigned cross-platform Tauri desktop installers, checksums, direct GitHub build provenance, retained workflow artifacts, and tagged releases without claiming operating-system signing, notarization, updater, universal-macOS, or accessibility completion.

## Implementation

- `.github/workflows/desktop-release.yml` uses only full commit-SHA action references and a three-runner matrix: macOS 15 ARM64 `app,dmg`, Windows 2022 x64 `nsis,msi`, and Ubuntu 22.04 x64 `appimage,deb,rpm`. The explicit current Apple-silicon label avoids the deprecated macOS 14 runner.
- The job exports `CI=true` and `CARGO_INCREMENTAL=0`, installs the Linux WebKit/AppIndicator/SVG/patchelf/OpenSSL/RPM prerequisites, runs the ordinary production build through Tauri, and passes `--no-sign` on every platform.
- `scripts/desktop-artifact-manifest.mjs` accepts only the expected final Tauri directory/extension pairs for the selected platform. It ignores app internals and stale `macos/rw.*.dmg` staging images, sorts paths, hashes exact bytes, records version/revision/platform/size/digest in JSON, and emits release-basename SHA-256 sums.
- Unsupported platform names, non-full lowercase commit SHAs, absent/empty bundle roots, line-breaking paths, and colliding release basenames fail closed.
- GitHub build provenance uses each matrix entry's explicit final-installer path list, making every installer digest a direct attestation subject without platform-dependent checksum-file parsing. Main artifacts retain installers and both evidence files for 30 days; `v*` pushes create a GitHub release from all three platform artifacts.
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

## Remote gate

Final implementation commit `01305b02fa74f502f79230db723eb0c6965a66f8` completed all three build jobs in [Desktop bundles workflow 29828197366](https://github.com/sherwoodlee/Brunomnia/actions/runs/29828197366) and both verify/publish jobs in [CLI container workflow 29828197348](https://github.com/sherwoodlee/Brunomnia/actions/runs/29828197348).

The desktop workflow produced and retained three non-expired artifacts:

| Platform artifact | Artifact ID | Uploaded bytes | Installers and SHA-256 |
| --- | ---: | ---: | --- |
| `brunomnia-macos-arm64` | `8494404286` | 12,230,076 | DMG `10bd3c573c644fa6b600b55d61d92db26daa3fdbeee229224f530cd6a3cdedd4` |
| `brunomnia-windows-x64` | `8494511042` | 20,862,982 | MSI `2c3bfec57ef6cb81f02e8962b676a856836e2afbfff1d6e52e9ae39cf0449968`; NSIS `8df3d94391e987c00d056ed824b51837af9c7e2dad1ad84b76183ef782e0e849` |
| `brunomnia-linux-x64` | `8494549170` | 116,069,144 | AppImage `a252e5582e98b0c56d9eeb20de0cbc69d90368172dd8d843ecc553c2f715675f`; DEB `3c619483b4499633c31b0e140f954dc8cf91ff146dfcd3db6bcec3d98750e20f`; RPM `d8c18568a10456783ed70174d5d7bfa7300db607583a7df16bfdb7df5883d084` |

Independent downloads matched every manifest revision, byte size, digest, relative path, and flat checksum line. Format inspection identified an ARM64 DMG, NSIS PE installer, x64 MSI installation database, x86-64 ELF AppImage, Debian package, and x86-64 RPM. `gh attestation verify --repo sherwoodlee/Brunomnia` passed independently for all six installer files.

The direct multi-subject attestations are [macOS attestation 36345678](https://github.com/sherwoodlee/Brunomnia/attestations/36345678) at Rekor index `2211919712`, [Windows attestation 36346482](https://github.com/sherwoodlee/Brunomnia/attestations/36346482) at Rekor index `2211931515`, and [Linux attestation 36346735](https://github.com/sherwoodlee/Brunomnia/attestations/36346735) at Rekor index `2211935275`. The Windows statement contains exactly two subjects and Linux exactly three; this avoids the platform-dependent checksum-line parsing defect found during the first remote audit.

The downloaded CI DMG passed `hdiutil verify`. Its enclosed executable is Mach-O ARM64, declares `LSMinimumSystemVersion=10.15`, remains linker-signed ad hoc with no team identifier or sealed resources, and fails Gatekeeper assessment as expected; the DMG itself is unsigned. The tag-only release job correctly remained skipped for this `main` push.

The companion CLI run published and keylessly signed `ghcr.io/sherwoodlee/brunomnia-cli@sha256:2b7bfe7ff2f4047915e51b1a7e76ebf86307d18708da58b9ea9463a56fa7a06c`; its transparency-log entry is Rekor index `2211897859`.

## Acceptance boundary

M275 closes the named Windows/Linux desktop-release-artifact gap and gives every published installer checksum plus direct GitHub provenance. It does not create signed or notarized binaries, a universal/x64 macOS artifact, an updater, or completed accessibility evidence. `Preferences, shortcuts, themes, accessibility, and packaging` remains `Baseline`; exactly five parity rows remain incomplete, so Brunomnia is not feature-complete.
