# Desktop updates and accessibility

Brunomnia ships its desktop update and accessibility behavior without an account, subscription, seat limit, entitlement service, or commercial feature gate.

## Signed desktop updates

Packaged builds expose **Preferences → General → Desktop updates**. Users can select the stable or beta channel, check manually, enable the default three-hour automatic check, follow verified download progress, and restart to apply an available macOS or Windows update.

- Stable metadata is read from `updater-stable/latest.json`; prerelease metadata is read from `updater-beta/latest.json`.
- Tauri verifies every downloaded updater archive against the public key embedded in `src-tauri/tauri.conf.json` before the archive can be staged.
- macOS and Windows install the verified archive in place and restart only after the user selects **Restart and update**.
- Linux reports a signed release and links to the release packages. AppImage, DEB, and RPM replacement remains explicit so package-manager ownership is not bypassed.
- Development builds, portable Windows builds, and devices with `BRUNOMNIA_DISABLE_AUTOMATIC_UPDATES` or `INSOMNIA_DISABLE_AUTOMATIC_UPDATES` set to a truthy value do not update themselves.
- Changing channels never weakens signature verification. A version that changes between check and download must be checked again.

The tagged release path requires the Tauri updater private key plus real Apple Developer ID/notarization and DigiCert Software Trust Manager credentials. It builds universal macOS, Windows x64, and Linux x64 artifacts, verifies macOS notarization staples and Windows Authenticode signatures, attaches GitHub provenance, and publishes separate rolling stable/beta updater assets. Missing credentials fail the tagged release instead of silently producing an untrusted artifact.

Main-branch CI intentionally remains an unsigned provenance build. Those artifacts verify compilation and packaging but retain normal operating-system trust warnings and are not described as notarized or Authenticode-signed releases.

## Keyboard and assistive access

The application shell provides a first-focus **Skip to main content** link and one labeled `main` landmark. Preference sections use a real tab list with selected tab/panel relationships; Left/Right Arrow, Home, and End move and activate tabs while preserving ordinary pointer interaction.

Status changes that do not take focus—updates, preference saves, and relevant workbench feedback—use polite live regions. Icon-only and reveal controls retain explicit accessible names, focus-visible treatment remains present, and the existing 33-action shortcut registry continues to support multiple bindings, collision warnings, clearing, and reset.

The stylesheet respects platform accessibility preferences:

- `prefers-reduced-motion` removes nonessential animation and transition timing.
- `prefers-contrast: more` strengthens borders, foregrounds, controls, and focus indicators.
- `forced-colors: active` preserves system colors and visible control/focus boundaries.
- Accent actions and secondary/faint text meet the audited contrast targets in the default dark surface.

Browser QA covers semantics, tab-keyboard behavior, updater status rendering, and console cleanliness. Native update installation, signature verification, credential-backed signing, and operating-system trust dialogs remain native/release concerns and are covered by Rust tests, packaging gates, and the trusted tagged workflow rather than the browser build.

## Operator checklist

1. Configure the two Tauri updater signing secrets and the platform signing/notarization credentials named in `.github/workflows/desktop-release.yml`.
2. Push a SemVer tag such as `v1.2.3`; append a prerelease suffix such as `v1.2.3-beta.1` for the beta channel.
3. Require every `trusted-*` matrix job and the release job to pass.
4. Verify the tagged release provenance and platform signatures before directing users to it.
5. Never copy the updater private key into the repository or application bundle; only the public verification key belongs there.

See [Milestone 280 verification](QA_MILESTONE_280.md) for the exact automated and rendered evidence.
