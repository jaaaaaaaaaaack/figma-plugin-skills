# Figma Dev Mode & Codegen Plugins Reference

Reference for building Dev Mode plugins (Inspect panel extensions and codegen plugins) using the Figma Plugin API.

## Official documentation

- Plugin docs root: https://developers.figma.com/docs/plugins/
- Dev Mode plugins overview: https://developers.figma.com/docs/plugins/working-in-dev-mode/
- Codegen plugins guide: https://developers.figma.com/docs/plugins/codegen-plugins/
- `figma.codegen` API: https://developers.figma.com/docs/plugins/api/figma-codegen/
- `CodegenResult`: https://developers.figma.com/docs/plugins/api/CodegenResult/
- `CodegenPreferencesEvent`: https://developers.figma.com/docs/plugins/api/CodegenPreferencesEvent/
- `Annotation`: https://developers.figma.com/docs/plugins/api/Annotation/
- `DevResource`: https://developers.figma.com/docs/plugins/api/DevResource/
- `figma.variables`: https://developers.figma.com/docs/plugins/api/figma-variables/
- Manifest schema: https://developers.figma.com/docs/plugins/manifest/

URLs are subject to redirect from `figma.com/plugin-docs/` to `developers.figma.com/docs/plugins/`. Both resolve to the same content.

---

## Table of contents

1. What Dev Mode plugins are
2. manifest.json fields for Dev Mode
3. The codegen event
4. The preferenceschange event
5. The inspect capability (no codegen)
6. Common codegen patterns
7. Variables in Dev Mode
8. Annotations API
9. Dev Resources API
10. Limits and gotchas

---

## 1. What Dev Mode plugins are

Dev Mode plugins extend Figma's **Inspect panel** — the right-hand sidebar developers see when a file is in Dev Mode or opened via the VS Code extension. They are designed to "ensure developers have all of the relevant information they need to implement a design in one place."

Two main use cases:

| Use case | Capability | What it does |
|---|---|---|
| **Inspection** | `inspect` | Replaces or augments the default Inspect panel — pulls metadata from external tools (Jira, GitHub, Storybook), shows custom computed CSS, etc. |
| **Code generation** | `codegen` | Adds new languages/frameworks to the code panel — React+Tailwind, SwiftUI, custom design-token output, etc. |

### How Dev Mode plugins differ from regular plugins

| Aspect | Regular plugin | Dev Mode plugin |
|---|---|---|
| Write access | Full | **Read-only.** Setter methods don't work. Only `pluginData`, `relaunchData`, and `exportAsync()` are allowed |
| Page loading | All pages load up-front (unless `dynamic-page`) | **Always dynamic** — pages load on demand, even without `documentAccess: dynamic-page` |
| `skipInvisibleInstanceChildren` | Defaults to `false` | Defaults to `true` (performance optimization) |
| UI surface | Floating iframe | Iframe is fitted into the Inspect panel (full width/height of the panel) |
| Codegen handler | N/A | Has a strict 15-second timeout |

### Detecting Dev Mode at runtime

```javascript
if (figma.editorType === 'dev') {
  // Running in Dev Mode
}

if (figma.vscode) {
  // Running inside the Figma VS Code extension
}
```

---

## 2. `manifest.json` fields for Dev Mode

### Minimal inspect plugin

```json
{
  "name": "My Inspect Plugin",
  "id": "0000000000000000000",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["dev"],
  "capabilities": ["inspect", "vscode"],
  "documentAccess": "dynamic-page"
}
```

### Minimal codegen plugin

```json
{
  "name": "My Codegen Plugin",
  "id": "0000000000000000000",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["dev"],
  "capabilities": ["codegen", "vscode"],
  "documentAccess": "dynamic-page",
  "codegenLanguages": [
    { "label": "React + Tailwind", "value": "react-tailwind" },
    { "label": "SwiftUI", "value": "swiftui" },
    { "label": "HTML + CSS", "value": "html-css" }
  ]
}
```

### Field reference

| Field | Values | Notes |
|---|---|---|
| `editorType` | `["dev"]`, `["figma", "dev"]`, `["figma"]`, `["figjam"]`, `["slides"]`, `["buzz"]` | `["figjam", "dev"]` is **not** supported. Use `["figma", "dev"]` for a plugin that runs in both Design and Dev Mode. |
| `capabilities` | `"codegen"`, `"inspect"`, `"vscode"`, `"textreview"` | `vscode` allows the plugin to run inside the VS Code extension. A codegen plugin should not also declare `inspect`. |
| `codegenLanguages` | Array of `{ label, value }` | Required when `capabilities` contains `"codegen"`. `label` shows in the language dropdown; `value` is the string passed to your `generate` handler. |
| `codegenPreferences` | Array (see below) | Optional. Adds toggles/dropdowns to the codegen settings menu. |
| `documentAccess` | `"dynamic-page"` | Required for all new plugins. Dev Mode plugins always load pages dynamically regardless. |
| `networkAccess` | `{ allowedDomains, reasoning, devAllowedDomains }` | `"none"` or `"*"` or wildcard list. `*` requires `reasoning`. |

### `codegenPreferences` item types

Three `itemType` values are supported:

#### `unit` — scaled unit toggle (e.g. px ↔ rem)

```json
{
  "itemType": "unit",
  "scaledUnit": "Rem",
  "defaultScaleFactor": 16,
  "default": true,
  "includedLanguages": []
}
```

Surfaces a px/rem toggle. The chosen unit appears at runtime as `figma.codegen.preferences.unit` (`"PIXEL"` or `"SCALED"`) and `scaleFactor`.

#### `select` — dropdown

```json
{
  "itemType": "select",
  "propertyName": "tabSize",
  "label": "Tab Size",
  "options": [
    { "label": "2 spaces", "value": "2", "isDefault": true },
    { "label": "4 spaces", "value": "4" }
  ],
  "includedLanguages": ["react-tailwind", "html-css"]
}
```

Surfaces a dropdown. At runtime: `figma.codegen.preferences.customSettings["tabSize"] === "2"`.

#### `action` — opens a plugin UI for advanced prefs

```json
{
  "itemType": "action",
  "propertyName": "showMore",
  "label": "More settings…",
  "includedLanguages": ["react-tailwind"]
}
```

Clicking this fires `preferenceschange` (it does NOT auto-open UI — your handler decides what to do, typically `figma.showUI(...)`). Only `action` items fire `preferenceschange`.

#### Common fields

| Field | Purpose |
|---|---|
| `propertyName` | Internal identifier — appears in `customSettings` and `preferenceschange` events. |
| `label` | User-visible text. |
| `options` | Required for `select`. Each option has `label`, `value`, optional `isDefault`. |
| `includedLanguages` | Optional. If present, the preference only shows when those `codegenLanguages` values are selected. Omit to show for all. |

---

## 3. The `codegen` event

```javascript
figma.codegen.on('generate', async (event) => {
  const { node, language, preferences } = event;

  if (language === 'react-tailwind') {
    return [
      { title: 'Component',  language: 'TYPESCRIPT', code: renderReact(node) },
      { title: 'Tailwind config', language: 'JAVASCRIPT', code: renderConfig(node) }
    ];
  }
  return [];
});
```

### `CodegenEvent` payload

| Field | Type | What |
|---|---|---|
| `node` | `SceneNode` | The currently selected node. |
| `language` | `string` | The `value` from `codegenLanguages` the user picked. |
| `preferences` | `CodegenPreferences` | Same shape as `figma.codegen.preferences`. |

### `CodegenPreferences`

```typescript
type CodegenPreferences = {
  readonly unit: 'PIXEL' | 'SCALED'
  readonly scaleFactor?: number
  readonly customSettings: Record<string, string>
}
```

`customSettings` maps each `select` preference's `propertyName` to the chosen `value`.

### `CodegenResult`

```typescript
type CodegenResult = {
  title: string     // section header in the Inspect panel
  code: string      // the generated source
  language: CodegenResultLanguage
}
```

Each entry in the returned array becomes a separate, copyable section in the panel.

### `CodegenResult.language` enum

Used only for syntax highlighting. Sixteen values:

| | | | |
|---|---|---|---|
| `TYPESCRIPT` | `JAVASCRIPT` | `PYTHON` | `RUBY` |
| `GO` | `RUST` | `SWIFT` | `KOTLIN` |
| `CPP` | `BASH` | `SQL` | `CSS` |
| `HTML` | `JSON` | `GRAPHQL` | `PLAINTEXT` |

This is **separate from** `codegenLanguages[].value` in the manifest. The manifest value is just an identifier you pick; the result language drives the highlighter.

### Timeout & async rules

- The `generate` callback has a **15-second timeout**. Exceeding it shows "This plugin ran into an issue" in the Inspect panel.
- The handler may be `async`, but should resolve quickly.
- `figma.showUI()` is **not allowed** inside the generate callback. Use `figma.ui.postMessage()` for an already-open UI instead.

### Triggering a re-run

`generate` fires automatically on:
- Selection changes
- Codegen language switches
- Preference changes

Call `figma.codegen.refresh()` to force a re-run (e.g. after your UI saved new settings).

---

## 4. The `preferenceschange` event

```javascript
figma.codegen.on('preferenceschange', async (event) => {
  if (event.propertyName === 'showMore') {
    figma.showUI(__html__, { width: 320, height: 480, title: 'Settings' });
  }
});
```

### Payload

```typescript
type CodegenPreferencesEvent = { propertyName: string }
```

### Behavior

- **Only `action` items trigger this event.** `select` and `unit` changes are reflected automatically and re-run `generate`; they do not fire `preferenceschange`.
- Persistence of preferences is automatic for `select` and `unit`. For `action`-driven settings (your custom UI), persist with `figma.clientStorage.setAsync(key, value)` and call `figma.codegen.refresh()` after writing.

```javascript
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-prefs') {
    await figma.clientStorage.setAsync('my-prefs', msg.prefs);
    figma.codegen.refresh();
  }
};
```

### Listener registration

| Method | Use |
|---|---|
| `figma.codegen.on(type, cb)` | Persistent listener. |
| `figma.codegen.once(type, cb)` | Fires only once. |
| `figma.codegen.off(type, cb)` | Removes a listener. |

---

## 5. The `inspect` capability (without codegen)

If you only need to **augment the Inspect panel** (e.g. show a custom CSS view, attach Jira tickets, show Storybook embeds) — and not feed the code-generation dropdown — declare `inspect` instead of `codegen`:

```json
{
  "editorType": ["dev"],
  "capabilities": ["inspect", "vscode"],
  "documentAccess": "dynamic-page",
  "ui": "ui.html"
}
```

Inspect plugins use a normal `figma.showUI(...)` iframe that the Inspect panel renders full-height. There is no `generate` event — listen for selection yourself:

```javascript
figma.on('selectionchange', () => {
  const node = figma.currentPage.selection[0];
  figma.ui.postMessage({ type: 'selection', node: serialize(node) });
});
```

UI sizing tips:
- The iframe fills the Inspect panel width (typically ~300px minimum).
- In the VS Code extension the panel is **horizontal**; on web it is **vertical**. Design responsively.
- Handle vertical scrolling — the panel does not scroll for you.

---

## 6. Common codegen patterns

### 6a. React + Tailwind

```javascript
figma.codegen.on('generate', async ({ node, language }) => {
  if (language !== 'react-tailwind') return [];

  const className = await tailwindClassesFor(node);
  const jsx = `export function ${pascal(node.name)}() {
  return <div className="${className}">{${'/* children */'}}</div>;
}`;

  return [{ title: 'Component', language: 'TYPESCRIPT', code: jsx }];
});

async function tailwindClassesFor(node) {
  const cls = [];
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    cls.push(node.layoutMode === 'HORIZONTAL' ? 'flex flex-row' : 'flex flex-col');
    if (node.itemSpacing) cls.push(`gap-[${node.itemSpacing}px]`);
  }
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
    cls.push(`rounded-[${node.cornerRadius}px]`);
  }
  if ('fills' in node && Array.isArray(node.fills) && node.fills[0]?.type === 'SOLID') {
    const { r, g, b } = node.fills[0].color;
    cls.push(`bg-[#${hex(r)}${hex(g)}${hex(b)}]`);
  }
  return cls.join(' ');
}
```

### 6b. SwiftUI

```javascript
figma.codegen.on('generate', async ({ node, language }) => {
  if (language !== 'swiftui') return [];

  const w = Math.round(node.width);
  const h = Math.round(node.height);
  const code = `struct ${pascal(node.name)}: View {
  var body: some View {
    Rectangle()
      .frame(width: ${w}, height: ${h})
      .cornerRadius(${node.cornerRadius ?? 0})
  }
}`;
  return [{ title: 'SwiftUI', language: 'SWIFT', code }];
});
```

### 6c. Plain HTML + CSS

```javascript
figma.codegen.on('generate', async ({ node, language }) => {
  if (language !== 'html-css') return [];

  const cssText = await node.getCSSAsync(); // returns { width, height, ... }
  const css = `.${kebab(node.name)} {
${Object.entries(cssText).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}`;
  const html = `<div class="${kebab(node.name)}"></div>`;

  return [
    { title: 'HTML', language: 'HTML', code: html },
    { title: 'CSS',  language: 'CSS',  code: css }
  ];
});
```

`node.getCSSAsync()` is the easiest way to get Figma's own CSS output — same one shown in the default Inspect panel.

### 6d. Design tokens from variable bindings

```javascript
figma.codegen.on('generate', async ({ node }) => {
  const tokens = await collectBoundVariables(node);
  if (!tokens.length) return [];

  const json = JSON.stringify(
    Object.fromEntries(tokens.map(t => [t.name, t.value])),
    null, 2
  );
  return [{ title: 'Design tokens', language: 'JSON', code: json }];
});
```

(`collectBoundVariables` shown in §7.)

---

## 7. Variables in Dev Mode

### Reading a variable by ID

```javascript
const variable = await figma.variables.getVariableByIdAsync(id);
// Variable { id, name, resolvedType, valuesByMode, variableCollectionId, ... }
```

### `node.boundVariables` shape

Each bindable property either holds a single `VariableAlias`, an array (for `fills`/`strokes`), or a per-channel map (for components like `color`).

```typescript
type VariableAlias = { type: 'VARIABLE_ALIAS'; id: string }
```

Bindable properties commonly include:

| Property | Shape |
|---|---|
| `fills`, `strokes` | `VariableAlias[]` (one per paint) |
| `effects` | per-effect map |
| `opacity` | `VariableAlias` |
| `cornerRadius`, `topLeftRadius`, … | `VariableAlias` |
| `width`, `height` | `VariableAlias` |
| `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom` | `VariableAlias` |
| `itemSpacing`, `counterAxisSpacing` | `VariableAlias` |
| `characters`, `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing` | `VariableAlias` (on `TextNode`) |
| `layoutGrids` | per-grid map |

### Resolving a bound value for the current mode

```javascript
async function resolveBoundVariable(node, propertyName) {
  const binding = node.boundVariables?.[propertyName];
  if (!binding) return null;

  const alias = Array.isArray(binding) ? binding[0] : binding;
  const variable = await figma.variables.getVariableByIdAsync(alias.id);
  if (!variable) return null;

  const collection = await figma.variables
    .getVariableCollectionByIdAsync(variable.variableCollectionId);
  const modeId = collection.defaultModeId;

  let value = variable.valuesByMode[modeId];

  // Follow aliases recursively
  while (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
    const next = await figma.variables.getVariableByIdAsync(value.id);
    value = next.valuesByMode[modeId];
  }

  return { name: variable.name, type: variable.resolvedType, value };
}
```

`Variable` fields you'll use most:

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Slash-separated path, e.g. `color/bg/default` |
| `resolvedType` | `'BOOLEAN' \| 'FLOAT' \| 'STRING' \| 'COLOR'` | |
| `valuesByMode` | `Record<modeId, value>` | Values may themselves be `VariableAlias` |
| `variableCollectionId` | `string` | Pass to `getVariableCollectionByIdAsync` |

---

## 8. Annotations API

Annotations are sticky notes pinned to nodes; they show in the Dev Mode Annotations panel. They are writable even in Dev Mode (one of the rare exceptions to read-only).

### `figma.annotations`

| Method | Returns |
|---|---|
| `getAnnotationCategoriesAsync()` | `Promise<AnnotationCategory[]>` |
| `getAnnotationCategoryByIdAsync(id)` | `Promise<AnnotationCategory \| null>` |
| `addAnnotationCategoryAsync({ label, color })` | `Promise<AnnotationCategory>` |

### `Annotation` type

```typescript
interface Annotation {
  readonly label?: string
  readonly labelMarkdown?: string
  readonly properties?: ReadonlyArray<AnnotationProperty>
  readonly categoryId?: string
}
```

### Supported node types

`ComponentNode`, `ComponentSetNode`, `EllipseNode`, `FrameNode`, `InstanceNode`, `LineNode`, `PolygonNode`, `RectangleNode`, `StarNode`, `TextNode`, `VectorNode`.

### Examples

```javascript
// Plain note
node.annotations = [{ label: 'Main product navigation' }];

// Pin a property (shows current fill in the annotation card)
node.annotations = [{ properties: [{ type: 'fills' }] }];

// Note + pinned property
node.annotations = [{
  label: 'Pressing activates animation',
  properties: [{ type: 'width' }]
}];

// Markdown
node.annotations = [{
  labelMarkdown: '# Important \n Pressing activates a *fun* animation'
}];

// Category
const a11y = await figma.annotations.addAnnotationCategoryAsync({
  label: 'a11y', color: 'BLUE'
});
node.annotations = [{ label: 'Fill in aria-label', categoryId: a11y.id }];
```

`AnnotationProperty.type` accepts node property names — `fills`, `strokes`, `width`, `height`, `cornerRadius`, `opacity`, etc.

---

## 9. Dev Resources API

Dev resources are URLs attached to a node — Storybook stories, GitHub source, Jira tickets, etc. They appear in the "Resources" section of the Inspect panel.

### `DevResource` type

| Field | Type | Notes |
|---|---|---|
| `name` | `string` (readonly) | Display name |
| `url` | `string` (readonly) | Acts as the unique key |
| `nodeId` | `string` | Node the link is attached to |
| `inheritedNodeId?` | `string` (readonly) | Present only on `INSTANCE` nodes when the link is inherited from the main component |

### Node-level methods

| Method | Purpose |
|---|---|
| `node.addDevResourceAsync(url, name?)` | Attach a new link |
| `node.getDevResourcesAsync({ includeChildren? })` | Read links on this node (and optionally subtree) |
| `node.editDevResourceAsync(currentUrl, { name?, url? })` | Update name or URL |
| `node.deleteDevResourceAsync(url)` | Remove |

```javascript
const node = figma.currentPage.selection[0];
await node.addDevResourceAsync('https://storybook.example.com/?path=/story/button', 'Button story');

const resources = await node.getDevResourcesAsync({ includeChildren: true });

await node.editDevResourceAsync(
  'https://storybook.example.com/?path=/story/button',
  { name: 'Button (Storybook)' }
);
```

### Plugin-level events

`figma.on('linkpreview', ...)` and `figma.on('opendevresource', ...)` let a plugin own the rendering of a link preview and handle link clicks (e.g. open the file in the IDE). Register them at the top level of `code.js`.

---

## 10. Limits and gotchas

| Gotcha | Detail |
|---|---|
| **Read-only by default** | All setter methods are no-ops in Dev Mode, except `pluginData`, `relaunchData`, `exportAsync()`, `annotations`, and the `devResources` mutators. |
| **15-second `generate` timeout** | Long network calls will fail. Cache aggressively in `figma.clientStorage`. If you must wait, kick off the request, return a "Loading…" placeholder, then call `figma.codegen.refresh()` when ready. |
| **No `figma.showUI()` inside `generate`** | Use `figma.ui.postMessage()` against an already-open UI. To open a settings UI, do it from `preferenceschange` (action item) or plugin start. |
| **Pages load dynamically** | Always `await figma.getNodeByIdAsync(id)` rather than `figma.getNodeById(id)`. Pages may not be loaded yet. |
| **`skipInvisibleInstanceChildren` defaults to `true`** | If your codegen depends on hidden children, set `figma.skipInvisibleInstanceChildren = false` at the top of `code.js`. |
| **Language switching re-runs `generate`** | Don't keep mutable state between runs that assumes the same language. The `language` arg can change between consecutive calls. |
| **Only `action` items fire `preferenceschange`** | If you need to react to `select`/`unit` changes, do it in `generate` — it gets re-run automatically and receives the new `preferences`. |
| **`["figjam", "dev"]` is invalid** | Dev Mode lives inside Figma Design files. To run in both, use `["figma", "dev"]`. |
| **VS Code panel is horizontal** | Test your iframe layout in both orientations. Minimum useful width is ~300px. |
| **VS Code: replace `window.open`** | Use `figma.openExternal(url)`. Also replace `alert()` / `confirm()` with custom UI, and re-implement cut/copy/paste keyboard handlers. |
| **`CodegenResult.language` ≠ `codegenLanguages[].value`** | The first drives syntax highlighting (fixed enum); the second is your own identifier passed to `generate`. |
| **`includedLanguages: []` vs omitted** | An empty array means "show for no languages"; omit the field entirely to show the preference for all languages. |
| **Variable values may be aliases** | `valuesByMode[modeId]` can itself be a `VariableAlias`. Resolve in a loop until you hit a primitive. |
| **Multiple modes** | A collection has many modes. For codegen, prefer `collection.defaultModeId` unless the user has picked one — there is no plugin API to read the current Dev Mode's active mode. |
| **Manifest id** | Use Figma's "Generate manifest" in the desktop app — IDs are validated and tied to the publisher account. |
