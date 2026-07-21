# Local plugin guide

Milestone 262 extends the permissioned Milestone 6 baseline across the documented request/response context, request-group actions, host-mediated data helpers, linked-source reload, style-aware themes, and CLI request/response hooks. Plugins are local workspace data and every feature in this runtime is free.

## Install and authority lifecycle

Open **Plugins**, paste a bundled JavaScript file, or—inside the Tauri app—read a local `.js` file or package folder whose `package.json` points to a local entry. Package metadata supports ordinary `name`, `version`, and `description` fields plus nested `insomnia.displayName` and `insomnia.description`. Remote installation and npm dependency resolution are not performed. Bundle dependencies into one file before installation.

Every plugin is installed disabled with zero grants. The UI marks capabilities inferred from its source, but inference never grants them. Review the source, grant only required capabilities, then enable it. Editing source disables the plugin and clears every grant. A linked local file or package can be reloaded explicitly from the preserved source path; reload also disables the plugin and clears every grant. Importing a Brunomnia workspace disables imported plugins, removes their stored data, clears grants, and removes an imported plugin theme.

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

Request actions receive the selected request and parent group. Request-group actions receive the selected group plus every descendant request. Workspace actions receive the selected collection or API design and its request/group models. Document actions receive parsed and raw API-design contents. Action placement is exposed in the plugin workbench rather than injected into every upstream context menu.

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

Each operation receives a cloned input in a new Blob Worker and has a two-second total deadline. Plugin source is limited to one megabyte. Ambient `fetch`, XHR, WebSocket, EventSource, workers, dynamic imports, the DOM, IndexedDB/cache APIs, `eval`, and function-constructor escape paths are removed. Network, dialog/prompt, clipboard, path, and data operations use explicit host RPC after a matching grant. Workers are terminated and their Blob URL is revoked after every operation. Theme CSS is capped at 100 KB and rejected when it contains imports, URLs, script schemes, expressions, or behaviors; mapped colors must pass the browser's color parser.

This boundary reduces plugin authority; it is not a claim that arbitrary third-party JavaScript is harmless. Read source before granting access, especially network, clipboard, data, actions, and request/response mutations. Remote package installation, npm dependency resolution, external plugin-directory discovery/watch, native modules, broad Node ecosystem compatibility, and exact upstream context-menu placement remain unsupported in this baseline.

## CLI hooks and template tags

`brunomnia run collection` and `brunomnia run test` leave stored plugins disabled at the process boundary unless `--allow-plugins` is present. That flag does not invent a grant: a plugin must also be enabled in the workspace and already hold each reviewed request, response, template, or store permission it uses. Imported plugins remain disabled and stripped of grants/data.

The CLI runs request hooks before transport, response hooks after transport, and template tags during rendering through the same validated CommonJS wrapper in a fresh resource-limited Node worker for every operation. It hides Node `process`/`global`, supplies only the safe `buffer` shim, refuses every host network/dialog/prompt/clipboard/path/data RPC, and provides no external-vault, user-invoked action, theme, or persistent-write adapter. Output and per-plugin string storage are capped at 1 MB; stores have at most 256 entries and persist only in memory for the current run. A two-second deadline plus 16 MB old-generation, 4 MB young-generation, and 2 MB stack ceilings bound each worker. The signed Node 22 container smoke runs this path with `--network none` and a read-only workspace mount.

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
