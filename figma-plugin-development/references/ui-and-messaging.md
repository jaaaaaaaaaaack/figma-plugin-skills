# Figma Plugin UI & Messaging Reference

Official docs:
- Creating UI: https://developers.figma.com/docs/plugins/creating-ui/
- How plugins run: https://developers.figma.com/docs/plugins/how-plugins-run/
- figma.ui API: https://developers.figma.com/docs/plugins/api/figma-ui/
- CSS variables: https://developers.figma.com/docs/plugins/css-variables/
- Libraries & bundling: https://developers.figma.com/docs/plugins/libraries-and-bundling/
- Network requests: https://developers.figma.com/docs/plugins/making-network-requests/
- figma.clientStorage: https://developers.figma.com/docs/plugins/api/figma-clientStorage/

---

## Table of contents

1. The two-runtime model
2. figma.showUI()
3. postMessage protocol (both directions)
4. Resizing the UI
5. Theme colors (full CSS variable list)
6. UI frameworks
7. Inlining the UI into one file
8. Storage: which API for which kind of data
9. Networking — UI as a proxy
10. Bundler configurations

---

## 1. The two-runtime model

Every Figma plugin runs in two completely isolated JavaScript runtimes that communicate only via `postMessage`.

| Capability | Main thread (plugin sandbox) | UI iframe |
|---|---|---|
| Access to `figma.*` (scene, nodes, document) | Yes | No |
| DOM (`document`, `window`, elements) | No | Yes |
| `fetch`, `XMLHttpRequest` | No | Yes |
| `setTimeout` / `setInterval` | No (use async/await) | Yes |
| `localStorage` / `sessionStorage` | No | Yes (sandboxed, null origin) |
| `figma.clientStorage` | Yes | No |
| Modern JS (ES2020+, async/await, Promise, Map, Set) | Yes | Yes |
| CSS, HTML, canvas, audio, etc. | No | Yes |
| Can read/write Figma nodes | Yes | No |

**Why two runtimes?** The main thread is a sandbox without browser APIs so plugins can't manipulate Figma's own DOM or escape the host. The UI iframe is a regular browser iframe with `null` origin — full web platform, no Figma access.

**Consequence**: anything visual, networked, or user-input-driven happens in the UI; anything that touches the document happens in the main thread; the two talk via messages.

---

## 2. `figma.showUI()`

Opens the iframe. The Figma build environment exposes the contents of the manifest's `ui` field as the global string `__html__`.

```ts
figma.showUI(__html__, {
  width: 320,
  height: 480,
  title: 'My Plugin',
  themeColors: true,
  visible: true,
})
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `width` | number | 300 | Pixels. Min effective width ~70. |
| `height` | number | 200 | Pixels. Can be 0 if `visible: false`. |
| `title` | string | manifest name | Shown in the window chrome. |
| `themeColors` | boolean | false | Injects `--figma-color-*` CSS vars and toggles them on light/dark switch. **Strongly recommended.** |
| `visible` | boolean | true | Set `false` for headless plugins that just need fetch/storage. |
| `position` | `{x, y}` | centered | Initial canvas-relative position. |

**Headless pattern** (no visible UI, but need fetch):

```ts
figma.showUI(__html__, { visible: false })
figma.ui.postMessage({ type: 'fetch', url: '...' })
```

---

## 3. postMessage protocol — both directions

Messages are serialized via the structured clone algorithm. Supported types: objects, arrays, numbers, strings, booleans, `null`, `undefined`, `Date`, `Uint8Array`. **Not supported**: functions, class instances (prototype lost), `Blob`, `ArrayBuffer`, non-`Uint8Array` typed arrays.

### Plugin (main thread) → UI

```ts
// Main thread
figma.ui.postMessage({ type: 'count', value: 42 })
```

```html
<!-- UI -->
<script>
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage  // <-- always unwrap .pluginMessage
    if (msg.type === 'count') console.log(msg.value)
  }
</script>
```

### UI → Plugin (main thread)

```html
<!-- UI -->
<script>
  parent.postMessage({ pluginMessage: { type: 'create', count: 5 } }, '*')
</script>
```

```ts
// Main thread
figma.ui.onmessage = (msg) => {
  if (msg.type === 'create') createRectangles(msg.count)
}
```

### Asymmetry to remember

| Direction | Wrapper required | Receive on |
|---|---|---|
| Plugin → UI | No (send raw payload) | `event.data.pluginMessage` |
| UI → Plugin | Yes (`{ pluginMessage: ... }`) | raw `msg` argument |

### Full figma.ui surface

| Method | Purpose |
|---|---|
| `postMessage(payload, options?)` | Send to UI iframe |
| `onmessage = (msg) => {}` | Receive from UI |
| `on('message', cb)` / `once(...)` / `off(...)` | Event-emitter style alternative |
| `show()` / `hide()` | Toggle visibility without destroying iframe |
| `resize(w, h)` | Change size (see below) |
| `reposition(x, y)` | Move iframe |
| `getPosition()` | Returns `{x, y}` in window + canvas coords |
| `close()` | Destroy iframe and stop UI execution |

---

## 4. Resizing the UI

Static resize from either side:

```ts
// Main thread
figma.ui.resize(400, 600)
```

```js
// UI — ask main thread to resize
parent.postMessage({ pluginMessage: { type: 'resize', w: 400, h: 600 } }, '*')
```

**Content-driven resize** (best UX — let the UI's actual rendered size drive the iframe):

```html
<script>
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      parent.postMessage(
        { pluginMessage: { type: 'resize', w: Math.ceil(width), h: Math.ceil(height) } },
        '*'
      )
    }
  })
  ro.observe(document.body)
</script>
```

```ts
// Main thread
figma.ui.onmessage = (msg) => {
  if (msg.type === 'resize') figma.ui.resize(msg.w, msg.h)
}
```

Make sure `<body>` has `margin: 0` and content fills naturally — otherwise ResizeObserver fires with stale values.

---

## 5. Theme colors

Setting `themeColors: true` in `showUI` injects every CSS variable below into `:root`. Figma updates them when the user toggles light/dark. Use `var(--figma-color-*)` everywhere.

```css
body {
  background: var(--figma-color-bg);
  color: var(--figma-color-text);
  font-family: 'Inter', sans-serif;
}
button {
  background: var(--figma-color-bg-brand);
  color: var(--figma-color-text-onbrand);
  border: 1px solid var(--figma-color-border);
}
button:hover { background: var(--figma-color-bg-brand-hover); }
button:disabled {
  background: var(--figma-color-bg-disabled);
  color: var(--figma-color-text-disabled);
}
```

### Full variable list

**Background (`--figma-color-bg-*`)**
`bg`, `bg-brand`, `bg-brand-hover`, `bg-brand-pressed`, `bg-brand-secondary`, `bg-brand-tertiary`, `bg-component`, `bg-component-hover`, `bg-component-pressed`, `bg-component-secondary`, `bg-component-tertiary`, `bg-danger`, `bg-danger-hover`, `bg-danger-pressed`, `bg-danger-secondary`, `bg-danger-tertiary`, `bg-disabled`, `bg-disabled-secondary`, `bg-hover`, `bg-inverse`, `bg-onselected`, `bg-onselected-hover`, `bg-onselected-pressed`, `bg-pressed`, `bg-secondary`, `bg-selected`, `bg-selected-hover`, `bg-selected-pressed`, `bg-selected-secondary`, `bg-selected-strong`, `bg-selected-tertiary`, `bg-success`, `bg-success-hover`, `bg-success-pressed`, `bg-success-secondary`, `bg-success-tertiary`, `bg-tertiary`, `bg-warning`, `bg-warning-hover`, `bg-warning-pressed`, `bg-warning-secondary`, `bg-warning-tertiary`, `bg-slot`.

**Text (`--figma-color-text-*`)**
`text`, `text-brand`, `text-brand-secondary`, `text-brand-tertiary`, `text-component`, `text-component-pressed`, `text-component-secondary`, `text-component-tertiary`, `text-danger`, `text-danger-secondary`, `text-danger-tertiary`, `text-disabled`, `text-hover`, `text-onbrand`, `text-onbrand-secondary`, `text-onbrand-tertiary`, `text-oncomponent`, `text-oncomponent-secondary`, `text-oncomponent-tertiary`, `text-ondanger`, `text-ondanger-secondary`, `text-ondanger-tertiary`, `text-ondisabled`, `text-oninverse`, `text-onselected`, `text-onselected-secondary`, `text-onselected-strong`, `text-onselected-tertiary`, `text-onsuccess`, `text-onsuccess-secondary`, `text-onsuccess-tertiary`, `text-onwarning`, `text-onwarning-secondary`, `text-onwarning-tertiary`, `text-secondary`, `text-secondary-hover`, `text-selected`, `text-selected-secondary`, `text-selected-tertiary`, `text-success`, `text-success-secondary`, `text-success-tertiary`, `text-tertiary`, `text-tertiary-hover`, `text-warning`, `text-warning-secondary`, `text-warning-tertiary`.

**Icon (`--figma-color-icon-*`)**
`icon`, `icon-brand`, `icon-brand-pressed`, `icon-brand-secondary`, `icon-brand-tertiary`, `icon-component`, `icon-component-pressed`, `icon-component-secondary`, `icon-component-tertiary`, `icon-danger`, `icon-danger-hover`, `icon-danger-pressed`, `icon-danger-secondary`, `icon-danger-secondary-hover`, `icon-danger-tertiary`, `icon-disabled`, `icon-hover`, `icon-onbrand`, `icon-onbrand-secondary`, `icon-onbrand-tertiary`, `icon-oncomponent`, `icon-oncomponent-secondary`, `icon-oncomponent-tertiary`, `icon-ondanger`, `icon-ondanger-secondary`, `icon-ondanger-tertiary`, `icon-ondisabled`, `icon-oninverse`, `icon-onselected`, `icon-onselected-secondary`, `icon-onselected-strong`, `icon-onselected-tertiary`, `icon-onsuccess`, `icon-onsuccess-secondary`, `icon-onsuccess-tertiary`, `icon-onwarning`, `icon-onwarning-secondary`, `icon-onwarning-tertiary`, `icon-pressed`, `icon-secondary`, `icon-secondary-hover`, `icon-selected`, `icon-selected-secondary`, `icon-selected-tertiary`, `icon-success`, `icon-success-pressed`, `icon-success-secondary`, `icon-success-tertiary`, `icon-tertiary`, `icon-tertiary-hover`, `icon-warning`, `icon-warning-pressed`, `icon-warning-secondary`, `icon-warning-tertiary`.

**Border (`--figma-color-border-*`)**
`border`, `border-brand`, `border-brand-strong`, `border-component`, `border-component-hover`, `border-component-strong`, `border-danger`, `border-danger-strong`, `border-disabled`, `border-disabled-strong`, `border-onbrand`, `border-onbrand-strong`, `border-oncomponent`, `border-oncomponent-strong`, `border-ondanger`, `border-ondanger-strong`, `border-onselected`, `border-onselected-strong`, `border-onsuccess`, `border-onsuccess-strong`, `border-onwarning`, `border-onwarning-strong`, `border-selected`, `border-selected-strong`, `border-strong`, `border-success`, `border-success-strong`, `border-warning`, `border-warning-strong`, `border-slot`.

> The naming pattern is `--figma-color-<role>-[on<context>-][<state|emphasis>]`. "on*" variables are for content placed **on top of** that role's background (e.g. `text-onbrand` for text drawn over `bg-brand`).

---

## 6. UI frameworks

| Approach | Best for | Setup cost | Bundle size |
|---|---|---|---|
| Vanilla HTML/CSS/JS in `ui.html` | Tiny plugins, forms, prototypes | None | Smallest |
| TypeScript only, no framework | Anything where you want type safety but DOM is simple | Low (just `@figma/plugin-typings`) | Small |
| **`create-figma-plugin`** | Most plugins — ships Preact components matching Figma's design system, esbuild bundling, hot reload | Low (`npm create figma-plugin`) | Small (Preact ~3kb) |
| React (manual webpack/vite) | You already know React and want the ecosystem | Higher — must inline | Larger (~45kb runtime) |
| Svelte | Tiny compiled output, no virtual DOM, good DX | Medium — `vite-plugin-svelte` + `vite-plugin-singlefile` | Smallest of frameworks |
| Vue | You already know Vue | Medium | Larger than Svelte |

### Raw approach (`@figma/plugin-typings` only)

```bash
npm install --save-dev typescript @figma/plugin-typings
```

```ts
// code.ts — main thread
figma.showUI(__html__, { themeColors: true, width: 320, height: 200 })
figma.ui.onmessage = (msg) => {
  if (msg.type === 'rect') {
    const r = figma.createRectangle()
    r.x = 100; r.y = 100
    figma.currentPage.appendChild(r)
  }
}
```

```html
<!-- ui.html -->
<style>
  body { margin: 0; padding: 16px; font-family: 'Inter', system-ui; background: var(--figma-color-bg); color: var(--figma-color-text); }
</style>
<button id="go">Create rectangle</button>
<script>
  document.getElementById('go').onclick = () =>
    parent.postMessage({ pluginMessage: { type: 'rect' } }, '*')
</script>
```

### Framework approach (`create-figma-plugin`)

```bash
npm create figma-plugin
# pick a template, then:
npm install && npm run watch
```

Generates a project that handles bundling, inlining the UI, and provides Preact components that exactly match Figma's UI style. Recommended starting point for designers — no webpack config to learn.

---

## 7. Inlining the UI into one file

The manifest's `ui` field points to **one** HTML file. That file must contain every script and stylesheet inline — Figma won't load external resources from `file://`.

```json
{ "ui": "dist/ui.html", "main": "dist/code.js" }
```

If you use React/Vue/Svelte, your bundler must inline JS+CSS into a single `ui.html`. Tools:

- **webpack** + `html-webpack-plugin` + `html-inline-script-webpack-plugin`
- **vite** + `vite-plugin-singlefile`
- **`create-figma-plugin`** — handles this automatically

Without inlining you'll see `Refused to load…` errors in the plugin console.

---

## 8. Storage: which API for which kind of data

| API | Scope | Lifetime | Size | Sync? | When to use |
|---|---|---|---|---|---|
| `figma.clientStorage.setAsync(key, val)` | Per **user + machine** | Until browser cache cleared or plugin ID changes | 5 MB total per plugin | No | User preferences, API tokens, recently-used items |
| `node.setPluginData(key, value)` | Per **node**, only your plugin can read | Lives with the node forever | 100 kB per entry (pluginId + key + value) | Yes (in document) | Plugin-specific metadata on a layer (e.g. "this frame was generated from spec X") |
| `node.setSharedPluginData(namespace, key, value)` | Per **node**, readable by **any** plugin with the namespace | Lives with the node | 100 kB per entry (namespace + key + value) | Yes | Cross-plugin metadata (e.g. design-token IDs other plugins might consume) |
| `figma.root.setPluginData(key, value)` | Document-wide, your plugin only | Lives with the document | 100 kB per entry | Yes | Document-level config (e.g. which style guide this file follows) |
| `figma.root.setSharedPluginData(ns, key, val)` | Document-wide, any plugin | Lives with the document | 100 kB per entry | Yes | Cross-plugin document settings |

> The 100 kB ceiling is **per key**, not per node. A node may carry many keys; each is independently limited. Split large payloads across keys if you bump up against it.

**All `setPluginData` values are strings.** For objects:

```ts
node.setPluginData('config', JSON.stringify({ version: 2, foo: 'bar' }))
const cfg = JSON.parse(node.getPluginData('config') || '{}')
```

`clientStorage` accepts any structured-cloneable value directly (objects, arrays, numbers, `Uint8Array`, etc.) — no manual JSON dance.

### clientStorage API

```ts
await figma.clientStorage.setAsync('apiToken', 'abc123')
const token = await figma.clientStorage.getAsync('apiToken')  // undefined if missing
await figma.clientStorage.deleteAsync('apiToken')
const keys = await figma.clientStorage.keysAsync()  // string[]
```

---

## 9. Networking — UI as a proxy

`fetch` is **not** available in the main thread. The plugin proxies network calls through the UI:

```ts
// Main thread — request data from UI
figma.showUI(__html__, { visible: false })

function fetchViaUI(url: string): Promise<any> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36)
    const onmessage = (msg: any) => {
      if (msg.type === 'fetch:result' && msg.id === id) {
        figma.ui.off('message', onmessage as any)
        resolve(msg.data)
      }
    }
    figma.ui.on('message', onmessage as any)
    figma.ui.postMessage({ type: 'fetch', id, url })
  })
}

const data = await fetchViaUI('https://api.example.com/items')
```

```html
<!-- UI -->
<script>
  window.onmessage = async (e) => {
    const msg = e.data.pluginMessage
    if (msg.type === 'fetch') {
      const res = await fetch(msg.url)
      const data = await res.json()
      parent.postMessage(
        { pluginMessage: { type: 'fetch:result', id: msg.id, data } },
        '*'
      )
    }
  }
</script>
```

### `networkAccess` in manifest

Required before publishing. The plugin can only call domains you declare.

```json
{
  "networkAccess": {
    "allowedDomains": ["api.example.com", "cdn.example.com"],
    "reasoning": "Fetches design tokens from our internal API.",
    "devAllowedDomains": ["http://localhost:3000"]
  }
}
```

| Value | Meaning |
|---|---|
| `["none"]` | Plugin makes no network requests |
| `["*"]` | Any domain (requires `reasoning`, shown publicly on Community page) |
| `["api.example.com"]` | Specific host |
| `["api.example.com/v1/*"]` | Granular paths |

Plugin iframes have a `null` origin, so the target API must respond with `Access-Control-Allow-Origin: *` (or an explicit `null`). Most public APIs do.

---

## 10. Bundler configurations

### webpack (TS + inlined HTML)

```js
// webpack.config.js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin')
const path = require('path')

module.exports = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  entry: {
    code: './src/code.ts',
    ui: './src/ui.tsx',
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  output: { filename: '[name].js', path: path.resolve(__dirname, 'dist') },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
    }),
    new HtmlInlineScriptPlugin(),  // inlines ui.js into ui.html
  ],
})
```

Manifest:
```json
{ "main": "dist/code.js", "ui": "dist/ui.html" }
```

> Use `devtool: 'inline-source-map'` — Figma's eval differs from browser eval, so `eval-source-map` breaks.

### vite (Svelte/Vue/React, single-file UI)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    rollupOptions: { input: 'src/ui.html' },
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
})
```

Build the main thread separately with esbuild or tsc:

```jsonc
// package.json scripts
{
  "build:code": "esbuild src/code.ts --bundle --outfile=dist/code.js --target=es2020",
  "build:ui":   "vite build",
  "build":      "npm run build:code && npm run build:ui",
  "watch":      "npm run build:code -- --watch & npm run build:ui -- --watch"
}
```

### Esbuild only (zero-framework, fastest)

```bash
esbuild src/code.ts --bundle --outfile=dist/code.js --target=es2020
# UI is hand-written ui.html — no bundling needed
```
