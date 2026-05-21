# Figma Plugin Setup, Tooling & Publishing Reference

Official docs:
- Plugin quickstart: https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
- Prerequisites: https://developers.figma.com/docs/plugins/prerequisites/
- Manifest: https://developers.figma.com/docs/plugins/manifest/
- Libraries & bundling: https://developers.figma.com/docs/plugins/libraries-and-bundling/
- Publishing checklist: https://developers.figma.com/docs/plugins/publishing/
- Community publishing guide: https://help.figma.com/hc/en-us/articles/360042293394
- create-figma-plugin: https://yuanqing.github.io/create-figma-plugin/

---

## Table of contents

1. Scaffolding a new plugin
2. Required dev tooling
3. VSCode setup (tsconfig variants)
4. Iteration loop (run/reload inside Figma desktop)
5. Publishing (community vs private/org)
6. Updating a published plugin
7. Common gotchas for first-timers

---

## 1. Scaffolding a new plugin

Three viable paths. Pick based on how much you want pre-configured.

### A. Figma desktop "Create new plugin" (zero-config starter)

In the Figma desktop app: **Menu → Plugins → Development → New plugin…**, pick "Custom UI", choose Figma design as editor type, save folder locally.

Generated tree:
```
my-plugin/
├── code.ts            # main thread entry
├── ui.html            # UI iframe markup
├── manifest.json      # plugin metadata
├── package.json       # has typescript + @figma/plugin-typings
├── tsconfig.json
├── README.md
└── .gitignore
```

Best for: first plugin ever, learning the API. No bundler — TS compiles directly to JS.

### B. `create-figma-plugin` (framework, community-maintained)

```bash
npm create figma-plugin
# follow prompts: name, template (plugin/widget), language (TS), framework (Preact)
cd my-plugin
npm install
npm run watch
```

Generated tree (TS + Preact template):
```
my-plugin/
├── src/
│   ├── main.ts           # main thread — exports handler functions
│   └── ui.tsx            # Preact UI component
├── manifest.json
├── package.json          # @create-figma-plugin/* deps
├── tsconfig.json
└── build/                # output (esbuild)
    ├── main.js
    └── ui.js
```

Best for: real plugins by a designer who wants Figma-style components (`Button`, `Textbox`, `Stack`, etc.) without building them. Esbuild is fast and configured for you.

### C. Manual (TypeScript + webpack or vite)

```bash
mkdir my-plugin && cd my-plugin
npm init -y
npm install --save-dev typescript @figma/plugin-typings
npm install --save-dev webpack webpack-cli ts-loader html-webpack-plugin html-inline-script-webpack-plugin
# or for vite: npm i -D vite vite-plugin-singlefile @vitejs/plugin-react
```

Typical tree:
```
my-plugin/
├── src/
│   ├── code.ts           # main thread
│   ├── ui.tsx            # UI entry
│   └── ui.html           # HTML template
├── dist/                 # bundler output (gitignored)
├── manifest.json
├── package.json
├── tsconfig.json
└── webpack.config.js     # or vite.config.ts
```

Best for: existing React/Svelte/Vue codebase, or when you need precise bundler control.

---

## 2. Required dev tooling

| Tool | Why | Install |
|---|---|---|
| **Node.js 18+** | Runs npm, bundlers, TS compiler | https://nodejs.org/ |
| **npm** (or pnpm/yarn) | Package management | Ships with Node |
| **TypeScript** | Figma's API is fully typed; autocomplete is the main reason to use TS | `npm i -D typescript` |
| **`@figma/plugin-typings`** | The `figma.*` global's type definitions | `npm i -D @figma/plugin-typings` |
| **`@figma/widget-typings`** | If building a FigJam widget (not a plugin) | `npm i -D @figma/widget-typings` |
| **Bundler** | Required if using a framework or splitting code | webpack / vite / esbuild |
| **`eslint-plugin-figma-plugins`** (optional) | Catches plugin-specific mistakes | `npm i -D @figma/eslint-plugin-figma-plugins` |
| **Figma desktop app** | **Required** — browser Figma cannot load local plugins | https://www.figma.com/downloads/ |

---

## 3. VSCode setup

### Recommended extensions
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Error Lens** (`usernamehw.errorlens`) — surfaces TS errors inline
- Optional: **GitLens**, **Tailwind IntelliSense** (if you use Tailwind in UI)

### tsconfig — main thread vs UI

Different `lib` and `types` needed because the runtimes are different. Two common approaches:

**Single config (simplest, what `create-figma-plugin` does)**:
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "lib": ["es2020", "dom"],          // dom needed for UI
    "types": ["@figma/plugin-typings"], // figma global for main
    "jsx": "react-jsx",                 // if using React/Preact
    "skipLibCheck": true
  }
}
```

**Split configs (stricter, prevents UI code from touching `figma.*` and vice versa)**:
```jsonc
// tsconfig.main.json — main thread, no DOM
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["es2020"],
    "types": ["@figma/plugin-typings"],
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src/code.ts", "src/main/**/*"]
}
```
```jsonc
// tsconfig.ui.json — UI iframe, DOM but no figma global
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["es2020", "dom"],
    "types": [],
    "strict": true,
    "jsx": "react-jsx"
  },
  "include": ["src/ui.tsx", "src/ui/**/*"]
}
```

After installing `@figma/plugin-typings`, VSCode will autocomplete `figma.createRectangle()`, suggest node types, etc.

---

## 4. Iteration loop

1. **Open** the Figma desktop app in any design file.
2. **Menu → Plugins → Development → Import plugin from manifest…** Pick `manifest.json` once — Figma remembers it.
3. **Run**: Menu → Plugins → Development → *your plugin name*.
4. **Edit code → rebuild** (`npm run watch` keeps bundler running).
5. **Right-click the canvas → Plugins → Development → Run last plugin** (shortcut: ⌘⌥P / Ctrl+Alt+P) — re-runs without menu hunting.

> **No hot reload built in.** Every code change requires re-running the plugin. `create-figma-plugin` has a watch script that rebuilds, but the user still re-runs the plugin in Figma.

### Plugin console
**Menu → Plugins → Development → Open console.** Shows `console.log`/errors from both main thread and UI. Keep it open while developing.

---

## 5. Publishing

### Community vs private

| Type | Audience | Cost | Review | Use case |
|---|---|---|---|---|
| **Community** | Anyone on Figma | Free | Yes — Figma review required | Public plugins |
| **Private (org)** | Your Figma organization only | Org plan needed | No review | Internal tools, company-specific workflows |
| **Local / dev** | Just you, via Import manifest | Free | No | Development, one-off scripts |

### Publishing flow (community)

1. In Figma desktop, find your plugin under **Menu → Plugins → Development**.
2. Right-click → **Publish new release…**
3. Fill the publish form (see assets below).
4. Submit → Figma reviews → approved or rejected with feedback → released to Community.

### Required assets

| Asset | Spec |
|---|---|
| **Icon** | 128 × 128 px, PNG (transparent ok) |
| **Cover image** | 1920 × 1080 px (16:9). Image or short video. The old 1920 × 960 spec is retired. |
| **Carousel images/videos** | Up to 9 additional |
| **Name** | Short, descriptive |
| **Tagline** | One sentence |
| **Description** | What it does and main features (markdown supported) |
| **Category** | e.g. Design tools, Software development |
| **Tags** | Free-form keywords for search |
| **Support contact** | Email or URL |
| **Playground file** (optional) | Demo .fig file users can copy |

### Review timeline & rejections

- **Timeline**: no published SLA; typically a few days to ~2 weeks. Volume-dependent.
- **Common rejection reasons**:
  - Crashes on empty selection, wrong node types, or in FigJam vs Figma
  - Uses `networkAccess: "*"` without a clear `reasoning`
  - Description doesn't accurately describe what the plugin does
  - Icon/cover is low quality or violates trademarks
  - Plugin sends user data to a server without disclosing it
  - Plugin name conflicts with existing trademarks (e.g. naming yours "Notion Sync" when not affiliated)

### Versioning

Figma doesn't enforce semver. Bump version on each release; users always get the latest.

```json
{ "name": "My Plugin", "version": "1.4.0", ... }
```

---

## 6. Updating a published plugin

- Every time a user runs the plugin, Figma fetches the latest published version from the Community.
- **There is no version pinning for users.** You cannot ship a beta channel; everyone gets your latest release the moment it's approved.
- Implication: never break the data format you wrote into `pluginData`/`clientStorage`. Always read defensively and migrate forward.

```ts
const raw = node.getPluginData('config')
const data = raw ? JSON.parse(raw) : { version: 1 }
if (data.version === 1) { /* migrate to v2 */ }
```

---

## 7. Common gotchas for first-timers

### Plugin lifecycle ends on `closePlugin`
```ts
figma.closePlugin('Done!')           // shows toast, then kills plugin
await someAsync()                    // <-- NEVER RUNS
```
Anything async kicked off **after** `closePlugin` is silently dropped. Pattern: await everything first, *then* close.
```ts
await Promise.all(items.map(work))
figma.closePlugin(`Processed ${items.length} items`)
```
The plugin is also killed when the user closes the file or Figma itself — there's no exit hook.

### Loading fonts is async
Every text-touching API needs the font loaded first.
```ts
const text = figma.createText()
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
text.characters = 'Hello'           // throws if font not loaded
text.fontSize = 24
```
For mixed fonts in an existing node, load every font in `text.getRangeAllFontNames(0, text.characters.length)`.

### Pages must be loaded explicitly (dynamic-page docs)
Newer Figma documents use `"documentAccess": "dynamic-page"` in the manifest, which only loads the current page. To walk the whole document:
```ts
await figma.loadAllPagesAsync()
for (const page of figma.root.children) {
  for (const node of page.findAll(...)) { ... }
}
```
Without this you'll see errors like "Cannot access node because page is not loaded." Recommended for all new plugins (faster load on huge files).

### `editorType` controls which APIs exist
```json
{ "editorType": ["figma", "figjam", "dev", "slides", "buzz"] }
```
- `figma` — design files (full API)
- `figjam` — boards (subset: sticky notes, shapes, stamps; no frames)
- `dev` — Dev Mode (`codegen`/`inspect` capabilities)
- `slides` — Figma Slides
- `buzz` — Figma Buzz

If you call `figma.createFrame()` in a FigJam-only plugin it throws. Test in each editor type your manifest lists.

### Plugin data is always strings
```ts
node.setPluginData('count', 5)                // stored as "5"
const n = parseInt(node.getPluginData('count'))
// Objects need JSON:
node.setPluginData('cfg', JSON.stringify({ a: 1 }))
JSON.parse(node.getPluginData('cfg') || '{}')
```
`clientStorage` *does* accept structured values directly — only `setPluginData` requires stringification.

### Other quick gotchas
- **`figma.ui.postMessage` data must be cloneable** — no functions, no class instances (prototype is dropped).
- **`Uint8Array` is the only typed array allowed** in messages. Convert `ArrayBuffer` first.
- **CORS still applies** in the UI iframe — the iframe has a `null` origin, so the API must allow `*`.
- **`__html__` is build-time injected** by Figma's plugin runtime — don't try to `import` it; it's a global string.
- **Don't `console.log` huge nodes** — `JSON.stringify(figma.currentPage)` will crash because nodes have circular refs and live getters.
- **One plugin instance at a time per file** — running again closes the previous instance.
