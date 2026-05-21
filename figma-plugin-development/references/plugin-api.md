# Figma Plugin API Reference

> **Official docs:** https://developers.figma.com/docs/plugins/ (legacy: https://www.figma.com/plugin-docs/ — redirects to developers.figma.com)
> **TypeScript typings:** `npm i -D @figma/plugin-typings`
> **Editor targets:** Figma Design, FigJam, Dev Mode, Figma Slides, Figma Buzz

This document is a reference, not a tutorial. Headings are searchable. Code blocks show the minimum viable shape of each API.

---

## Table of Contents

1. [Plugin file layout](#plugin-file-layout)
2. [manifest.json](#manifestjson)
3. [Plugin runtime model](#plugin-runtime-model)
4. [The `figma` global](#the-figma-global)
5. [figma.ui](#figmaui)
6. [figma.clientStorage](#figmaclientstorage)
7. [figma.variables](#figmavariables)
8. [figma.parameters and parameter-only plugins](#figmaparameters-and-parameter-only-plugins)
9. [figma.viewport](#figmaviewport)
10. [figma.notify](#figmanotify)
11. [figma.payments](#figmapayments)
12. [Events (figma.on / once / off)](#events-figmaon--once--off)
13. [figma.mixed sentinel](#figmamixed-sentinel)
14. [Scene graph: node types](#scene-graph-node-types)
15. [Node mixins](#node-mixins)
16. [Common data types](#common-data-types)
17. [Auto layout](#auto-layout)
18. [Working with text](#working-with-text)
19. [Working with images](#working-with-images)
20. [Dynamic page loading](#dynamic-page-loading)
21. [Plugin data vs shared plugin data](#plugin-data-vs-shared-plugin-data)
22. [Common operations (recipes)](#common-operations-recipes)

---

## Plugin file layout

Minimum files:

```
my-plugin/
  manifest.json     # required
  code.ts           # compiled to code.js — the "main" sandbox code
  ui.html           # optional; the iframe UI (HTML/CSS/JS in one file)
  package.json
  tsconfig.json
```

Install typings:

```bash
npm i -D @figma/plugin-typings
```

`tsconfig.json` should reference them:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "strict": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  }
}
```

The `__html__` global in the sandbox holds the contents of `ui` (single-file form). The `__uiFiles__` global holds a map when `ui` is an object.

---

## manifest.json

### Required fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name in menus. |
| `id` | string | Unique plugin identifier. Assigned by Figma on publish. |
| `api` | string | Plugin API version. Use `"1.0.0"`. |
| `main` | string | Path to compiled JS that runs in the sandbox. |
| `editorType` | `Array<'figma' \| 'figjam' \| 'dev' \| 'slides' \| 'buzz'>` | Editors the plugin targets. `'figjam'` and `'dev'` cannot be combined. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `ui` | `string \| { [key: string]: string }` | HTML file path(s) used by `figma.showUI`. Map form allows multiple UIs (e.g. one per mode). |
| `documentAccess` | `'dynamic-page'` | Enables dynamic page loading. **Recommended for all new plugins.** Disables several sync APIs; see [Dynamic page loading](#dynamic-page-loading). |
| `networkAccess` | NetworkAccess | Controls which external domains the UI iframe may contact. See below. |
| `permissions` | `PluginPermissionType[]` | One or more of `'currentuser'`, `'activeusers'`, `'fileusers'`, `'payments'`, `'teamlibrary'`. |
| `capabilities` | `Array<'textreview' \| 'codegen' \| 'inspect' \| 'vscode'>` | Declares mode-specific features. |
| `parameters` | `Parameter[]` | Quick-action parameters. See [parameter-only plugins](#figmaparameters-and-parameter-only-plugins). |
| `parameterOnly` | boolean | Default `true`. If `true`, plugin is invoked only via the parameter UI. Set `false` to also allow normal runs. |
| `menu` | `ManifestMenuItem[]` | Submenu structure (commands, separators, nested menus). |
| `relaunchButtons` | `ManifestRelaunchButton[]` | Buttons attached to nodes via `setRelaunchData()`. |
| `codegenLanguages` | `CodeLanguage[]` | Required for `capabilities: ["codegen"]`. |
| `codegenPreferences` | `CodegenPreference[]` | Custom toggles/selects shown in Dev Mode codegen panel. |
| `enableProposedApi` | boolean | Dev-only access to experimental APIs. Non-functional once published. |
| `enablePrivatePluginApi` | boolean | Enables private/org-scoped APIs. |
| `widgetApi` | string | Widget API version (widgets only). |
| `build` | string | Shell command run before loading `main`/`ui`. e.g. `"npm run build"`. |

### `networkAccess` shape

```json
"networkAccess": {
  "allowedDomains": ["https://api.example.com", "*.figma.com"],
  "reasoning": "Required to fetch icons.",
  "devAllowedDomains": ["http://localhost:3000", "ws://localhost:3000"]
}
```

Patterns:
- `["none"]` — block all external requests
- `["*"]` — any domain (requires `reasoning`)
- `["*.example.com"]` — subdomain wildcard
- `["http://x.com", "https://x.com"]` — scheme-specific
- `["example.com/api/"]` — trailing slash matches deeper paths
- `wss://`, `ws://` schemes are supported for sockets

If the plugin makes no network requests, set `"allowedDomains": ["none"]`.

### Parameter shape

```json
{
  "name": "Icon name",
  "key": "icon-name",
  "description": "Enter the icon to insert",
  "allowFreeform": true,
  "optional": false
}
```

### Menu item shapes

```json
"menu": [
  { "name": "Create text", "command": "text" },
  { "separator": true },
  { "name": "Shapes", "menu": [
    { "name": "Circle",    "command": "circle" },
    { "name": "Rectangle", "command": "rectangle" }
  ]}
]
```

### Relaunch button shape

```json
"relaunchButtons": [
  { "command": "edit", "name": "Edit shape" },
  { "command": "open", "name": "Open",       "multipleSelection": true }
]
```

Activate them from a node via `node.setRelaunchData({ edit: "Tooltip when hovering" })`.

### Codegen languages / preferences

```json
"capabilities": ["codegen"],
"codegenLanguages": [
  { "label": "Tailwind", "value": "tailwind" },
  { "label": "CSS",      "value": "css" }
],
"codegenPreferences": [
  { "itemType": "unit",   "scaledUnit": "rem", "default": true },
  { "itemType": "select", "propertyName": "indent",
    "label": "Indent", "options": [
      { "label": "2 spaces", "value": "2" },
      { "label": "4 spaces", "value": "4", "isDefault": true }
  ]},
  { "itemType": "action", "propertyName": "openDocs", "label": "Open docs" }
]
```

### Complete annotated example

```json
{
  "name": "My Plugin",
  "id": "737805260747778092",
  "api": "1.0.0",
  "editorType": ["figma", "figjam"],
  "main": "code.js",
  "ui": "ui.html",
  "documentAccess": "dynamic-page",

  "networkAccess": {
    "allowedDomains": ["https://api.example.com", "*.googleapis.com"],
    "reasoning": "Fetches design tokens.",
    "devAllowedDomains": ["http://localhost:3000"]
  },

  "permissions": ["currentuser", "teamlibrary"],
  "capabilities": [],

  "parameters": [
    { "name": "Icon name", "key": "icon-name" },
    { "name": "Size",      "key": "size", "allowFreeform": true },
    { "name": "Color",     "key": "color", "optional": true }
  ],
  "parameterOnly": false,

  "menu": [
    { "name": "Insert icon", "command": "insert" },
    { "separator": true },
    { "name": "Settings",   "command": "settings" }
  ],

  "relaunchButtons": [
    { "command": "edit", "name": "Edit icon" }
  ],

  "enableProposedApi": false,
  "build": "npm run build"
}
```

---

## Plugin runtime model

A plugin has up to two execution contexts:

### 1. The sandbox (main thread)

- File from `manifest.main` runs here.
- The only context with access to the **Figma scene graph** via the `figma` global.
- Minimal JS environment: ES2020+, `Promise`, `JSON`, `Math`, `Date`, `RegExp`, `Proxy`, `Reflect`, `structuredClone`, a minimal `console`.
- **No browser APIs**: no `fetch`, `XMLHttpRequest`, `WebSocket`, `setTimeout` (Figma provides its own timing only via `figma.timer` in FigJam), no DOM.
- Runs synchronously on Figma's main thread. Long synchronous work freezes the UI — keep work async with `await`.

### 2. The UI iframe

- File from `manifest.ui` runs here when you call `figma.showUI(__html__)`.
- Full HTML/CSS/JS, full DOM and browser APIs (`fetch`, `WebSocket`, `localStorage`, canvas, etc.).
- **No access to the `figma` global / scene graph.**
- Network requests are CSP-restricted by `manifest.networkAccess.allowedDomains`.

### Message passing

The two contexts communicate only via `postMessage`:

```js
// In code.ts (sandbox)
figma.showUI(__html__, { width: 320, height: 240 });
figma.ui.postMessage({ type: 'init', selection: figma.currentPage.selection.length });
figma.ui.onmessage = (msg) => {
  if (msg.type === 'create-rect') figma.createRectangle();
};
```

```html
<!-- In ui.html -->
<script>
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage; // <-- always under .pluginMessage
    if (msg.type === 'init') document.body.textContent = `Selected: ${msg.selection}`;
  };
  function send() {
    parent.postMessage({ pluginMessage: { type: 'create-rect' } }, '*');
  }
</script>
```

Note the **`pluginMessage`** envelope in the UI direction. The sandbox `figma.ui.postMessage(x)` unwraps to `event.data.pluginMessage` on the UI side; conversely the UI must send `{ pluginMessage: x }`.

### Lifecycle

- Plugin starts running when the user invokes a command.
- It keeps running until you call `figma.closePlugin(message?)`. Plugins without a UI typically run-then-close. Plugins with a UI stay open until closed.
- The user can cancel the plugin at any time, which terminates the sandbox.
- `figma.on('close', handler)` fires just before termination — useful for cleanup. The handler must do its work synchronously: you can *call* async APIs but the sandbox dies the moment the handler returns, so any pending promises are dropped. If you need awaitable cleanup, do it before calling `closePlugin`.

---

## The `figma` global

### Top-level properties

| Property | Type | Notes |
|---|---|---|
| `apiVersion` | readonly string | Plugin API version. |
| `command` | readonly string | The `command` from the invoked manifest menu item. |
| `editorType` | `'figma' \| 'figjam' \| 'dev' \| 'slides' \| 'buzz'` | Active editor. |
| `mode` | `'default' \| 'textreview' \| 'inspect' \| 'codegen' \| 'linkpreview' \| 'auth'` | Run mode. |
| `pluginId` | readonly string | Plugin's manifest ID. |
| `fileKey` | readonly string \| undefined | File key (private plugins only). |
| `currentPage` | `PageNode` | Currently active page. Use `setCurrentPageAsync(page)` to switch. |
| `root` | readonly `DocumentNode` | Document root; `root.children` are pages. |
| `viewport` | `ViewportAPI` | See [figma.viewport](#figmaviewport). |
| `ui` | `UIAPI` | See [figma.ui](#figmaui). |
| `clientStorage` | `ClientStorageAPI` | See [figma.clientStorage](#figmaclientstorage). |
| `variables` | `VariablesAPI` | See [figma.variables](#figmavariables). |
| `teamLibrary` | `TeamLibraryAPI` | Requires `teamlibrary` permission. |
| `parameters` | `ParametersAPI` | See [parameters](#figmaparameters-and-parameter-only-plugins). |
| `payments` | `PaymentsAPI` | Requires `payments` permission. |
| `currentUser` | `User \| null` | Requires `currentuser` permission. |
| `activeUsers` | `ActiveUser[]` | FigJam only; requires `activeusers` permission. |
| `mixed` | unique symbol | Sentinel for properties that vary across a range. |
| `hasMissingFont` | readonly boolean | True if document has any unresolved font. |
| `skipInvisibleInstanceChildren` | boolean | If true, scene-graph traversal skips invisible children inside instances. Defaults `false` outside Dev Mode, `true` in Dev Mode. Setting to `true` is the single biggest perf win when walking large component sets / icon libraries — flip it at the top of `code.ts` unless your plugin actually needs to see hidden layers. |
| `timer` | `TimerAPI` | FigJam only. |
| `codegen` | `CodegenAPI` | Dev Mode codegen mode. |
| `vscode` | `VSCodeAPI` | Dev Mode VS Code integration. |
| `annotations` | `AnnotationsAPI` | Read/write Dev Mode annotations. |
| `textreview` | `TextReviewAPI` | When `capabilities` includes `textreview`. |
| `constants` | `ConstantsAPI` | Misc constants. |
| `util` | `UtilAPI` | Convenience helpers. |

### Top-level methods (selected)

#### Lifecycle / UI

```ts
figma.showUI(html: string, options?: ShowUIOptions): void
figma.closePlugin(message?: string): void
figma.notify(message: string, options?: NotificationOptions): NotificationHandler
figma.openExternal(url: string): void
figma.commitUndo(): void
figma.triggerUndo(): void
figma.saveVersionHistoryAsync(title: string, description?: string): Promise<VersionHistoryResult>
```

`ShowUIOptions`:

```ts
{
  visible?: boolean        // default true
  width?: number           // default 300, min 70
  height?: number          // default 200
  position?: { x: number; y: number }
  title?: string
  themeColors?: boolean    // expose figma-* CSS vars
}
```

#### Events

```ts
figma.on(type: EventType, callback): void
figma.once(type: EventType, callback): void
figma.off(type: EventType, callback): void
```

See [events](#events-figmaon--once--off).

#### Lookups

```ts
figma.getNodeByIdAsync(id: string): Promise<BaseNode | null>
figma.getStyleByIdAsync(id: string): Promise<BaseStyle | null>
// Deprecated under documentAccess: 'dynamic-page':
figma.getNodeById(id: string): BaseNode | null
figma.getStyleById(id: string): BaseStyle | null
```

Page-scoped search lives on `PageNode`/`ChildrenMixin`: `findAll`, `findOne`, `findAllWithCriteria`, `findChildren`, `findChild`, and their async variants under dynamic-page mode (`findAllAsync`, `findOneAsync`).

#### Creating nodes

All return a newly created node parented to `figma.currentPage` (unless otherwise noted). Most are Figma-Design-only; FigJam-only variants noted.

```ts
figma.createRectangle(): RectangleNode
figma.createEllipse(): EllipseNode
figma.createPolygon(): PolygonNode            // defaults to triangle
figma.createStar(): StarNode
figma.createLine(): LineNode
figma.createVector(): VectorNode
figma.createText(): TextNode                  // font must be loaded before assigning .characters
figma.createTextPath(node: VectorNode, startSegment: number, startPosition: number): TextPathNode
// startSegment: integer index of the path segment to begin on.
// startPosition: 0..1 fraction along that segment. NOT (x, y) coordinates.
// Accepts VectorNode plus shape nodes (Rectangle/Ellipse/Polygon/Star/Line).
figma.createFrame(): FrameNode
figma.createAutoLayout(direction?: 'HORIZONTAL' | 'VERTICAL'): FrameNode
// Default direction is 'HORIZONTAL'. Both axes start in AUTO sizing mode, so
// children can use layoutSizingHorizontal/Vertical = 'FILL' immediately after appending.
figma.createComponent(): ComponentNode        // Figma Design only
figma.createComponentFromNode(node: SceneNode): ComponentNode
figma.createBooleanOperation(): BooleanOperationNode   // deprecated; use union/etc.
figma.createPage(): PageNode
figma.createPageDivider(dividerName?: string): PageNode
figma.createSlice(): SliceNode
figma.createSection(): SectionNode

// FigJam
figma.createSticky(): StickyNode
figma.createShapeWithText(): ShapeWithTextNode
figma.createConnector(): ConnectorNode
figma.createCodeBlock(): CodeBlockNode
figma.createTable(rows?: number, cols?: number): TableNode
figma.createLinkPreviewAsync(url: string): Promise<EmbedNode | LinkUnfurlNode>
figma.createGif(hash: string): MediaNode

// Slides
figma.createSlide(row?: number, col?: number): SlideNode
figma.createSlideRow(row?: number): SlideRowNode

// SVG / JSX
figma.createNodeFromSvg(svg: string): FrameNode
figma.createNodeFromJSXAsync(jsx: any): Promise<SceneNode>
```

#### Groups and boolean ops

```ts
figma.group(nodes, parent, index?): GroupNode
figma.ungroup(group): SceneNode[]
figma.union(nodes, parent, index?): BooleanOperationNode
figma.subtract(nodes, parent, index?): BooleanOperationNode
figma.intersect(nodes, parent, index?): BooleanOperationNode
figma.exclude(nodes, parent, index?): BooleanOperationNode
figma.flatten(nodes, parent?, index?): VectorNode
figma.combineAsVariants(components, parent, index?): ComponentSetNode
```

#### Fonts

```ts
figma.listAvailableFontsAsync(): Promise<Font[]>
figma.loadFontAsync(fontName: FontName): Promise<void>
// FontName: { family: string, style: string }
```

You **must** load a font before:
- assigning `TextNode.characters`
- changing `fontName`, `fontSize`, `lineHeight`, `letterSpacing` on a text node
- creating styled text segments

Color/stroke changes on text do not require a loaded font.

#### Images / video

```ts
figma.createImage(data: Uint8Array): Image
figma.createImageAsync(src: string): Promise<Image>
figma.getImageByHash(hash: string): Image | null
figma.createVideoAsync(data: Uint8Array): Promise<Video>
// On Image:
image.hash: string
image.getBytesAsync(): Promise<Uint8Array>
image.getSizeAsync(): Promise<{ width: number; height: number }>
```

#### Styles

```ts
figma.createPaintStyle(): PaintStyle
figma.createTextStyle(): TextStyle
figma.createEffectStyle(): EffectStyle
figma.createGridStyle(): GridStyle
figma.getLocalPaintStylesAsync(): Promise<PaintStyle[]>
figma.getLocalTextStylesAsync(): Promise<TextStyle[]>
figma.getLocalEffectStylesAsync(): Promise<EffectStyle[]>
figma.getLocalGridStylesAsync(): Promise<GridStyle[]>
// + moveLocal*StyleAfter, moveLocal*FolderAfter
```

#### Library imports

```ts
figma.importComponentByKeyAsync(key: string): Promise<ComponentNode>
figma.importComponentSetByKeyAsync(key: string): Promise<ComponentSetNode>
figma.importStyleByKeyAsync(key: string): Promise<BaseStyle>
figma.importVariableByKeyAsync(key: string): Promise<Variable>
```

#### Document-level

```ts
figma.loadAllPagesAsync(): Promise<void>     // required under dynamic-page mode before iterating all pages
figma.setCurrentPageAsync(page: PageNode): Promise<void>
figma.getSelectionColors(): { paints: Paint[]; styles: PaintStyle[] } | null
figma.getFileThumbnailNodeAsync(): Promise<FrameNode | ComponentNode | ComponentSetNode | SectionNode | null>
figma.setFileThumbnailNodeAsync(node): Promise<void>
```

#### Encoding helpers

```ts
figma.base64Encode(data: Uint8Array): string
figma.base64Decode(data: string): Uint8Array
```

---

## figma.ui

### Methods

```ts
figma.ui.show(): void
figma.ui.hide(): void
figma.ui.close(): void            // destroys iframe; sandbox keeps running
figma.ui.resize(w: number, h: number): void   // minimum 70x0
figma.ui.reposition(x: number, y: number): void
figma.ui.getPosition(): { windowSpace: Vector; canvasSpace: Vector }
figma.ui.postMessage(msg: any, options?: UIPostMessageOptions): void
figma.ui.on('message', cb): void
figma.ui.once('message', cb): void
figma.ui.off('message', cb): void
figma.ui.onmessage: MessageEventHandler | undefined  // assignable shortcut
```

### Sandbox → UI

```ts
figma.ui.postMessage({ type: 'hello', count: 3 });
// In UI:
window.onmessage = e => console.log(e.data.pluginMessage); // { type, count }
```

### UI → Sandbox

```ts
// In UI:
parent.postMessage({ pluginMessage: { type: 'go' } }, '*');
// In sandbox:
figma.ui.onmessage = msg => console.log(msg.type); // 'go'
```

### Targeted UIs (multiple HTML files)

```json
"ui": { "default": "ui.html", "codegen": "codegen.html" }
```

```ts
figma.showUI(__uiFiles__.default);
```

### Theme support

`figma.showUI(__html__, { themeColors: true })` exposes `figma-color-bg`, `figma-color-text`, etc. as CSS variables on the iframe `<body>`.

---

## figma.clientStorage

Per-plugin, per-user persistent storage. Asynchronous. 5 MB total quota (key + JSON value size; `Uint8Array` counted by byte length).

Supports: objects, arrays, strings, numbers, booleans, `null`, `undefined`, `Uint8Array`.

```ts
figma.clientStorage.getAsync(key: string): Promise<any | undefined>
figma.clientStorage.setAsync(key: string, value: any): Promise<void>
figma.clientStorage.deleteAsync(key: string): Promise<void>
figma.clientStorage.keysAsync(): Promise<string[]>
```

```ts
await figma.clientStorage.setAsync('settings', { theme: 'dark' });
const settings = await figma.clientStorage.getAsync('settings');
const allKeys = await figma.clientStorage.keysAsync();
await figma.clientStorage.deleteAsync('settings');
```

---

## figma.variables

```ts
// Creation
figma.variables.createVariableCollection(name: string): VariableCollection
figma.variables.createVariable(
  name: string,
  collection: VariableCollection,
  resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR'
): Variable

// Aliases
figma.variables.createVariableAlias(variable: Variable): VariableAlias
figma.variables.createVariableAliasByIdAsync(id: string): Promise<VariableAlias>

// Lookups (prefer async; sync variants throw under documentAccess: 'dynamic-page')
figma.variables.getVariableByIdAsync(id: string): Promise<Variable | null>
figma.variables.getVariableCollectionByIdAsync(id: string): Promise<VariableCollection | null>
figma.variables.getLocalVariablesAsync(type?): Promise<Variable[]>
figma.variables.getLocalVariableCollectionsAsync(): Promise<VariableCollection[]>

// Library
figma.variables.importVariableByKeyAsync(key: string): Promise<Variable>
figma.variables.extendLibraryCollectionByKeyAsync(key: string, name: string): Promise<VariableCollection>

// Binding helpers — return a new Paint/Effect/Grid with bindings applied
figma.variables.setBoundVariableForPaint(paint, field, variable | null): Paint
figma.variables.setBoundVariableForEffect(effect, field, variable | null): Effect
figma.variables.setBoundVariableForLayoutGrid(grid, field, variable | null): LayoutGrid
```

### VariableCollection

| Property | Type | |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `modes` | `{ modeId: string; name: string }[]` | |
| `defaultModeId` | string | |
| `variableIds` | string[] | |
| `remote` | boolean | |
| `key` | string | |
| `hiddenFromPublishing` | boolean | |

Methods: `addMode(name)`, `renameMode(modeId, name)`, `removeMode(modeId)`, `remove()`.

### Variable

| Property | Type | |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `description` | string | |
| `key` | string | |
| `variableCollectionId` | string | |
| `resolvedType` | `'BOOLEAN' \| 'FLOAT' \| 'STRING' \| 'COLOR'` | |
| `valuesByMode` | `{ [modeId: string]: VariableValue }` | |
| `remote` | boolean | |
| `scopes` | `VariableScope[]` | Properties this variable can bind to. |
| `codeSyntax` | `{ WEB?, ANDROID?, iOS? }` | |
| `hiddenFromPublishing` | boolean | |

Methods: `setValueForMode(modeId, value)`, `setVariableCodeSyntax(platform, value)`, `removeVariableCodeSyntax(platform)`, `remove()`.

### Binding a variable to a node

For top-level fields with a setter:

```ts
frame.setBoundVariable('itemSpacing', spacingVar);
frame.setBoundVariable('width', widthVar);
text.setRangeBoundVariable(0, 5, 'fontFamily', familyVar);
```

For paints/effects (which are immutable, so produce a new value):

```ts
const fill = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } } as SolidPaint;
const bound = figma.variables.setBoundVariableForPaint(fill, 'color', colorVar);
rect.fills = [bound];
```

### Bindable fields on TextNode (typography variables)

`fontFamily`, `fontStyle`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`, `paragraphSpacing`, `paragraphIndent` — apply with `setRangeBoundVariable(start, end, field, variable)` or `setBoundVariable(field, variable)` for whole-node.

---

## figma.parameters and parameter-only plugins

When `manifest.parameters` is set, the user fills parameters via the quick-action UI before the plugin runs.

### `figma.parameters.on('input', handler)`

Fires on each keystroke. Provide suggestions or errors:

```ts
figma.parameters.on('input', ({ key, query, result }: ParameterInputEvent) => {
  if (key === 'icon-name') {
    result.setSuggestions(['arrow', 'check', 'close']
      .filter(s => s.startsWith(query)));
  }
});
```

`result` (`SuggestionResults`):

```ts
result.setSuggestions(items: Array<string | { name: string; data?: any; icon?: string; iconUrl?: string }>)
result.setError(message: string)
result.setLoadingMessage(message: string)
```

### The `'run'` event with parameters

```ts
figma.on('run', ({ command, parameters }: RunEvent) => {
  if (parameters) {
    const icon = parameters['icon-name'];
    // …
  }
  figma.closePlugin();
});
```

`parameterOnly: false` lets the plugin also run without parameters (`parameters` will be undefined).

---

## figma.viewport

```ts
figma.viewport.center: Vector
figma.viewport.zoom: number     // 1.0 = 100%
figma.viewport.bounds: Rect     // read-only
figma.viewport.scrollAndZoomIntoView(nodes: ReadonlyArray<BaseNode>): void

// Slides only:
figma.viewport.slidesView: 'grid' | 'single-slide'
// Slides / Buzz:
figma.viewport.canvasView: 'grid' | 'single-asset'
```

---

## figma.notify

```ts
figma.notify(message: string, options?: NotificationOptions): NotificationHandler
```

`NotificationOptions`:

```ts
{
  timeout?: number     // ms; default 3000; set Infinity to persist
  error?: boolean      // styles as error
  onDequeue?: (reason: 'dismiss' | 'action_button_click' | 'timeout') => void
  button?: { text: string; action: () => boolean | void }
  // action is SYNCHRONOUS. Return false to keep the toast open; any other
  // return (true / void) dismisses it. Promises are not awaited.
}
```

`NotificationHandler`:

```ts
{ cancel(): void }
```

---

## figma.payments

Requires `"permissions": ["payments"]`.

```ts
figma.payments.status: { type: 'UNPAID' | 'PAID' | 'NOT_SUPPORTED' }
figma.payments.initiateCheckoutAsync(options?: {
  interstitial?: 'PAID_FEATURE' | 'TRIAL_ENDED' | 'SKIP'
}): Promise<void>
figma.payments.getUserFirstRanSecondsAgo(): number
figma.payments.getPluginPaymentTokenAsync(): Promise<string>
figma.payments.requestCheckout(): void          // text-review query mode
figma.payments.setPaymentStatusInDevelopment(status): void
```

---

## Events (figma.on / once / off)

```ts
figma.on(type, callback): void
figma.once(type, callback): void
figma.off(type, callback): void
```

### Universal events

| Type | Payload | Notes |
|---|---|---|
| `'selectionchange'` | none | Fires when `figma.currentPage.selection` changes. |
| `'currentpagechange'` | none | User switched pages. |
| `'documentchange'` | `DocumentChangeEvent` | Granular list of node/property changes. Requires `documentAccess: 'dynamic-page'` for newer behavior. |
| `'close'` | none | Plugin is about to close. Sync only; no awaits. |
| `'run'` | `RunEvent` (`{ command, parameters?, propertyValues? }`) | Fires once when the plugin starts. Useful with parameter-only or codegen plugins. |
| `'drop'` | `DropEvent` | UI drag-out drop landed in canvas. |
| `'stylechange'` | `StyleChangeEvent` | Local style created/modified/removed. |
| `'slidesviewchange'` | none | Slides view changed (grid ↔ single). |

### Mode-specific events

| Type | When | Notes |
|---|---|---|
| `'textreview'` | Text review mode: review request from Figma. | Requires `capabilities: ["textreview"]`. |
| `'linkpreview'` | Dev Mode: Figma needs a preview rendered for an attached dev-resource URL the plugin owns. | Register at the top level of `code.ts`. See [dev-mode-and-codegen.md](dev-mode-and-codegen.md) §9. |
| `'opendevresource'` | Dev Mode: user clicked through a dev-resource URL the plugin owns. | Use to open the resource in your IDE / browser. |
| `'canvasviewchange'` | Slides / Buzz: user toggled between grid view and single-asset view. | Pairs with `figma.viewport.canvasView`. |
| `'slidesviewchange'` | Slides: user toggled between grid view and single-slide view. | Pairs with `figma.viewport.slidesView`. |

Codegen has its own emitter — `figma.codegen.on('generate', …)` and `figma.codegen.on('preferenceschange', …)` — not `figma.on`. See [dev-mode-and-codegen.md](dev-mode-and-codegen.md) §3–4.

### FigJam timer (`figma.timer`)

| Type | Payload |
|---|---|
| `'timerstart'` | none |
| `'timerpause'` | none |
| `'timerresume'` | none |
| `'timerstop'` | none |
| `'timeradjust'` | none |
| `'timerdone'` | none |

### `DropEvent` payload

```ts
{
  node: BaseNode | SceneNode      // the node the drop landed on
  x: number; y: number             // canvas coords
  absoluteX: number; absoluteY: number
  items: DropItem[]                // mime data
  files: DropFile[]                // file blobs
  dropMetadata?: any               // metadata passed in postMessage
}
```

### `DocumentChangeEvent` payload (high-level shape)

```ts
{
  documentChanges: Array<
    | CreateChange | DeleteChange | PropertyChange
    | StyleCreateChange | StyleDeleteChange | StylePropertyChange
  >
}
```

Each `PropertyChange` carries `{ node, properties: string[] }` so the plugin knows which fields changed.

---

## figma.mixed sentinel

`figma.mixed` is a unique symbol returned for properties whose value differs across the range/children.

```ts
const fontSize = textNode.fontSize;
if (fontSize === figma.mixed) {
  // characters in the text node have different sizes
  const segments = textNode.getStyledTextSegments(['fontSize']);
} else {
  // uniform value
}
```

Occurs on text properties, instance overrides, multi-character props, and on selection-summary fields where the user has multi-selected nodes with different values.

---

## Scene graph: node types

Every node has at minimum `id`, `type`, `name`, `parent`, `removed`, and `remove()`.

### Container nodes

| Class | `type` | Editor | Key extras |
|---|---|---|---|
| `DocumentNode` | `"DOCUMENT"` | All | `children: PageNode[]`, `appendChild`, `findOne/All`, `loadFontAsync` is on figma not document. |
| `PageNode` | `"PAGE"` | All | `selection`, `selectedTextRange`, `backgrounds`, `prototypeStartNode`, `flowStartingPoints`, `guides`, `findAll/One`, `loadAsync()` (dynamic-page). |
| `FrameNode` | `"FRAME"` | All | Layout, auto layout, prototyping, clipsContent, fills, strokes, effects, grids. |
| `GroupNode` | `"GROUP"` | All | Pure container; bounding box auto-fits children. No fills/strokes. |
| `SectionNode` | `"SECTION"` | All | Holds frames/components for organization; can be devStatus-tagged. |

### Component nodes

| Class | `type` | Notes |
|---|---|---|
| `ComponentNode` | `"COMPONENT"` | Master component; `key`, `description`, `documentationLinks`, `instances`, `createInstance()`. |
| `ComponentSetNode` | `"COMPONENT_SET"` | Variant container; `defaultVariant`, `variantGroupProperties`. |
| `InstanceNode` | `"INSTANCE"` | `mainComponent`, `setProperties()`, `componentProperties`, `swapComponent(component)`, `detachInstance()`, `getMainComponentAsync()`, `resetOverrides()`. |

### Shapes

| Class | `type` | Notes |
|---|---|---|
| `RectangleNode` | `"RECTANGLE"` | Corner radii (uniform + per-corner). |
| `EllipseNode` | `"ELLIPSE"` | `arcData: { startingAngle, endingAngle, innerRadius }`. |
| `PolygonNode` | `"POLYGON"` | `pointCount`. |
| `StarNode` | `"STAR"` | `pointCount`, `innerRadius`. |
| `LineNode` | `"LINE"` | No fills; strokes only. |
| `VectorNode` | `"VECTOR"` | `vectorNetwork` / `vectorPaths`, `handleMirroring`. |
| `BooleanOperationNode` | `"BOOLEAN_OPERATION"` | `booleanOperation: 'UNION' \| 'INTERSECT' \| 'SUBTRACT' \| 'EXCLUDE'`. |

### Text

| Class | `type` | Notes |
|---|---|---|
| `TextNode` | `"TEXT"` | `characters`, `fontName`, `fontSize`, `textAutoResize`, `textTruncation`, `getStyledTextSegments`, `getRange*`/`setRange*`, `hyperlink`. |
| `TextPathNode` | `"TEXT_PATH"` | Text following a vector path. |

### FigJam-only

| Class | `type` | Notes |
|---|---|---|
| `StickyNode` | `"STICKY"` | `text` (TextSublayer), `authorVisible`, `authorName`. |
| `ConnectorNode` | `"CONNECTOR"` | `connectorStart`, `connectorEnd`, `connectorLineType`, `text` sublayer. |
| `ShapeWithTextNode` | `"SHAPE_WITH_TEXT"` | `shapeType`, embedded `text`. |
| `CodeBlockNode` | `"CODE_BLOCK"` | `code`, `codeLanguage`. |
| `StampNode` | `"STAMP"` | `getAuthorAsync()` (with `fileusers` perm). |
| `TableNode` | `"TABLE"` | `numRows`, `numColumns`, `cellAt(r,c)`, `insertRow`, `insertColumn`. |
| `TableCellNode` | `"TABLE_CELL"` | `rowIndex`, `columnIndex`, `text`, `fills`. |
| `HighlightNode` | `"HIGHLIGHT"` | Highlighter strokes. |
| `WashiTapeNode` | `"WASHI_TAPE"` | Decorative tape. |

### Embeds / media

| Class | `type` | Notes |
|---|---|---|
| `EmbedNode` | `"EMBED"` | Embedded link content. |
| `LinkUnfurlNode` | `"LINK_UNFURL"` | Auto-unfurled link preview. |
| `MediaNode` | `"MEDIA"` | Video/GIF media. |
| `SliceNode` | `"SLICE"` | Export region only. |
| `WidgetNode` | `"WIDGET"` | Widget instance; `widgetSyncedState`, `setWidgetSyncedState`. |

### Slides

| Class | `type` | |
|---|---|---|
| `SlideNode` | `"SLIDE"` | A presentation slide. |
| `SlideRowNode` | `"SLIDE_ROW"` | Row in slide grid. |
| `SlideGridNode` | `"SLIDE_GRID"` | Grid container. |
| `InteractiveSlideElementNode` | `"INTERACTIVE_SLIDE_ELEMENT"` | Embedded interactive. |

### Utility

| Class | `type` | |
|---|---|---|
| `TransformGroupNode` | `"TRANSFORM_GROUP"` | Wraps nodes for collective transform. |
| `SlotNode` | `"SLOT"` | Component slot. |

---

## Node mixins

Mixins are implemented as TypeScript interfaces in `@figma/plugin-typings`. A given node type composes several.

### `BaseNodeMixin`

Implemented by **every** node.

```ts
id: string                                  // readonly
parent: (BaseNode & ChildrenMixin) | null
name: string
removed: boolean                            // true after remove()
isAsset: boolean

remove(): void
toString(): string
clone(): this                               // for SceneNode subclasses
getPluginData(key: string): string
setPluginData(key: string, value: string): void
getPluginDataKeys(): string[]
getSharedPluginData(namespace: string, key: string): string
setSharedPluginData(namespace: string, key: string, value: string): void
getSharedPluginDataKeys(namespace: string): string[]
setRelaunchData(data: { [command: string]: string }): void
getRelaunchData(): { [command: string]: string }
getDevResourcesAsync(options?): Promise<DevResource[]>
addDevResourceAsync(url: string, name?: string): Promise<void>
editDevResourceAsync(currentUrl, newValue): Promise<void>
deleteDevResourceAsync(url: string): Promise<void>
setDevResourcePreviewAsync(url, preview): Promise<void>
```

### `SceneNodeMixin`

Implemented by all scene (non-document, non-page) nodes.

```ts
visible: boolean
locked: boolean
stuckNodes: SceneNode[]                     // FigJam
attachedConnectors: ConnectorNode[]         // FigJam
componentPropertyReferences: { [property: string]: string } | null
boundVariables?: { [field: string]: VariableAlias | VariableAlias[] }
resolvedVariableModes: { [collectionId: string]: string }
setExplicitVariableModeForCollection(collection, modeId): void
clearExplicitVariableModeForCollection(collection): void
inferredVariables: { [field: string]: VariableAlias[] }
```

### `ChildrenMixin`

Frames, components, instances, groups, pages, sections, document.

```ts
children: ReadonlyArray<SceneNode>
appendChild(child: SceneNode): void
insertChild(index: number, child: SceneNode): void
findChildren(callback?: (node) => boolean): SceneNode[]
findChild(callback: (node) => boolean): SceneNode | null
findAll(callback?: (node) => boolean): SceneNode[]
findOne(callback: (node) => boolean): SceneNode | null
findAllWithCriteria<T extends NodeType[]>(criteria: { types: T }): Array<…>

// Under documentAccess: 'dynamic-page' — async equivalents:
findAllAsync, findOneAsync, findAllWithCriteriaAsync
findWidgetNodesByWidgetIdAsync(widgetId: string)
```

### `LayoutMixin`

Position, size, rotation, constraints, layout participation.

```ts
absoluteTransform: Transform                          // readonly
relativeTransform: Transform
x: number
y: number
rotation: number                                       // degrees
width: number                                          // readonly except via resize
height: number
constrainProportions: boolean
absoluteBoundingBox: Rect | null
absoluteRenderBounds: Rect | null
resize(w: number, h: number): void
resizeWithoutConstraints(w: number, h: number): void
rescale(scale: number): void

// Inside an auto-layout parent:
layoutAlign: 'STRETCH' | 'INHERIT' | 'MIN' | 'CENTER' | 'MAX'
layoutGrow: 0 | 1
layoutPositioning: 'AUTO' | 'ABSOLUTE'
layoutSizingHorizontal: 'FIXED' | 'HUG' | 'FILL'
layoutSizingVertical: 'FIXED' | 'HUG' | 'FILL'
minWidth: number | null
maxWidth: number | null
minHeight: number | null
maxHeight: number | null
targetAspectRatio: { width: number; height: number } | null
```

### `AutoLayoutMixin` (on frames, components, instances)

```ts
layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID'
layoutWrap: 'NO_WRAP' | 'WRAP'
primaryAxisSizingMode: 'FIXED' | 'AUTO'
counterAxisSizingMode: 'FIXED' | 'AUTO'
primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
counterAxisAlignContent: 'AUTO' | 'SPACE_BETWEEN'
itemSpacing: number
counterAxisSpacing: number | null
paddingLeft: number
paddingRight: number
paddingTop: number
paddingBottom: number
horizontalPadding: number          // deprecated
verticalPadding: number            // deprecated
itemReverseZIndex: boolean
strokesIncludedInLayout: boolean
inferredAutoLayout?: InferredAutoLayoutResult | null
```

Grid auto-layout (when `layoutMode === 'GRID'`): `gridRowsSizing`, `gridColumnsSizing`, `gridRowGap`, `gridColumnGap`, plus per-child `gridRowAnchorIndex`, `gridColumnAnchorIndex`, `gridRowSpan`, `gridColumnSpan`, `gridChildHorizontalAlign`, `gridChildVerticalAlign`.

### `ConstraintMixin`

```ts
constraints: { horizontal: ConstraintType; vertical: ConstraintType }
// ConstraintType = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
```

### `BlendMixin`

```ts
opacity: number                  // 0–1
blendMode: BlendMode             // 'NORMAL', 'MULTIPLY', etc.
isMask: boolean
maskType: 'ALPHA' | 'VECTOR' | 'LUMINANCE'
effects: ReadonlyArray<Effect>
effectStyleId: string
setEffectStyleIdAsync(id: string): Promise<void>
```

### `GeometryMixin` (shapes, text, frames)

```ts
fills: ReadonlyArray<Paint> | PluginAPI['mixed']
strokes: ReadonlyArray<Paint>
strokeWeight: number | PluginAPI['mixed']
strokeJoin: StrokeJoin | PluginAPI['mixed']
strokeAlign: 'CENTER' | 'INSIDE' | 'OUTSIDE'
strokeCap: StrokeCap | PluginAPI['mixed']
strokeMiterLimit: number
dashPattern: ReadonlyArray<number>
fillStyleId: string | PluginAPI['mixed']
strokeStyleId: string
fillGeometry: VectorPaths
strokeGeometry: VectorPaths
setFillStyleIdAsync(id): Promise<void>
setStrokeStyleIdAsync(id): Promise<void>
outlineStroke(): VectorNode | null
```

### `IndividualStrokesMixin`

```ts
strokeTopWeight: number
strokeRightWeight: number
strokeBottomWeight: number
strokeLeftWeight: number
```

### `CornerMixin`

```ts
cornerRadius: number | PluginAPI['mixed']
cornerSmoothing: number
```

### `RectangleCornerMixin`

```ts
topLeftRadius: number
topRightRadius: number
bottomLeftRadius: number
bottomRightRadius: number
```

### `ExportMixin`

```ts
exportSettings: ReadonlyArray<ExportSettings>
exportAsync(settings?: ExportSettings): Promise<Uint8Array>
exportAsync(settings: ExportSettings & { format: 'SVG_STRING' }): Promise<string>
exportAsync(settings: ExportSettings & { format: 'JSON_REST_V1' }): Promise<{ document: any }>
```

### `ReactionMixin`

```ts
reactions: ReadonlyArray<Reaction>
setReactionsAsync(reactions: ReadonlyArray<Reaction>): Promise<void>
```

### `FramePrototypingMixin`

```ts
overflowDirection: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'BOTH'
numberOfFixedChildren: number
overlayPositionType: OverlayPositionType
overlayBackground: OverlayBackground
overlayBackgroundInteraction: OverlayBackgroundInteraction
```

### `DocumentationLinksMixin`

```ts
documentationLinks: ReadonlyArray<DocumentationLink>
```

### `MinimalFillsMixin` / `MinimalStrokesMixin`

Smaller subsets of geometry for nodes that don't carry full geometry properties.

### `AspectRatioLockMixin`

```ts
targetAspectRatio: { width: number; height: number } | null
lockAspectRatio(): void
unlockAspectRatio(): void
```

### `DimensionAndPositionMixin`

Subset of `LayoutMixin` with just x, y, width, height — used by sticky/connector-like nodes that don't rotate or scale.

### `ContainerMixin`

Some legacy aliases — appears on FrameNode/Page; equivalent to `ChildrenMixin` plus background fills.

---

## Common data types

### `Paint`

A discriminated union: `SolidPaint`, `GradientPaint`, `ImagePaint`, `PatternPaint`, `VideoPaint`.

```ts
type SolidPaint = {
  type: 'SOLID'
  color: RGB                            // { r, g, b } each 0–1
  opacity?: number
  visible?: boolean
  blendMode?: BlendMode
  boundVariables?: { color?: VariableAlias }
}

type GradientPaint = {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'
  gradientTransform: Transform
  gradientStops: ReadonlyArray<ColorStop>
  opacity?: number; visible?: boolean; blendMode?: BlendMode
}

type ImagePaint = {
  type: 'IMAGE'
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE'
  imageHash: string | null
  scalingFactor?: number
  rotation?: number
  imageTransform?: Transform           // for CROP
  filters?: ImageFilters
  opacity?: number; visible?: boolean; blendMode?: BlendMode
}
```

### `Effect`

```ts
type Effect =
  | DropShadowEffect
  | InnerShadowEffect
  | BlurEffect            // type: 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  | NoiseEffect           // type: 'NOISE'
  | TextureEffect         // type: 'TEXTURE'

type DropShadowEffect = {
  type: 'DROP_SHADOW'
  color: RGBA
  offset: Vector
  radius: number
  spread?: number
  visible: boolean
  blendMode: BlendMode
  showShadowBehindNode?: boolean
}
```

### `Transform` / `Vector` / `Rect`

```ts
type Transform = [[number, number, number], [number, number, number]]
type Vector    = { x: number; y: number }
type Rect      = { x: number; y: number; width: number; height: number }
type RGB       = { r: number; g: number; b: number }
type RGBA      = { r: number; g: number; b: number; a: number }
```

### `FontName`

```ts
type FontName = { family: string; style: string }
// e.g. { family: 'Inter', style: 'Regular' }
```

### `ExportSettings`

```ts
type ExportSettingsImage = {
  format: 'PNG' | 'JPG'
  contentsOnly?: boolean
  useAbsoluteBounds?: boolean
  suffix?: string
  constraint?: { type: 'SCALE' | 'WIDTH' | 'HEIGHT'; value: number }
}
type ExportSettingsSVG = {
  format: 'SVG' | 'SVG_STRING'
  contentsOnly?: boolean
  svgOutlineText?: boolean
  svgIdAttribute?: boolean
  svgSimplifyStroke?: boolean
}
type ExportSettingsPDF = { format: 'PDF'; contentsOnly?: boolean }
type ExportSettingsREST = { format: 'JSON_REST_V1' }
```

---

## Auto layout

```ts
const frame = figma.createFrame();
frame.layoutMode = 'VERTICAL';
frame.layoutSizingHorizontal = 'HUG';
frame.layoutSizingVertical = 'HUG';
frame.primaryAxisAlignItems = 'CENTER';
frame.counterAxisAlignItems = 'CENTER';
frame.itemSpacing = 12;
frame.paddingLeft = frame.paddingRight = 16;
frame.paddingTop = frame.paddingBottom = 16;
```

Or shorthand:

```ts
const f = figma.createAutoLayout('VERTICAL');
```

**Child sizing axes** are independent: `layoutSizingHorizontal`/`layoutSizingVertical` take `'FIXED' | 'HUG' | 'FILL'`. `'FILL'` only applies along the parent's primary or counter axis where it makes sense.

**Absolute-positioned children** inside auto layout: set `child.layoutPositioning = 'ABSOLUTE'` — they then behave like in a regular frame.

**Grid mode** (`layoutMode: 'GRID'`): use `gridRowsSizing`/`gridColumnsSizing` strings (e.g. `"1fr 1fr auto"`) and the child anchor/span props.

**Wrap**: `layoutWrap: 'WRAP'` on horizontal containers; `counterAxisSpacing` controls inter-row gap when wrapping.

---

## Working with text

```ts
const t = figma.createText();
await figma.loadFontAsync(t.fontName as FontName); // default font: Inter Regular
t.characters = 'Hello';
t.fontSize = 24;
```

**Mixed styling** — if the user has applied multiple fonts/sizes to one node, the bulk getter returns `figma.mixed`. Use range accessors:

```ts
const allFonts = t.getRangeAllFontNames(0, t.characters.length);
await Promise.all(allFonts.map(f => figma.loadFontAsync(f)));
t.setRangeFontName(0, 5, { family: 'Inter', style: 'Bold' });
```

**Styled segments** — convenient grouping by style runs:

```ts
const segments = t.getStyledTextSegments(['fontName', 'fontSize', 'fills']);
// [{ start, end, characters, fontName, fontSize, fills }, …]
```

Range setters available:

```
setRangeFontName, setRangeFontSize, setRangeFontWeight,
setRangeLineHeight, setRangeLetterSpacing,
setRangeTextDecoration, setRangeTextCase, setRangeFills,
setRangeFillStyleId, setRangeTextStyleId,
setRangeHyperlink, setRangeListOptions, setRangeIndentation,
setRangeListSpacing, setRangeParagraphSpacing,
setRangeParagraphIndent, setRangeBoundVariable
```

Top-level text props: `textAlignHorizontal` (`'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'`), `textAlignVertical` (`'TOP' | 'CENTER' | 'BOTTOM'`), `textAutoResize` (`'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE'`), `textTruncation`, `maxLines`, `paragraphSpacing`, `paragraphIndent`, `leadingTrim`.

Check `figma.hasMissingFont` before bulk text edits.

---

## Working with images

**From bytes:**

```ts
const image = figma.createImage(uint8Array);
const rect = figma.createRectangle();
rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
```

**From URL** (CORS-compliant, ≤ 4096×4096, PNG/JPG/GIF):

```ts
const image = await figma.createImageAsync('https://…/icon.png');
```

**Read bytes back:**

```ts
const fill = (node.fills as Paint[]).find(p => p.type === 'IMAGE') as ImagePaint;
const image = figma.getImageByHash(fill.imageHash!);
const bytes = await image!.getBytesAsync();
const { width, height } = await image!.getSizeAsync();
```

For pixel-level edits, decode in the UI iframe (which has `canvas`), re-encode, and pass the bytes back to the sandbox.

---

## Dynamic page loading

Set `"documentAccess": "dynamic-page"` in the manifest. This is the recommended default — without it, Figma must fully load every page on plugin launch, producing a "Loading n pages…" UI for large files.

Effects:

- `figma.root.children` is available, but pages other than `currentPage` are **not** preloaded.
- Before iterating any other page, call `await page.loadAsync()` or, to load everything, `await figma.loadAllPagesAsync()`.
- Synchronous lookup APIs **throw** unless used on already-loaded data:
  - Use `figma.getNodeByIdAsync`, `figma.getStyleByIdAsync`, `figma.variables.getVariableByIdAsync`, etc.
  - Use `findAllAsync`/`findOneAsync` on children of pages you have not loaded.
- `setCurrentPageAsync` is required to switch pages (the sync `figma.currentPage = page` is disallowed).
- `documentchange` events still fire but for unloaded pages may be missing detail.

```ts
const page = figma.root.children.find(p => p.name === 'Components');
if (page) {
  await page.loadAsync();
  const buttons = await page.findAllAsync(n => n.name === 'Button');
}
```

---

## Plugin data vs shared plugin data

Both store strings on nodes. The difference is **namespacing and accessibility**:

| API | Scope | Visible to |
|---|---|---|
| `getPluginData(key)` / `setPluginData(key, value)` | Per-plugin (your plugin only) | Only your plugin (and Figma's REST API for that plugin id). |
| `getSharedPluginData(namespace, key)` / `setSharedPluginData(namespace, key, value)` | Per-namespace (any plugin that knows the namespace) | Any plugin or REST API request that supplies the namespace. |

Use plugin data for private state. Use shared plugin data for interop (e.g. design-tokens namespace shared across tooling).

```ts
node.setPluginData('lastEdited', String(Date.now()));
const v = node.getPluginData('lastEdited');     // '' if unset

node.setSharedPluginData('tokens', 'role', 'primary');
const r = node.getSharedPluginData('tokens', 'role');

const keys = node.getPluginDataKeys();
const sharedKeys = node.getSharedPluginDataKeys('tokens');
```

Set value to `''` to delete.

Storage is part of the document — it travels with the file, not the user.

**Size limit**: 100 kB **per entry**, where an entry is the combined size of `pluginId + key + value`. This is a per-key limit, not a per-node limit — a single node can hold many keys, each up to ~100 kB. Large blobs still slow saves; keep individual entries small and split if needed.

---

## Common operations (recipes)

### Iterate the current selection

```ts
for (const node of figma.currentPage.selection) {
  console.log(node.id, node.type, node.name);
}
```

### Walk the entire scene graph on the current page

```ts
function walk(node: BaseNode, visit: (n: BaseNode) => void) {
  visit(node);
  if ('children' in node) for (const c of node.children) walk(c, visit);
}
walk(figma.currentPage, n => console.log(n.type, n.name));
```

For large docs use `findAll` (page-local) or `findAllWithCriteria({ types: ['TEXT'] })` for type-filtered traversal.

### Walk every page (dynamic-page safe)

```ts
await figma.loadAllPagesAsync();
for (const page of figma.root.children) {
  for (const n of page.findAll(() => true)) { /* … */ }
}
```

### Create a frame with auto layout

```ts
const card = figma.createFrame();
card.name = 'Card';
card.layoutMode = 'VERTICAL';
card.itemSpacing = 8;
card.paddingTop = card.paddingBottom = 12;
card.paddingLeft = card.paddingRight = 16;
card.primaryAxisSizingMode = 'AUTO';
card.counterAxisSizingMode = 'AUTO';
card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
card.cornerRadius = 8;
figma.currentPage.appendChild(card);
```

### Create text with a loaded font

```ts
const font = { family: 'Inter', style: 'Bold' };
await figma.loadFontAsync(font);
const t = figma.createText();
t.fontName = font;
t.fontSize = 16;
t.characters = 'Hello';
t.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
```

### Move / clone / reparent

```ts
const copy = node.clone();             // sibling clone
copy.x = node.x + node.width + 24;

newParent.appendChild(node);           // reparent (preserves world transform if possible)
newParent.insertChild(0, node);        // place at top of children
```

### Solid fill

```ts
rect.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.27, b: 0.27 } }];
```

### Linear gradient fill

```ts
rect.fills = [{
  type: 'GRADIENT_LINEAR',
  gradientTransform: [[1, 0, 0], [0, 1, 0]],
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ]
}];
```

### Stroke with weight + dash

```ts
rect.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
rect.strokeWeight = 2;
rect.strokeAlign = 'INSIDE';
rect.dashPattern = [4, 4];
```

### Drop shadow

```ts
frame.effects = [{
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.12 },
  offset: { x: 0, y: 4 },
  radius: 8,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL'
}];
```

### Mutating `fills` correctly

Paint arrays are immutable; you must reassign:

```ts
const next = (rect.fills as Paint[]).slice();
next[0] = { ...next[0], opacity: 0.5 } as SolidPaint;
rect.fills = next;
```

`structuredClone` works in the sandbox and is a one-call alternative if you want a deep copy (e.g. when paints contain nested gradient stops or image transforms you also need to edit):

```ts
const next = structuredClone(rect.fills) as Paint[];
(next[0] as SolidPaint).opacity = 0.5;
rect.fills = next;
```

### Create a variable and bind it to a fill

```ts
const collection = figma.variables.createVariableCollection('Colors');
const v = figma.variables.createVariable('primary', collection, 'COLOR');
v.setValueForMode(collection.defaultModeId, { r: 0.06, g: 0.46, b: 0.96 });

const fill: SolidPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
const bound = figma.variables.setBoundVariableForPaint(fill, 'color', v);
rect.fills = [bound];
```

### Add a mode and assign per-mode values

```ts
collection.addMode('Dark');
const darkMode = collection.modes.find(m => m.name === 'Dark')!.modeId;
v.setValueForMode(darkMode, { r: 0.2, g: 0.4, b: 1 });
frame.setExplicitVariableModeForCollection(collection, darkMode);
```

### Export node as PNG

```ts
const bytes = await node.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 }
});
figma.ui.postMessage({ type: 'png', bytes }, { transferables: [bytes.buffer] });
```

### Export node as SVG string

```ts
const svg = await node.exportAsync({ format: 'SVG_STRING' });
```

### Read selection from UI button

```ts
// code.ts
figma.showUI(__html__);
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-selection') {
    figma.ui.postMessage({
      type: 'selection',
      ids: figma.currentPage.selection.map(n => n.id)
    });
  }
};
```

```html
<!-- ui.html -->
<button onclick="parent.postMessage({pluginMessage:{type:'get-selection'}},'*')">
  Get selection
</button>
<script>
  onmessage = e => {
    const msg = e.data.pluginMessage;
    if (msg.type === 'selection') document.body.append(JSON.stringify(msg.ids));
  };
</script>
```

### Selection-change listener

```ts
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection;
  figma.ui.postMessage({ type: 'sel', count: sel.length });
});
```

### Run-event with parameters

```ts
figma.parameters.on('input', ({ key, query, result }) => {
  if (key === 'size') result.setSuggestions(['16', '24', '32', '48']
    .filter(s => s.startsWith(query)));
});

figma.on('run', ({ parameters }) => {
  const size = Number(parameters?.size ?? 24);
  // …
  figma.closePlugin(`Created at ${size}px`);
});
```

### Notify with action button

```ts
const handler = figma.notify('Saved', {
  timeout: 5000,
  button: { text: 'Undo', action: () => { figma.triggerUndo(); return true; } }
});
// handler.cancel() to dismiss programmatically
```

### Open a URL externally

```ts
figma.openExternal('https://example.com/docs');
```

### Persist user prefs

```ts
const prefs = await figma.clientStorage.getAsync('prefs') ?? { theme: 'auto' };
prefs.theme = 'dark';
await figma.clientStorage.setAsync('prefs', prefs);
```

### Detach an instance

```ts
const frame = instance.detachInstance(); // returns a FrameNode replacement
```

### Swap an instance's main component

```ts
const newMaster = await figma.importComponentByKeyAsync('abc123…');
instance.swapComponent(newMaster);
```

### Set component properties on an instance

```ts
instance.setProperties({
  'Label#1:1': 'Submit',
  'Disabled#2:1': false,
  'Variant': 'Primary'
});
```

### Create node from SVG

```ts
const node = figma.createNodeFromSvg(`
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13l4 4L19 7" stroke="black" stroke-width="2" fill="none"/>
  </svg>
`);
node.name = 'Check icon';
```

### Cleanly close after async work

```ts
async function run() {
  try {
    await doStuff();
    figma.notify('Done');
  } catch (e) {
    figma.notify(String(e), { error: true });
  } finally {
    figma.closePlugin();
  }
}
run();
```

### Codegen handler (Dev Mode)

```ts
figma.codegen.on('generate', ({ node, language }) => {
  if (language === 'tailwind') {
    return [{ language: 'HTML', code: '<div class="…">…</div>', title: 'Tailwind' }];
  }
  return [];
});
```

### Drop event (drag from UI to canvas)

```ts
// UI initiates a drag with metadata:
// <img draggable="true" ondragstart="event.dataTransfer.setData('text/plain', JSON.stringify({…}))">

// In sandbox:
figma.on('drop', (e) => {
  const meta = JSON.parse(e.items[0]?.data ?? '{}');
  const node = figma.createRectangle();
  node.x = e.absoluteX; node.y = e.absoluteY;
  return false; // suppress default
});
```

---

## Notes on async-only / deprecation

Under `documentAccess: "dynamic-page"` (recommended), these sync APIs throw and you must use the `…Async` variant:

- `figma.getNodeById` → `getNodeByIdAsync`
- `figma.getStyleById` → `getStyleByIdAsync`
- `figma.variables.getVariableById` → `getVariableByIdAsync`
- `figma.variables.getVariableCollectionById` → `getVariableCollectionByIdAsync`
- `figma.variables.getLocalVariables` → `getLocalVariablesAsync`
- `figma.variables.getLocalVariableCollections` → `getLocalVariableCollectionsAsync`
- `figma.getLocalPaintStyles` (and Text/Effect/Grid) → `…Async`
- `node.getMainComponent()` (on `InstanceNode`) → `getMainComponentAsync()`
- `page.findAll/findOne` may need `findAllAsync/findOneAsync` for not-yet-loaded pages
- `node.setEffectStyleId(id)` → `setEffectStyleIdAsync(id)` (same for fill/stroke/text/grid style ids)
- `node.setReactions(…)` → `setReactionsAsync(…)`

When in doubt, prefer the async form — it always exists and works in both modes.