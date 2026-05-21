# Figma Widget API Reference

Official docs: https://developers.figma.com/docs/widgets/

Widgets are JSX-based, multiplayer-safe objects that live on the canvas. They are **not React** — they use a Figma-specific JSX runtime (`figma.widget.h`) and a custom hooks system that persists state across collaborators.

---

## Table of contents

1. Project setup
2. manifest.json (widget-specific)
3. Widget JSX
4. Components
5. Hooks
6. waitForTask
7. Lifecycle
8. Patterns
9. Constraints & gotchas

---

## 1. Project Setup

### Required dev dependencies

```bash
npm install --save-dev @figma/widget-typings @figma/plugin-typings typescript
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "figma.widget.h",
    "jsxFragmentFactory": "figma.widget.Fragment",
    "target": "es6",
    "strict": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  }
}
```

### Typical layout

```
widget-src/code.tsx    # source
dist/code.js           # compiled output (referenced by manifest.main)
manifest.json
ui.html                # optional iframe UI
```

Scaffold quickly with `npm init @figma/widget`.

---

## 2. `manifest.json`

### Widget-specific fields

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Required. Display name. |
| `id` | `string` | Assigned by Figma on publish. |
| `main` | `string` | Required. Path to compiled JS entry. |
| `containsWidget` | `true` | **Required for widgets.** |
| `widgetApi` | `string` | Required. Current: `"1.0.0"`. |
| `editorType` | `('figma' \| 'figjam')[]` | Required. e.g. `["figma", "figjam"]`. |
| `documentAccess` | `"dynamic-page"` | Strongly recommended — without it, files show a "Loading n pages" delay (20–30 s) on first interaction. |
| `api` | `string` | Plugin API version, e.g. `"1.0.0"`. |
| `ui` | `string \| { [k: string]: string }` | Optional. HTML file(s) for `figma.showUI` iframe. |
| `permissions` | `("currentuser" \| "activeusers")[]` | Required for `figma.currentUser` / `figma.activeUser`. |
| `networkAccess` | `{ allowedDomains: string[], reasoning?: string, devAllowedDomains?: string[] }` | Required for any iframe HTTP calls. |
| `enableProposedApi` | `boolean` | Dev only. |
| `enablePrivatePluginApi` | `boolean` | Local dev only. |
| `build` | `string` | Experimental. Shell command run before load. |

### Differences from plugin manifests

- Widgets **require** `containsWidget: true` and `widgetApi`.
- Widgets do not use `menu` or `relaunchButtons`.
- `ui` is optional and only used when the widget explicitly calls `figma.showUI`.

### Minimal example

```json
{
  "name": "My Widget",
  "id": "1234567890",
  "api": "1.0.0",
  "widgetApi": "1.0.0",
  "containsWidget": true,
  "main": "dist/code.js",
  "editorType": ["figma", "figjam"],
  "documentAccess": "dynamic-page",
  "ui": "ui.html"
}
```

---

## 3. Widget JSX

JSX compiles to `figma.widget.h(...)`. There is **no virtual DOM** and **no React**. The widget function runs whenever state changes and returns a tree of Figma components.

```tsx
const { widget } = figma
const { AutoLayout, Text, useSyncedState } = widget

function MyWidget() {
  const [count, setCount] = useSyncedState("count", 0)
  return (
    <AutoLayout padding={16} onClick={() => setCount(count + 1)}>
      <Text>Count: {count}</Text>
    </AutoLayout>
  )
}

widget.register(MyWidget)
```

`widget.register(component)` must be called exactly once, at the top level of `main`.

---

## 4. Components

| Component | Purpose | Notes |
|---|---|---|
| `AutoLayout` | Flex-like container | Most-used layout primitive. |
| `Frame` | Manual-positioning container | Children use `x`/`y`. |
| `Text` | Display text | Inherits color/size to `Span` children. |
| `Input` | Editable text | On-canvas editing. Not a plugin DOM input. |
| `Rectangle` | Filled rect | Requires `width` + `height`. |
| `Ellipse` | Filled ellipse | Supports `arcData`. |
| `Image` | Bitmap | `src` accepts URL, data URI, or `ImagePaint`. |
| `Line` | Line | `length`, `strokeCap`. |
| `SVG` | Inline SVG | `src` is an `<svg>` string — use for icons. |
| `Span` | Inline text styling | Only valid as a child of `Text`/`Span`. |
| `Fragment` (`<>...</>`) | Grouping | Cannot be the root return. |

### Props shared by ALL layer components

**BaseProps**
| Prop | Type | Default |
|---|---|---|
| `name` | `string` | — |
| `hidden` | `boolean` | `false` |
| `onClick` | `(e: WidgetClickEvent) => Promise<any> \| void` | — |
| `key` | `string \| number` | — |
| `hoverStyle` | `HoverStyle` | — |
| `tooltip` | `string` | — |
| `positioning` | `"auto" \| "absolute"` | `"auto"` |

**BlendProps**: `blendMode`, `opacity` (0–1), `effect: Effect | Effect[]`

**ConstraintProps**: `x: number | HorizontalConstraint`, `y: number | VerticalConstraint`, `overflow: "visible" | "hidden" | "scroll"` (AutoLayout/Frame only)

**SizeProps**: `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `rotation` (-180..180)

**GeometryProps**: `fill`, `stroke`, `strokeWidth`, `strokeAlign: "inside" | "center" | "outside"`, `strokeDashPattern: number[]`

**CornerProps**: `cornerRadius: number | { topLeft, topRight, bottomLeft, bottomRight }`

### Size values

```ts
type Size = number | "fill-parent"
type AutolayoutSize = Size | "hug-contents"   // default for AutoLayout
```

### HoverStyle

Only `fill`, `stroke`, and `opacity` can be overridden on hover. Requires the element (or an ancestor) to have `onClick` or `onTextEditEnd`. Styles cascade to descendants unless overridden.

```tsx
<AutoLayout
  fill="#FFFFFF"
  hoverStyle={{ fill: "#000000" }}
  onClick={...}
>
  <Text hoverStyle={{ fill: "#FFFFFF" }}>Click me</Text>
</AutoLayout>
```

### AutoLayout-specific props

| Prop | Type | Default |
|---|---|---|
| `direction` | `"horizontal" \| "vertical"` | `"horizontal"` |
| `spacing` | `number \| "auto" \| LayoutGap` | `0` |
| `padding` | `Padding` | `0` |
| `horizontalAlignItems` | `"start" \| "center" \| "end"` | `"start"` |
| `verticalAlignItems` | `"start" \| "center" \| "end" \| "baseline"` | `"start"` |
| `wrap` | `boolean` | `false` |
| `width`/`height` | `AutolayoutSize` | `"hug-contents"` |

```ts
type Padding =
  | number
  | { top?: number; right?: number; bottom?: number; left?: number }
  | { vertical?: number; horizontal?: number }
```

### Text-specific props

| Prop | Type | Default |
|---|---|---|
| `fontFamily` | `string` (Google Fonts) | `"Inter"` |
| `fontWeight` | `number \| "thin" \| "light" \| "normal" \| "medium" \| "semi-bold" \| "bold" \| ...` | `"normal"` |
| `fontSize` | `number` (min 1) | `16` |
| `lineHeight` | `number \| string \| "auto"` | `"auto"` |
| `letterSpacing` | `number \| string` | `0` |
| `fill` | `HexCode \| Color \| Paint \| Paint[]` | `"#000000"` |
| `horizontalAlignText` | `"left" \| "center" \| "right" \| "justified"` | `"left"` |
| `verticalAlignText` | `"top" \| "center" \| "bottom"` | `"top"` |
| `textDecoration` | `"none" \| "strikethrough" \| "underline"` | `"none"` |
| `textCase` | `"original" \| "upper" \| "lower" \| "title" \| "small-caps" \| "small-caps-forced"` | `"original"` |
| `italic` | `boolean` | `false` |
| `truncate` | `boolean \| number` | `false` |

### Span

Only valid inside `Text` / `Span`. Supports `href`, `fontFamily`, `fontSize`, `fontWeight`, `italic`, `fill`, `letterSpacing`, `textDecoration`, `textCase`. Inherits unspecified props from the parent.

### Input

On-canvas editable text. The user must double-click to enter edit mode; you cannot trigger edit programmatically.

| Prop | Type | Notes |
|---|---|---|
| `value` | `string \| null` | Current text |
| `placeholder` | `string` | Shown when value is empty |
| `placeholderProps` | text styling props | Style for placeholder |
| `onTextEditEnd` | `(e: TextEditEvent) => void \| Promise<void>` | Fires on blur / Esc / Cmd+Enter |
| `inputFrameProps` | `AutoLayout` props | Wraps the input |
| `inputBehavior` | `"wrap" \| "truncate" \| "multiline"` | Enter key + overflow |
| `width` | `Size` | Default `200`; controls wrap |
| ...Text props | — | `fontSize`, `fill`, etc. |

```tsx
const [text, setText] = useSyncedState<string>("text", "")
<Input
  value={text}
  placeholder="Type..."
  onTextEditEnd={(e) => setText(e.characters)}
  inputBehavior="multiline"
  fontSize={14}
/>
```

**Why it differs from plugins**: Plugins type into HTML `<input>` elements inside an iframe DOM. The widget `Input` is a native canvas node; there is no live `onChange` — state only updates on `onTextEditEnd`. Treat `onTextEditEnd` as the commit point.

### SVG (icons)

`src` must be a complete `<svg>...</svg>` string. SVG colors come from the SVG markup; `fill`/`stroke` props apply at the node level.

```tsx
const plusIcon = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 3v10M3 8h10" stroke="black" stroke-width="2"/>
</svg>`

<SVG src={plusIcon} width={16} height={16} onClick={...} />
```

---

## 5. Hooks

Widget hooks **look like** React hooks but are not. They are calls into the widget runtime that persist data into the document. They obey the same call-order rule (top of function, never inside conditionals/loops).

### `useSyncedState<T>(key, initial)`

```ts
useSyncedState<T>(name: string, defaultValue: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void]
```

- Persists into the widget node — survives reloads and is shared across collaborators.
- The `name` must be unique per widget and stable across versions (it's the storage key).
- Last writer wins — concurrent updates from different users overwrite each other.
- Setting state triggers a re-render of that widget instance on **all** clients.
- `defaultValue` can be a function for lazy init (e.g. for plugin API calls).

### `useSyncedMap<T>(key)`

```ts
useSyncedMap<T>(name: string): SyncedMap<T>   // get, set, delete, keys, values, entries, size
```

- Last-writer-wins **per key**, so concurrent writes to different keys merge cleanly.
- Use when multiple users modify the same logical state simultaneously (votes, presence, per-row data).

### `usePropertyMenu(items, onChange)`

Renders the floating toolbar shown when a widget is selected.

```ts
usePropertyMenu(
  items: WidgetPropertyMenuItem[],
  onChange: (e: { propertyName: string; propertyValue?: string }) => void | Promise<void>
): void
```

Item types:

| `itemType` | Fields |
|---|---|
| `"action"` | `propertyName`, `tooltip`, `icon?` |
| `"separator"` | — |
| `"toggle"` | `propertyName`, `tooltip`, `isToggled`, `icon?` |
| `"color-selector"` | `propertyName`, `tooltip`, `selectedOption`, `options: { option, tooltip }[]` |
| `"dropdown"` | `propertyName`, `tooltip`, `selectedOption`, `options: { option, label }[]` |
| `"link"` | `propertyName`, `tooltip`, `icon`, `href` |

```tsx
usePropertyMenu(
  [
    { itemType: "action", propertyName: "reset", tooltip: "Reset" },
    { itemType: "separator" },
    {
      itemType: "color-selector",
      propertyName: "color",
      tooltip: "Color",
      selectedOption: color,
      options: [{ option: "#e06666", tooltip: "Red" }, { option: "#6fa8dc", tooltip: "Blue" }],
    },
  ],
  ({ propertyName, propertyValue }) => {
    if (propertyName === "reset") setCount(0)
    if (propertyName === "color" && propertyValue) setColor(propertyValue)
  }
)
```

### `useEffect(effect)`

```ts
useEffect(effect: () => (() => void) | void): void
```

- **No dependency array.** Runs after every render where state changed.
- Runs only when the widget is "live" (this client owns rendering of the widget); it does **not** run for every widget on every client every render.
- Effects run before any subsequent event handler executes.
- Return a cleanup function for any `figma.on(...)` listeners — they will otherwise accumulate.
- For async work, wrap the promise in `waitForTask` so the runtime keeps the widget alive.

```tsx
useEffect(() => {
  const onSel = () => setCount(figma.currentPage.selection.length)
  figma.on("selectionchange", onSel)
  return () => figma.off("selectionchange", onSel)
})
```

### `useWidgetId()`

Returns the current widget's node ID. **Do not call `figma.getNodeById` during render** — only inside event handlers / effects.

```tsx
const id = useWidgetId()
<Text onClick={() => {
  const node = figma.getNodeById(id) as WidgetNode
  const clone = node.clone()
  node.parent!.appendChild(clone)
}}>Duplicate</Text>
```

Pair with `figma.currentPage.findWidgetNodesByWidgetIdAsync(id)` (or the page-mixin `findWidgetNodesByWidgetIdAsync`) to find sibling instances of the same widget — useful for multi-widget experiences like an org chart.

### `useStickable(onStuckStatusChanged?)` — FigJam only

Lets the widget attach itself to other nodes ("stamp" behavior).

```ts
useStickable(onStuckStatusChanged?: (e: WidgetStuckEvent) => void | Promise<void>): void
```

A node is either a stickable or a stickable host, not both. Cannot be used in the same render as `useStickableHost`.

### `useStickableHost(onAttachmentsChanged?)` — FigJam only

```ts
useStickableHost(onAttachmentsChanged?: (e: WidgetAttachedStickablesChangedEvent) => void | Promise<void>): void
```

Widgets are stickable hosts by default; only call this if you need the change callback.

---

## 6. `waitForTask(promise)`

```ts
waitForTask(task: Promise<any>): void
```

The widget runtime tears down execution as soon as the synchronous render returns. Any unawaited promise (network call, `loadFontAsync`, `figma.clientStorage`) will be cancelled. Wrap it in `waitForTask` to keep the widget alive until the promise resolves.

Used inside event handlers and `useEffect`. **Not** needed for top-level `await` in synchronous setters.

```tsx
useEffect(() => {
  waitForTask((async () => {
    const data = await fetchFromIframe()
    setData(data)
  })())
})
```

---

## 7. Lifecycle

| Event | Behavior |
|---|---|
| Insertion | Widget function runs once; initial state hydrated from `defaultValue`s. |
| State change (`setSynced...`) | Widget function re-runs. `useEffect` re-runs after render. State is synced to all clients. |
| File reload | Synced state is **persisted on the widget node** — values restore from the document. Local-only variables are lost. |
| Co-edit | A remote update to synced state triggers a re-render on every client viewing that widget. |
| Async event handler | Code stops running when the handler returns unless its work is wrapped in `waitForTask`. |

Widgets do not have an `onMount`/`onUnmount`; use `useEffect` + cleanup for both.

---

## 8. Patterns

### Counter (minimal)

```tsx
const { widget } = figma
const { AutoLayout, Text, useSyncedState } = widget

function Counter() {
  const [count, setCount] = useSyncedState("count", 0)
  return (
    <AutoLayout padding={16} cornerRadius={8} fill="#fff" stroke="#eee"
      onClick={() => setCount(count + 1)}>
      <Text fontSize={20}>{count}</Text>
    </AutoLayout>
  )
}
widget.register(Counter)
```

### Editable text

```tsx
function Note() {
  const [text, setText] = useSyncedState<string>("text", "")
  return (
    <AutoLayout padding={12} fill="#FFF6B1" width={240}>
      <Input
        value={text}
        placeholder="Write a note..."
        onTextEditEnd={(e) => setText(e.characters)}
        inputBehavior="multiline"
        width="fill-parent"
        fontSize={14}
      />
    </AutoLayout>
  )
}
```

### Open an iframe UI from the property menu

`figma.showUI` opens the HTML from `manifest.ui`. The iframe is the only place a widget can run unrestricted JS (including `fetch`). Always wrap with `waitForTask` so the runtime waits for `figma.ui.onmessage`.

```tsx
function WithIframe() {
  const [value, setValue] = useSyncedState<string>("value", "")
  usePropertyMenu(
    [{ itemType: "action", propertyName: "edit", tooltip: "Edit" }],
    ({ propertyName }) => {
      if (propertyName === "edit") {
        return new Promise<void>((resolve) => {
          figma.showUI(__html__, { width: 320, height: 240 })
          figma.ui.onmessage = (msg) => {
            if (msg.type === "save") { setValue(msg.value); figma.closePlugin() }
            resolve()
          }
        })
      }
    }
  )
  return <Text>{value || "Click property menu →"}</Text>
}
```

> **Important**: `figma.closePlugin()` here only ends the property-menu iframe session — the widget itself stays on canvas. Widgets persist with the document; only their iframes are ephemeral. Calling `closePlugin` does **not** delete the widget. (Common confusion point — designers expect "close" to remove the widget.)

### Respond to selection / page changes

```tsx
function SelectionCount() {
  const [n, setN] = useSyncedState("n", 0)
  useEffect(() => {
    const handler = () => setN(figma.currentPage.selection.length)
    figma.on("selectionchange", handler)
    return () => figma.off("selectionchange", handler)
  })
  return <Text>{n} selected</Text>
}
```

### Widget with an icon (SVG)

```tsx
const checkSvg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 8l3 3 7-7" stroke="#0a0" stroke-width="2" fill="none"/>
</svg>`

function Todo() {
  const [done, setDone] = useSyncedState("done", false)
  return (
    <AutoLayout spacing={8} verticalAlignItems="center" padding={12}
      onClick={() => setDone(!done)}>
      {done ? <SVG src={checkSvg} /> : <Rectangle width={16} height={16} stroke="#999" cornerRadius={3} />}
      <Text textDecoration={done ? "strikethrough" : "none"}>Task</Text>
    </AutoLayout>
  )
}
```

### Multiplayer-safe counter (`useSyncedMap`)

```tsx
function VoteBoard() {
  const votes = useSyncedMap<number>("votes")
  const total = Array.from(votes.values()).reduce((a, b) => a + b, 0)
  return (
    <AutoLayout padding={16} onClick={() => {
      const sid = figma.activeUsers[0].sessionId
      votes.set(String(sid), (votes.get(String(sid)) ?? 0) + 1)
    }}>
      <Text>Total: {total}</Text>
    </AutoLayout>
  )
}
```

---

## 9. Constraints & Gotchas

**Widgets cannot (directly):**
- Make `fetch` / network requests — must round-trip through an iframe opened via `figma.showUI`. Declare domains in `manifest.networkAccess`.
- Run code while not selected (other than `useEffect` cleanup of registered listeners, which the runtime tracks).
- Hold local-only React-style state — every meaningful value must be in `useSyncedState`/`useSyncedMap` or it disappears on render.
- Call `figma.getNodeById` during render — only in handlers/effects.
- Use both `useStickable` and `useStickableHost` in the same render.
- Return a `Fragment` as the root component.

**Plugins cannot (vs widgets):**
- Persist a visible object on the canvas after the plugin closes.
- Be shared interactively with collaborators — plugins are single-user.
- Be inserted as a permanent canvas object via the assets panel.

**Sharp edges:**
- `useEffect` has **no deps array** — guard against re-runs yourself.
- Always wrap async work in event handlers / effects with `waitForTask`, or it will be cancelled.
- `useSyncedState` `name` is the storage key: changing it across versions orphans existing widget data.
- Without `documentAccess: "dynamic-page"`, users hit a 20–30 s "Loading n pages" stall on first interaction.
- `Input` has no live change event — commit on `onTextEditEnd` only.
- `Span` only works inside `Text`.
- `Frame` does not auto-position children — use `AutoLayout` unless you need manual `x`/`y`.
- `hoverStyle` only supports `fill`, `stroke`, `opacity`; the host must have `onClick` or `onTextEditEnd`.
- Fonts other than Inter need `figma.loadFontAsync` (called inside `useEffect` + `waitForTask`) before they render — there is no `useFonts` hook in the widget API.
