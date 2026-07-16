# Local plugin guide

Milestone 6 provides a permissioned compatibility baseline for dependency-free Insomnia-style CommonJS plugins. Plugins are local workspace data and every feature in this runtime is free.

## Install and authority lifecycle

Open **Plugins**, paste a bundled JavaScript file, or—inside the Tauri app—read a local `.js` file or package folder whose `package.json` points to a local entry. Remote installation and npm dependency resolution are not performed. Bundle dependencies into one file before installation.

Every plugin is installed disabled with zero grants. The UI marks capabilities inferred from its source, but inference never grants them. Review the source, grant only required capabilities, then enable it. Editing source disables the plugin and clears every grant. Importing a Brunomnia workspace also disables imported plugins, removes their stored data, clears grants, and removes an imported plugin theme.

## Supported exports

- `requestHooks` and `responseHooks`
- `templateTags`
- `requestActions`, `workspaceActions`, and `documentActions`
- `themes`

Hooks run for HTTP, GraphQL, gRPC, and non-streaming collection-run requests. Streaming-specific hook parity remains future work.

The context exposes focused compatibility APIs:

- `context.request`: ID/name/URL/method/body/header getters and permission-checked setters
- `context.response`: request ID, status, time, size, body, and header readers plus a permission-checked body setter
- `context.store`: plugin-local string storage
- `context.network.sendRequest`: host-mediated Brunomnia request execution
- `context.app.alert`, `prompt`, `clipboard`, and `getInfo`

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
| `template` | Execute exported custom template tags |
| `action` | Run exported request/workspace/document actions with the selected context |
| `theme` | Apply exported, color-sanitized theme values |

## Execution boundary

Each operation receives a cloned input in a new Blob Worker and has a two-second total deadline. Plugin source is limited to one megabyte. Ambient `fetch`, XHR, WebSocket, EventSource, workers, dynamic imports, the DOM, IndexedDB/cache APIs, `eval`, and function-constructor escape paths are removed. Network, prompt, and clipboard access use explicit host RPC after a matching grant. Workers are terminated and their Blob URL is revoked after every operation.

This boundary reduces plugin authority; it is not a claim that arbitrary third-party JavaScript is harmless. Read source before granting access, especially `network`, clipboard, actions, and request/response data. Package dependencies, full Node APIs, native modules, automatic plugin discovery/hot reload, and the entire Insomnia context surface are intentionally unsupported in this baseline.

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
