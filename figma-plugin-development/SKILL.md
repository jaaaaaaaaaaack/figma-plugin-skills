---
name: figma-plugin-development
description: 'Build, modify, or debug Figma plugins, widgets, and Dev Mode extensions in VSCode. Use when the user is working on a Figma plugin (`manifest.json`, `figma.createRectangle`, `figma.ui.postMessage`), a FigJam widget (`widget.register`, `useSyncedState`, JSX returning `AutoLayout`/`Text`/`Frame`), or a Dev Mode codegen/inspect plugin (`figma.codegen.on`, `capabilities: ["codegen"]`). Trigger keywords - "figma plugin", "figma widget", "figjam widget", "manifest.json" in a Figma context, "dev mode plugin", "codegen plugin", scaffolding a new plugin, fixing plugin code, understanding the figma API, the figma sandbox / iframe model, postMessage between plugin and UI, scene graph / node types, plugin publishing.'
---

# Figma Plugin Development

This skill helps build and modify Figma extensions in VSCode for someone whose primary background is product design, not engineering. Bias toward:

- **Concrete, runnable examples** over abstract API descriptions.
- **Explaining the "why"** when introducing engineering concepts (sandboxes, postMessage, async, bundlers) — but only the first time per session.
- **One small step at a time**: scaffold → run → see it work → add one feature.
- **Real file changes** instead of pseudocode.

You can build any of three things — pick the right one before writing code.

| What | When to choose | Manifest signature |
|---|---|---|
| **Plugin** | A tool that runs on-demand (menu → run → does stuff → closes). Most "do something to my selection" tools. | `editorType: ["figma"]` (any combination of `figma`, `figjam`, `slides`, `buzz`; `dev` is its own row below — `["figjam", "dev"]` is invalid) |
| **Widget** | A persistent object that lives on the canvas (voting board, timer, todo list). Multi-user safe. FigJam + Figma Design. | `containsWidget: true`, `widgetApi: "1.0.0"` |
| **Dev Mode plugin** | Extends the Inspect panel — custom codegen, attach Storybook/Jira links, show computed CSS. | `editorType: ["dev"]`, `capabilities: ["codegen"]` or `["inspect"]` |

If the user is fuzzy about which they want, ask: *"Should this run once on demand (plugin), live on the canvas (widget), or appear in Dev Mode's Inspect panel?"*

---

## Belong design team context — no Figma MCP access

The Belong design team does **not** have access to the Figma MCP servers (Figma's official `claude.ai Figma` server, `figma-console`, or equivalent). This does not block plugin development — the Plugin API runs inside Figma desktop and needs no MCP — but it changes what you can do during the loop:

- **You can build, modify, and debug plugins as normal.** All workflows in this skill (scaffolding, references, six-mistakes list, debugging) apply unchanged.
- **You cannot read a designer's Figma file, capture screenshots, generate designs from code, or use Code Connect / design-to-code via MCP.** Any tool name starting with `mcp__claude_ai_Figma__`, `mcp___figma-console__`, or similar will fail or be unavailable for this team.
- **If the user proposes a workflow that depends on Figma MCP** (e.g. *"read this file and generate a plugin against it"*, *"capture the design and validate parity"*, *"sync these components back to Figma"*), warn them up front, explain the constraint, and offer an alternative: manual exports they paste in, file/node IDs they look up themselves, screenshots they attach to the conversation, or running the plugin inside Figma desktop to see results.
- **Don't silently fall back.** If an MCP-driven approach would have been the cleanest path, say so — *"the tidiest version of this uses the Figma MCP, which Belong doesn't have access to; here's the next-best approach"* — so the user knows the trade-off rather than wondering why the result feels indirect.

This applies to every agent invocation in this skill. Surface the limitation the first time it becomes load-bearing in a session; you don't need to repeat it after that.

---

## Bundled references — read on demand, not up front

Don't load these unless the user's question maps to one. They are long; grep them for specific symbols rather than reading top-to-bottom.

| File | When to load it |
|---|---|
| [references/plugin-api.md](references/plugin-api.md) | Any question touching `figma.*`, node types (`FrameNode`, `TextNode`, `InstanceNode`…), the scene graph, fills/strokes/effects, variables, fonts, `pluginData`, `clientStorage`, events (`selectionchange`, `documentchange`), or async-vs-sync API choices. **The largest reference — grep before reading.** |
| [references/widget-api.md](references/widget-api.md) | Anything widget-specific: `useSyncedState`, `useSyncedMap`, `usePropertyMenu`, widget JSX components (`AutoLayout`, `Frame`, `Text`, `Input`, `SVG`), `waitForTask`, widget lifecycle. |
| [references/ui-and-messaging.md](references/ui-and-messaging.md) | The two-runtime model (main thread ↔ iframe), `figma.showUI`, `postMessage` patterns, resizing, theme CSS variables, UI frameworks (vanilla / `create-figma-plugin` / React / Svelte), inlining the UI bundle, networking through the iframe, webpack/vite configs. |
| [references/setup-and-publishing.md](references/setup-and-publishing.md) | Scaffolding a project, picking a tsconfig, the iteration loop in Figma desktop, publishing to Community, required assets (icon/cover), versioning, top gotchas list. |
| [references/dev-mode-and-codegen.md](references/dev-mode-and-codegen.md) | Dev Mode plugins, `figma.codegen.on('generate', ...)`, codegen languages / preferences, the `inspect` capability, annotations, dev resources, reading variable bindings off a node. |

To search across all of them at once (from the skill directory):

```bash
grep -rn "loadFontAsync\|loadAllPagesAsync" references/
```

---

## Bundled starter projects

Two minimal scaffolds in `assets/`. Copy the whole folder when the user wants to start fresh; don't try to recreate from memory.

| Folder | What it is |
|---|---|
| `assets/starter-plugin/` | TypeScript plugin with a UI iframe. `manifest.json` + `code.ts` + `ui.html` + `tsconfig.json` + `package.json`. No bundler — `tsc` only. |
| `assets/starter-widget/` | TypeScript widget with property menu + synced state. `manifest.json` + `widget-src/code.tsx` + `tsconfig.json` + `package.json`. |

After copying, the user must:

1. Replace `"id"` in `manifest.json` with a real ID. Get it from Figma desktop: **Menu → Plugins → Development → New plugin… → Save as manifest** to generate one, or copy the ID from any plugin they've already created.
2. Run `npm install` then `npm run watch`.
3. In Figma desktop: **Menu → Plugins → Development → Import plugin from manifest…**

**Add `permissions` only when needed.** Neither starter declares any — keep it that way unless the plugin/widget actually calls `figma.currentUser` (`"currentuser"`), `figma.activeUsers` (`"activeusers"`), library APIs (`"teamlibrary"`), or payments. Forgetting the permission produces a silent `null` rather than a clear error.

---

## Working with this user — defaults for designers

The user is a product designer who codes some but is not a full-time engineer. Calibrate accordingly:

- **TypeScript is non-negotiable** — the `figma.*` types are the main way to discover what's possible without scrolling docs. If they want JS, gently push back: TS will autocomplete every node property, hover-explain every method, and catch typos before run.
- **Default to no bundler if the plugin's UI is simple.** Plain `code.ts` + `ui.html` + `tsc` is the lowest-friction setup. Reach for `create-figma-plugin`, webpack, or vite only when the UI grows beyond a form.
- **Prefer `create-figma-plugin` over hand-rolled React** when the user explicitly wants a real UI. It ships Figma-design-system components (`Button`, `Textbox`, `Dropdown`, `Stack`) that look right out of the box.
- **Don't introduce architecture patterns the plugin doesn't need.** No state management library, no router, no monorepo. Most plugins are <500 lines of `code.ts` + a single-file UI.
- **When explaining, anchor in Figma terms first.** "An `InstanceNode` is what you get when you drag a component out of the assets panel" beats "InstanceNode extends FrameNode with main-component references."

---

## The six mistakes that cost the most debug time

When a plugin breaks, check these first — they account for the majority of "why isn't it working" sessions:

1. **Forgot to `await figma.loadFontAsync(...)` before setting text.** Throws "Cannot unset font" or similar. Required *every time* you touch `.characters`, `.fontName`, or create a `TextNode`.
2. **Forgot `await figma.loadAllPagesAsync()` in a `documentAccess: "dynamic-page"` plugin.** Errors mention "page is not loaded." Required before walking the whole document.
3. **Used `instance.mainComponent` (sync) under `documentAccess: "dynamic-page"`.** It returns `null` when the main component lives on an unloaded page — no error, just silently wrong. Use `await instance.getMainComponentAsync()` instead. Same pattern for `getStyleByIdAsync`, `getNodeByIdAsync`, `getVariableByIdAsync`, etc.
4. **Async work after `figma.closePlugin()` silently dropped.** `closePlugin` kills execution immediately. Always `await` everything *before* closing.
5. **`fetch` called from `code.ts`.** It doesn't exist there. Route network calls through the UI iframe (see [references/ui-and-messaging.md](references/ui-and-messaging.md) §9).
6. **UI postMessage missing the `pluginMessage` wrapper.** UI→plugin requires `parent.postMessage({ pluginMessage: {...} }, '*')`. Plugin→UI does *not* wrap — but the UI receives it as `event.data.pluginMessage`.

If the user reports a bug, ask which of these they've ruled out before diving into the code.

Most of these (font-loading, dynamic-page sync APIs, `closePlugin` ordering) are also caught at lint time by `@figma/eslint-plugin-figma-plugins` — worth installing on any plugin the user plans to maintain.

---

## Workflows

### A. Scaffolding a new plugin or widget

1. Pick plugin vs widget vs dev-mode (decision table above).
2. Copy the matching `assets/starter-*/` folder to the user's chosen location.
3. Tell the user to generate a real plugin ID in Figma desktop (Menu → Plugins → Development → New plugin…) and paste it into `manifest.json`.
4. `npm install`, then `npm run watch` in one terminal.
5. In Figma desktop: Menu → Plugins → Development → Import plugin from manifest… → pick the new `manifest.json`.
6. Run the plugin once to confirm the scaffold works. Re-run with ⌘⌥P / Ctrl+Alt+P.
7. Only now start adding the user's actual feature.

### B. Modifying an existing plugin

1. Read `manifest.json` first — it tells you the editor type, capabilities, dynamic-page mode, network access, and which file is the main entry. Many "why isn't this working" issues are manifest issues.
2. Read the main file (`code.ts`/`main.ts`) and the UI file. Figma plugin code is small — read the whole thing.
3. For any specific API question, grep the relevant references file rather than guessing.

### C. Debugging

1. Have the user open Figma desktop → Menu → Plugins → Development → **Open console**. Both main-thread and UI errors land here.
2. Walk through the five top mistakes list above.
3. If postMessage is involved, add `console.log` on both sides of each message — main thread and UI — to verify shape.

### D. Publishing

Defer to [references/setup-and-publishing.md](references/setup-and-publishing.md) §5 — covers community vs private, the required assets (128×128 icon, 1920×960 cover), and common rejection reasons.

---

## When the user asks something the references don't cover

The Figma plugin API evolves. If a question isn't covered:

1. **Suggest the user check the official docs at https://developers.figma.com/docs/plugins/** — that page is the source of truth.
2. **Look at the relevant TypeScript types in `node_modules/@figma/plugin-typings/index.d.ts`** if installed — it's a single file with the full API and inline JSDoc.
3. Don't invent API names. If unsure whether something exists (e.g. `figma.fooBar`), say so explicitly rather than guessing.
