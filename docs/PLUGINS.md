# Plugin guide

Milestone 267 adds bounded reviewable pure-CommonJS production dependency graphs to local and npm/custom-registry packages. Plugins are local workspace data and every feature in this runtime is free and accountless.

## Install and authority lifecycle

Open **Plugins** to fetch an unscoped `insomnia-plugin-*` package from npm or a custom registry, paste JavaScript, read one local `.js` file or package folder, or discover packages from a direct folder, its `node_modules`, and one or more scoped `@scope` folders. Discovered and remote packages must have a `package.json` `insomnia` field; direct package reads remain useful for local development before that metadata is finalized. Package metadata supports ordinary `name`, `version`, and `description` fields plus nested `insomnia.displayName` and `insomnia.description`.

Each package may contain up to 500 UTF-8 `.js`/`.cjs`/`.json` modules, 1 MB per module, 5 MB in aggregate, 32 directory levels, and 2,000 entries per folder. The package-local scan excludes `node_modules`, dot-directories, symlinks, non-text modules, traversal, and files outside the canonical package root. A separate dependency graph retains at most 50 packages, 2,000 modules, and 20 MB of reviewable source. Discovery accepts at most 100 plugins and 1,000 entries per scanned folder. The workbench exposes every retained plugin and dependency module for review before capabilities are granted.

Registry acquisition accepts at most 1 MB of plugin metadata and 2 MB per dependency metadata document, follows no more than five same-origin metadata redirects, downloads at most 10 MB per compressed tarball and 30 MB across dependencies, and inflates each tarball under a 20 MB/2,000-entry in-memory bound. Tarballs must use HTTPS from npm, GitHub Packages, or the configured registry host; an exact user-configured HTTP registry host and port may serve its own HTTP tarball. Credentials in URLs are rejected. Every fetch uses the device's certificate-validation, active-file CA, manual/system proxy, and no-proxy settings, then verifies the registry's 40-digit SHA-1 `dist.shasum`, every tar-header checksum, path confinement, file/depth/count/byte limits, manifest identity, version, and entry module. No package script or downloaded code runs during acquisition.

Local plugin reads resolve declared `dependencies` and `optionalDependencies` from canonical in-root `node_modules`; registry fetches resolve exact, tag, caret, tilde, wildcard, comparison, OR, and full hyphen ranges to the highest compatible version, then recursively download and verify the graph. One reviewed version per package name is retained, so incompatible duplicate-version graphs fail explicitly instead of silently loading the wrong code. Missing or incompatible optional dependencies become warnings. Peer dependencies, npm aliases, Git/HTTP/file/workspace specs, ESM-only entries, binaries, and native addons remain excluded; lifecycle scripts never run. Package-local and dependency-relative extension, JSON, package-main, and directory-index resolution work, while relative dependency paths cannot escape into sibling packages.

Bare `buffer`, `path`/`node:path`, and `crypto`/`node:crypto` remain baseline modules. `events`/`node:events`, exact vendored `uuid` 11.1.1, exact vendored `ajv` 8.18.0, and every retained production dependency require an explicit grant. Static source inference plus every resolved package identity populate the review list; a package-root grant covers its reviewed subpaths but does not grant a sibling/transitive package. Unknown granted names fail with `Module 'name' not available in sandbox`; ungranted names fail with `Module 'name' not permitted by manifest`.

Every new plugin is installed disabled with zero grants. A registry fetch only fills the review form and never creates a linked filesystem source path; installation remains a separate explicit action. Registry-installed records retain their strict package name and expose **Check registry**, which fetches the current latest package through the current device registry/proxy/TLS settings. Applying the same package replaces its existing record rather than creating a duplicate. Byte-identical source, package map, entry, and module requests preserve its stable ID, enablement, grants, data, theme, and original installation date while refreshing version/metadata. Any authority-changing difference keeps the stable ID but disables the plugin, clears both grant classes and plugin data, and removes its active theme. Pinned Insomnia's settings likewise reinstall by package name and explicitly reload; there is no automatic update checker or file watcher.

The UI marks capabilities and bare modules inferred across every retained source file and merges module requests from `insomnia.permissions.modules`; inference and manifest declarations never grant authority. Baseline modules need no checkbox. Review the package, every dependency source file, and only grant required capabilities/modules before enabling it. Editing the entry source detaches a linked local or registry package and clears dependencies, data, theme, and authority. A linked local file or package can be reloaded explicitly from the preserved source path; changed plugin/dependency code, versions, entries, or requests discovered from disk use the same reset boundary. Importing a Brunomnia workspace preserves bounded package/dependency source and valid registry identity for later review but disables imported plugins, removes their stored data, clears both grant classes, and removes an imported plugin theme.

## Supported exports

- `requestHooks` and `responseHooks`
- `templateTags`
- `requestActions`, `requestGroupActions`, `workspaceActions`, and `documentActions`
- `themes`

Desktop hooks run for HTTP, GraphQL, gRPC, and non-streaming collection-run requests. Opt-in CLI hooks run around collection and standalone-suite HTTP/GraphQL sends. Pinned realtime connect routes bypass plugin hooks, so streaming hooks are not a parity requirement.

The context exposes these compatibility APIs:

- `context.request`: ID/name/URL/method, structured and text bodies, duplicate-capable headers and query parameters, effective environment values, authentication properties, cookie mutation, and send/store-cookie, URL-encoding, body-rendering, and redirect settings
- `context.response`: request ID, status/message, elapsed time, wire/decoded size fallback, exact byte body, a bounded in-memory body stream, duplicate-preserving header readers, and body replacement
- `context.store`: plugin-local string storage
- `context.network.sendRequest`: normalized host-mediated Brunomnia request execution
- `context.app`: alerts, dialogs, prompts, clipboard read/write/clear, desktop-path lookup, save-path prompting, and application information
- `context.data`: raw/URI import plus Insomnia/HAR export; private environments require a separate explicit grant

Request actions receive the selected request and parent group. Request-group actions receive the selected group plus every descendant request. Workspace actions receive the selected collection or API design and its request/group models. Document actions receive parsed and raw API-design contents. Enabled plugins with the explicit `action` grant place request actions on ordinary and pinned request rows, request-group actions on folder rows, and document actions on API Design project cards. The same exports remain callable from the review workbench. Workspace actions remain workbench-only because the pinned renderer exposes `getWorkspaceActions()` through its bridge but does not mount it on a renderer menu; its workspace-card menu mounts document actions only for design scope.

## Permissions

| Grant | Authority |
| --- | --- |
| `request:read` | Run request hooks and inspect the active request |
| `request:write` | Apply request mutations from hooks/actions |
| `response:read` | Run response hooks and inspect response data |
| `response:write` | Replace a response body |
| `store` | Read and change this plugin's local string store |
| `network` | Ask the host to execute a request |
| `app:prompt` | Display a user prompt |
| `app:clipboard` | Read or write clipboard text |
| `app:file` | Read the desktop path or prompt for a save path |
| `data:read` | Export project data |
| `data:write` | Import project data |
| `data:private` | Include private environments in a granted export |
| `template` | Execute exported custom template tags |
| `action` | Run exported request/folder/workspace/document actions with selected models |
| `theme` | Apply exported theme colors, style targets, and sanitized raw CSS |

## Execution boundary

Each operation receives a cloned input in a new Blob Worker and has a two-second total deadline. Package modules are compiled only by a captured host constructor after constructor escape paths are removed from plugin-visible values; module code receives isolated CommonJS `module`, `exports`, `require`, `__dirname`, and `__filename` values. Ambient `fetch`, XHR, WebSocket, EventSource, workers, dynamic imports, the DOM, IndexedDB/cache APIs, `eval`, and function-constructor escape paths are removed. Network, dialog/prompt, clipboard, path, and data operations use explicit host RPC after a matching grant. Workers are terminated and their Blob URL is revoked after every operation. Theme CSS is capped at 100 KB and rejected when it contains imports, URLs, script schemes, expressions, or behaviors; mapped colors must pass the browser's color parser.

The baseline `crypto` shim preserves pinned synchronous `createHash` for MD5/SHA-1/SHA-256/SHA-384/SHA-512, chained hex/base64 digests, algorithm-aware HMAC, bounded random bytes, and random UUIDs. `events` provides the common EventEmitter on/add/once/emit/remove/listener surface. Vendored UUID and AJV bundles are generated deterministically from an isolated exact-version lockfile and are included only after their grant. Reproduce them with `npm ci --prefix scripts/plugin-vendored && npm run generate:plugin-vendored`.

This boundary reduces plugin authority; it is not a claim that arbitrary third-party JavaScript is harmless. Read every retained module before granting access, especially network, clipboard, data, actions, and request/response mutations. Native addons/install scripts, ESM/export-map and conflicting multi-version graphs, ambient Node/process compatibility, CLI host RPC/user-invoked actions, and integrity algorithms beyond the pinned SHA-1 contract remain unsupported in this baseline. Pinned production settings expose only a registry URL; development-only `NODE_AUTH_TOKEN` injection is not a production registry-authentication feature.

## CLI hooks and template tags

`brunomnia run collection` and `brunomnia run test` leave stored plugins disabled at the process boundary unless `--allow-plugins` is present. That flag does not invent a grant: a plugin must also be enabled in the workspace and already hold each reviewed request, response, template, or store permission it uses. Imported plugins remain disabled and stripped of grants/data.

The CLI runs request hooks before transport, response hooks after transport, and template tags during rendering through the same validated multi-file CommonJS wrapper in a fresh resource-limited Node worker for every operation. It preserves the same reviewed relative JavaScript/CJS/JSON, curated modules, and explicitly granted dependency graph, hides Node `process`/`global`, refuses every host network/dialog/prompt/clipboard/path/data RPC, and provides no external-vault, user-invoked action, theme, or persistent-write adapter. Output and per-plugin string storage are capped at 1 MB; stores have at most 256 entries and persist only in memory for the current run. A two-second deadline plus 64 MB old-generation, 8 MB young-generation, and 2 MB stack ceilings bound each worker. The signed Node 22 container smoke runs this path with `--network none` and a read-only workspace mount.

## Minimal example

```js
module.exports.requestHooks = [context => {
  context.request.setHeader('X-Local-Plugin', 'enabled');
}];

module.exports.templateTags = [{
  name: 'local_value',
  displayName: 'Local value',
  async run(context, fallback = 'hello') {
    return (await context.store.getItem('value')) || fallback;
  },
}];
```

This example needs request read/write plus template and store grants. The built-in starter source also demonstrates a request action and local notification.
