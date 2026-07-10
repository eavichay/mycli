# Brainstorm Context: MyCLI — Personal TUI Dashboard

## Problem Statement

Build a personal productivity command-line tool with a TUI (terminal user interface) that:
- Acts as a unified personal dashboard (tasks, notes, calendar, email)
- Is fully driven by keyboard navigation and a config file
- Has a pluggable extension architecture designed from day 0 as a marketplace, where each extension exposes a "peek" (dashboard tile) and "focus" (detailed) view
- Each extension declares its output type in a manifest — v1 supports `react-component` and `stdout`
- App provides scoped filesystem storage per extension; backup of all storage via Google Drive (extensible)
- Includes an agentic AI sidebar with access to extension-provided tools/resources
- Supports theming and a command palette
- Is incrementally extensible — start with task list and notes, grow from there

The project is Node.js (greenfield), currently only a `package.json` exists.

---

## Key Concepts

- **Extension**: The canonical unit of functionality. Designed from day 0 as a marketplace-installable package. Built-in extensions (tasks, notes, agent) are just extensions that ship bundled. Each extension has a **manifest** (`extension.json`) declaring its ID, output type, capabilities, and storage needs.
- **Extension Manifest** (`extension.json`): Declares `outputType` (`react-component` | `stdout`), provided views (peek / focus), registered commands, agent tools/resources, and storage requirements. The app reads the manifest before loading any code — no code execution required to introspect an extension.
- **Output Types (v1)**:
  - `react-component`: Extension exports React-compatible components rendered directly by the Ink app
  - `stdout`: Extension is a subprocess; app spawns it and renders its stdout output in the allocated slot (enables non-JS extensions: Python, Go, shell scripts, etc.)
- **Scoped Filesystem Storage**: App provides each extension a sandboxed directory under `~/.local/share/mycli/extensions/<extension-id>/`. Extensions receive a `storage` API object from AppContext and never access raw filesystem paths. Future: scoped SQLite tables provided as an upgrade path.
- **Backup Layer**: Optional sync of the full `~/.local/share/mycli/` root to Google Drive (v1). Extensible to other platforms (S3, Dropbox, etc.). Extensions are completely unaware of backup — they just write to their scoped storage.
- **Dashboard**: Root screen. A configurable grid of extension peek views. Keyboard navigable.
- **Focus View**: When a peek tile is activated, the extension's focus view takes over the main area. **Full-screen swap** for v1 (simpler; no layout juggling).
- **App Context**: Runtime object injected into every extension's root component. Provides: `storage` (scoped FS API), `commands` (registry), `navigate`, `theme`, `config` (extension's config slice).
- **Command Palette**: Global popup (like VS Code's `Ctrl+P`) for fuzzy-finding commands registered by any extension.
- **Agent Sidebar**: Toggleable panel running an AI agent with access to extension-provided MCP-style tools and resources.
- **Config File**: YAML file at `~/.config/mycli/config.yaml` driving layout, keybinds, installed extensions, themes — everything without code.
- **Theme**: A named color + style preset applied globally via a `useTheme()` hook.

---

## TUI Framework Research — Multi-Agent Findings (June 2026)

Three independent research agents compared all pairs. Findings synthesized below.



> This project uses Node.js 26 (`.nvmrc`). Framework runtime requirements matter.

| Framework | Paradigm | Node.js | Built-in components | Layout | Status |
|-----------|----------|---------|--------------------|---------|----|
| **Ink v7** | React | ✅ full | 6 (Box, Text, Spacer, Newline, Static, Transform) | Yoga flexbox (WASM) | Stable, 1.3M dl/wk |
| **Silvery** | React (Ink-compat) | ✅ full | 45+ incl. CommandPalette, SplitView, VirtualList, Toast | Flexily (pure TS) or Yoga | Active, v1.x |
| **OpenTUI** | React / SolidJS / Vue | ⚠️ Node 26 via `--experimental-ffi` (merged June 8) | Box, Text, Input, Select, ScrollBox, Code, Diff | Yoga flexbox (Zig native) | Pre-1.0, Bun-primary |
| **Glyph** | React | ✅ full | 20+ incl. borders, focus scopes, JumpNav | Yoga flexbox (double-buffered) | Active |
| **Blessed** | Imperative widgets | ✅ full | 30+ widgets | CSS-like absolute | ❌ Abandoned 2019 |

### Cross-Cutting Findings

| Criterion | Ink v7 | Silvery | OpenTUI |
|---|---|---|---|
| Built-in components | 6 core + 13 via @inkjs/ui | **45+** (CommandPalette, SplitView, Tabs, Toast, VirtualList, TreeView) | ~8 primitives (Text, Box, Input, Select, ScrollBox, Code, Diff) |
| Layout for dashboard grid | `useBoxMetrics` returns 0×0 first render → cascading re-renders | **`useBoxRect()` during render** — no flicker, no cascade | Yoga, no `useBoxRect()` equivalent |
| Theming | Manual chalk — no system | **Sterling: 84 schemes, semantic tokens, auto-detect** | Per-component RGBA, no semantic token system |
| Focus management | Flat tab ring; manual `isActive` threading | **Tree-based scopes + spatial nav + InputLayerProvider** | Native Zig focus; manual `useKeyboard` for component focus |
| Testing | `ink-testing-library` + Vitest (mature) | **`@silvery/test`: headless, Playwright-style `press()`** | Requires `--experimental-ffi` in CI; bun:test primary |
| Performance (dashboard) | Baseline; line-level rewrite | **3–27× faster; cell-level dirty tracking** | Native Zig (different profile; FFI call overhead per commit) |
| Extension peer-dep safety | Safe — React context mismatch (recoverable) | **Safe — pure TypeScript, standard Node.js module resolution** | ⚠️ C ABI singleton — duplicate `@opentui/core` can **crash the process** |
| Marketplace plugin API | None built-in (DIY React Context) | `@silvery/create` Silvertea — **not yet released** | **`createReactSlotRegistry` shipped** (Bun-only on Node.js) |
| Node.js 26 (no flags) | ✅ Full, no flags | ✅ Full, no flags (≥23.6) | ⚠️ `--experimental-ffi` required; support merged June 8, 2026 |
| Maturity | ★★★★★ 7yr, 39K stars, 1.3M dl/wk | ★★☆ 6mo, ~20 stars | ★★★ 10mo, 12K stars, production via OpenCode |
| Long-term trajectory | Stable maintenance | Single maintainer, high quality | Funded team (anomalyco), fast-moving |
| API stability | Stable (v7) | Renderer stable; `@silvery/create` WIP | Pre-1.0; frequent breaking changes (88 releases in 10 months) |

### Agent Verdicts by Pair

**Ink vs Silvery** → **Silvery** for this project. Feature alignment is too strong to ignore. Every required dashboard primitive (CommandPalette, SplitView, input layering, scroll, theming) is built-in. Ink would require 3–5 weeks of component assembly before any domain logic. Risk: single maintainer, pre-1.0 API, no `@silvery/create` yet.

**Ink vs OpenTUI** → **Ink** for this project (Node.js 26 target). The extension peer-dep model is decisive: with Ink a bad extension load causes a React context mismatch (recoverable JS error); with OpenTUI it can cause C ABI pointer aliasing and process crash. `--experimental-ffi` (Stability 1, 3 weeks old) is a non-starter for distributing a CLI tool. Performance gap is irrelevant at dashboard scale.

**Silvery vs OpenTUI** → **Silvery** for today on Node.js 26. OpenTUI's `createReactSlotRegistry` is architecturally superior for marketplace extensions — but `runtime-plugin-support` is Bun-only and every user needs `--experimental-ffi`. Silvery wins on: all six required components built-in, zero-flag Node.js 26, headless testing, Sterling semantic tokens for marketplace theming. OpenTUI becomes better choice when: Bun as runtime, OpenTUI reaches 1.0, Node.js FFI stabilizes.

### Synthesis

All three agents converge on the same answer: **Silvery for v1, OpenTUI as the named v2 renderer swap target**.

The specific project risks to consciously accept with Silvery:
1. **Pre-1.0, single maintainer** — pin exact version, treat minor bumps as potentially breaking
2. **`@silvery/create` Silvertea not yet released** — build the plugin registry yourself today using React Context + `require()`; migrate to the official API when it ships
3. **No formal SlotRegistry** — OpenTUI's `createReactSlotRegistry` is more purpose-built for marketplace; Silvery's equivalent is DIY for now
4. **20 GitHub stars** — this is a personal tool, so community is less critical; but document the risk

OpenTUI upgrade trigger conditions (log these for a future decision):
- OpenTUI hits v1.0
- Node.js ships `node:ffi` at Stability 2 (≥ Node.js 28 est.)
- `runtime-plugin-support` is available on Node.js
- Or: project switches to Bun as runtime

---

## Approaches Considered

### Approach A: Ink v7 + Custom Slot Engine

**How it works**: Single Ink `render()` call owns the terminal. A slot registry (React Context) maps named regions (`dashboard-grid`, `focus-pane`, `sidebar`, `palette-overlay`) to components. Extension loader registers extension components into the registry at startup. Extensions are pure React + Ink peer deps.

**Tradeoffs**:
- `+` Most documentation and ecosystem — Claude Code, Gemini CLI, Prisma, Shopify all use Ink. AI assistance will be excellent.
- `+` Stable v7 (April 2026), React 19 support, `ink-testing-library` for extension tests
- `-` Only 6 built-in components — command palette, split view, virtual lists all need hand-rolled or third-party packages
- `-` Yoga layout via WASM: async init, heavier bundle, WASM heap growth under load
- `-` ~30fps implicit cap in some rendering modes
- `-` No built-in theming system — must be entirely custom

**Risks**: Building CommandPalette, SplitView, and theming from scratch adds significant scope to the framework layer that should be focused on the extension system.

**Best for**: If ecosystem familiarity and AI assistance quality are top priorities over built-in features.

---

### Approach B: Silvery + Slot Engine

**How it works**: Silvery is a ground-up reimplementation of Ink's API with a cell-level buffer renderer. 99% Ink API-compatible (918/931 Ink 7.0 tests pass) — extension authors write the same `<Box>` / `<Text>` / `useInput` code. The difference is what the framework gives you for free: `<CommandPalette>`, `<SplitView>`, `<VirtualList>`, `<Toast>`, `<Tabs>`, `<TreeView>`, `useBoxMetrics`, semantic theming, per-node dirty tracking.

**Tradeoffs**:
- `+` **CommandPalette built-in** — a core app requirement, not something to build from scratch
- `+` **SplitView built-in** — the dashboard grid + sidebar layout is a first-class primitive
- `+` **Semantic theming built-in** — `{ base, surface, overlay, text, accent, error... }` token system, 4 built-in schemes, custom theme support
- `+` 15–20× faster rerender than Ink; atomic frame commits (no flicker on view transitions)
- `+` Pure TypeScript — no WASM, no native deps, works on Node/Bun/Deno, instant sync import
- `+` 99% Ink API compatible — extensions written for Silvery are nearly identical to Ink extensions
- `+` Optional TEA state machine (`(action, state) → [state, effects]`) — clean model for the view router
- `-` Smaller community than Ink; less third-party extension ecosystem (young)
- `-` Fewer tutorials and AI training data than Ink

**Risks**: Younger project than Ink — API may shift. Mitigated by the Ink compatibility layer (can switch back).

**Best for**: This project. The three core framework features this app needs (CommandPalette, SplitView, theming) are already built — the implementation effort goes into the extension system and modules, not re-inventing UI primitives.

---

### Approach C: OpenTUI (@opentui/react)

**How it works**: Zig native core with a React reconciler on top. `createCliRenderer()` is async (creates the Zig engine), `createRoot(renderer).render(<App />)` connects React to it. Uses Yoga layout. Powers OpenCode in production. Supports React DevTools. Highest theoretical performance. Tree-sitter syntax highlighting built in.

**Tradeoffs**:
- `+` Highest performance — native Zig renderer, no 30fps cap
- `+` Production-proven (OpenCode, terminal.shop)
- `+` React DevTools support — easier debugging of complex extension trees
- `+` Tree-sitter integration — useful if a code/notes viewer is added later
- `-` **Node.js support requires `--experimental-ffi` flag** — merged June 8, 2026 (3 weeks old). Unstable for a new project.
- `-` Bun is the primary runtime; Node is a second-class citizen today
- `-` Pre-1.0; "not ready for production use" per README
- `-` Native Zig binary = native dependency, breaks simple `npm install` story
- `-` Fewer built-in components than Silvery; still building out ecosystem

**Risks**: Node.js FFI support is very recent and experimental. Starting a project on `--experimental-ffi` with a pre-1.0 library on Node.js 26 is high risk.

**Best for**: Projects willing to run Bun as their runtime; greenfield projects OK waiting 6 months for OpenTUI to stabilize. A strong candidate for a v2 renderer swap once the project is running.

---

### Approach D: Blessed

**Eliminated.** Last commit 2019. No TypeScript. No component model. Building a marketplace-ready extension system on top would be rebuilding everything this project needs.

---

## Recommended Direction

**Approach B: Silvery + Slot Engine**, with **OpenTUI as a named future upgrade path**.

Rationale:
- The three non-negotiable framework requirements (CommandPalette, SplitView, theming) are already built into Silvery — using Ink means building all three from scratch before writing a single extension
- Pure TypeScript with no native deps is the right story for a personal tool: `npm install`, done, works on any machine
- 99% Ink API compatibility means the extension authoring contract is stable even if the host framework changes renderers later — the slot registry + peer-dependency model works identically
- OpenTUI is the right long-term bet (performance, React DevTools, native core) but its Node.js support is too new (3 weeks) to bet a greenfield project on today; it's a natural v2 renderer swap once it stabilizes

---

## Architecture Notes

### Extension Manifest (`extension.json`)
```json
{
  "id": "tasks",
  "name": "Task List",
  "version": "1.0.0",
  "outputType": "react-component",
  "views": { "peek": true, "focus": true },
  "storage": { "type": "filesystem" },
  "commands": ["tasks.add", "tasks.complete", "tasks.clear-done"],
  "agentTools": ["list_tasks", "add_task", "complete_task"],
  "agentResources": ["tasks_summary"]
}
```

For `stdout` extensions — one-shot execution, output is captured and rendered as static text in the slot:
```json
{
  "id": "weather",
  "name": "Weather Widget",
  "version": "1.0.0",
  "outputType": "stdout",
  "runtime": { "command": "python3", "entry": "run.py" },
  "views": { "peek": true, "focus": false },
  "refresh": { "intervalSeconds": 300 }
}
```
`refresh` is optional; if present the app re-executes the command on the interval and replaces the rendered output. No bidirectional protocol — stdout extensions are stateless producers.

### React Rendering Model: How Host and Guest Share the Render Tree

**The core question**: Can the host create a "portal" render root that the guest extension renders into, or does the guest provide components that the host renders?

**Answer**: Ink has no DOM, so `React.createPortal` does not exist. There is a single Ink `render()` call per process — one renderer owns the entire terminal output. Two processes writing to `stdout` would collide.

The practical model is: **host-owned renderer + slot registry**.

```
Host process (single Ink render tree)
  └── <App>
        └── <Dashboard>
              ├── <Slot name="tasks-peek" />   ← renders registered component
              ├── <Slot name="notes-peek" />
              └── <Slot name="focus" />         ← renders active focus view
```

The extension loader does:
```ts
const ext = require(extensionPath) as ReactExtension;
slotRegistry.register('tasks-peek', ext.peek);
slotRegistry.register('tasks-focus', ext.focus);
```

`<Slot>` reads from the registry via Context and renders the registered component directly. This is a "software portal" — not React's DOM portal, but equivalent: extensions declare components that render in slots they don't know the location of.

**Critical constraint**: extensions must NOT bundle React or Ink. They declare them as `peerDependencies`. The host's React instance is the only one — loading two React instances in the same process causes the ["invalid hook call" bug](https://react.dev/warnings/invalid-hook-call-warning). Extension authors write plain React + Ink Box/Text components; the host supplies the runtime.

**`stdout` extensions** bypass this entirely — the host spawns them as subprocesses, captures their stdout, and renders it as static `<Text>` in a slot. No React sharing concern.

### AppContext Interface
```typescript
interface StorageAPI {
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, content: string): Promise<void>;
  list(relativeDir?: string): Promise<string[]>;
  remove(relativePath: string): Promise<void>;
  // all paths scoped to ~/.local/share/mycli/extensions/<extensionId>/
}

interface AppContext {
  extensionId: string;
  storage: StorageAPI;
  commands: CommandRegistry;
  navigate(target: { extensionId: string; view: 'focus' } | 'dashboard'): void;
  theme: Theme;
  config: Record<string, unknown>;   // this extension's config slice from config.yaml
}

// react-component output type — extension entry point
interface ReactExtension {
  peek: React.FC<{ ctx: AppContext }>;
  focus?: React.FC<{ ctx: AppContext }>;
  agentTools?: MCPTool[];
  agentResources?: MCPResource[];
  commands?: CommandHandler[];
  // peerDependencies in package.json: { "react": "*", "ink": "*" }
  // MUST NOT bundle react or ink
}
```

### Storage Architecture
```
~/.local/share/mycli/          ← root; backed up as a unit
├── extensions/
│   ├── tasks/                 ← StorageAPI root for tasks extension
│   ├── notes/                 ← StorageAPI root for notes extension
│   └── google/                ← StorageAPI root for google extension
└── (future: shared.db for cross-extension SQLite tables)

~/.config/mycli/
├── config.yaml                ← app config + extension configs
└── themes/                    ← custom theme files
```

### Backup Layer
- A background service (or on-demand command) diffs and syncs `~/.local/share/mycli/` to the configured backup target
- v1: Google Drive via Drive API (OAuth2 device flow)
- Extensible: backup provider is a pluggable adapter (`BackupProvider` interface) — future: S3, Dropbox, iCloud
- Extensions need zero awareness of backup; they write to StorageAPI, backup reads the same files

### Layout Architecture (Approach C — Slot Engine)
```
┌─────────────────────────────────────┬──────────┐
│  dashboard-grid (or focus-pane)     │ sidebar  │
│  ┌────────┐  ┌────────┐  ┌────────┐ │ (toggle) │
│  │ Tasks  │  │ Notes  │  │ Google │ │          │
│  │ peek   │  │ peek   │  │ peek   │ │  Agent   │
│  └────────┘  └────────┘  └────────┘ │  chat    │
│                                     │          │
│  [on Enter → swaps to focus-pane]   │          │
└─────────────────────────────────────┴──────────┘
│ statusbar: [mode] [focused ext] [keybind hints] │
└─────────────────────────────────────────────────┘
         ↑ palette-overlay floats above all slots
```

### Extension Marketplace (day 0 design, not v1 runtime)
- Extensions are npm packages with a mandatory `extension.json` manifest at root
- Registry: a curated `registry.json` (initially a GitHub-hosted file)
- Install flow: `mycli ext install <id>` — downloads, validates manifest, copies to `~/.local/share/mycli/extensions-installed/<id>/`, updates config
- Built-in extensions live in `src/extensions/` in the app repo — loaded by the same loader as installed extensions
- Version pinning: installed extension versions tracked in `~/.config/mycli/extensions.lock`

### Configuration Schema (YAML)
```yaml
theme: catppuccin-mocha
extensions:
  - id: tasks
    enabled: true
    position: { row: 0, col: 0 }
    config:
      defaultCategory: inbox
  - id: notes
    enabled: true
    position: { row: 0, col: 1 }
keybinds:
  palette: "ctrl+p"
  agent: "ctrl+a"
  focus: "enter"
  back: "escape"
  quit: "q"
agent:
  enabled: true
  provider: openai       # openai | anthropic | ollama
  model: gpt-4o
backup:
  enabled: false
  provider: google-drive
```

### Google Integration
- A separate `google` extension (built-in but opt-in)
- OAuth2 device code flow — user gets a URL to open in browser, pastes code back
- Tokens stored in google extension's scoped storage (`extensions/google/tokens.json`)
- Provides Calendar peek (today's events) + focus (week view)
- Exposes agent tools: `list_events`, `create_event`, `search_emails`
- Also serves as the v1 backup provider for the Backup Layer

### Agent Sidebar (MCP-Compatible)
- Each extension optionally exports `agentTools` (callable functions) and `agentResources` (readable data)
- At startup, agent aggregates all tools and resources from loaded extensions
- Sidebar: scrollable chat + streaming token display + input field
- Tool calls executed in-process (no network MCP server needed v1)
- AI provider is configurable; streamed via provider SDK

### Theme System
- Inspired by [base16](http://chriskempson.com/projects/base16/) and [Catppuccin](https://github.com/catppuccin/catppuccin)
- Theme object: `{ base, surface, overlay, text, subtext, accent, error, warning, success }`
- Applied via `useTheme()` hook; every Ink component uses theme tokens, never raw ANSI codes
- Built-in themes: `catppuccin-mocha`, `dracula`, `nord`, `gruvbox-dark`, `solarized-dark`
- Custom themes: place a YAML file in `~/.config/mycli/themes/` and reference by filename

---

## Ecosystem Research Findings

### Prior Art Survey

| Tool | Stack | Plugin model | Key lesson |
|---|---|---|---|
| **wtfutil** | Go | Static compile-time | Proved massive demand for configurable personal dashboards. Fatal flaw: adding a module requires cloning repo + recompiling. Your npm-installable extension system is literally what wtfutil users have been asking for. |
| **blessed-contrib** | Node.js | None | Grid API (`grid.set(row, col, rowSpan, colSpan, WidgetClass)`) is a clean tile-positioning model. Anti-pattern: all widgets baked into binary. |
| **oclif** | Node.js | Production-proven | The definitive Node.js CLI plugin framework. Used by Heroku CLI, Shopify CLI, Salesforce CLI. Manifest-cached plugin discovery, resolution order (user > dev > core), lifecycle hooks. |
| **OpenCode** | Bun + OpenTUI | Partial | Most directly relevant. Uses OpenTUI slot registry in production. UI plugin system explicitly listed as "planned but not implemented." Your dashboard does what OpenCode hasn't done yet. |
| **Lazygit/Lazydocker** | Go | N/A | Gold standard TUI UX. LIFO context stack, 3-state panel zoom (peek → focus → fullscreen), number keys 1–N for panel jump, j/k navigation everywhere. |
| **VSCode** | Electron | Battle-tested | Best extension manifest schema design. `contributes`, `activationEvents`, `when` clauses, `engines` version check. Direct model for `extension.json`. |

### `createReactSlotRegistry` — Confirmed API Shape

```typescript
type Slots = {
  peek:    { extensionId: string; width: number; height: number }
  focus:   { extensionId: string }
  sidebar: {}
}
const registry = createReactSlotRegistry<Slots, AppContext>(renderer, hostContext)

// Extension registers
registry.register({
  id: "tasks",
  slots: {
    peek:  (ctx, props) => <TasksPeek  {...props} />,
    focus: (ctx, props) => <TasksFocus {...props} />,
  },
})

// Host renders a slot
<Slot registry={registry} name="peek" mode="append" />
```

Slot modes: `append` (all extensions render, stacked), `replace` (last wins), `single_winner` (first wins).
Built-in **per-plugin error boundaries** — one crashing extension doesn't kill the dashboard.
`registry.onPluginError(cb)` for logging.

### Extension Manifest — Recommended Schema (VSCode + oclif patterns)

```json
{
  "id": "tasks",
  "name": "Task List",
  "version": "1.0.0",
  "description": "Keyboard-driven task management with categories",
  "engines": { "mycli": "^1.0.0" },
  "outputType": "react-component",
  "main": "./dist/index.js",
  "contributes": {
    "views": { "peek": true, "focus": true },
    "commands": [
      { "id": "tasks.add",       "title": "Add Task",       "category": "Tasks" },
      { "id": "tasks.complete",  "title": "Complete Task",  "category": "Tasks" }
    ],
    "keybindings": [
      { "command": "tasks.add", "key": "a", "when": "focus.activeExtension == 'tasks'" }
    ],
    "agentTools":      ["list_tasks", "add_task", "complete_task"],
    "agentResources":  ["tasks_summary"],
    "configuration": {
      "defaultCategory": { "type": "string", "default": "inbox" }
    }
  },
  "storage": { "type": "filesystem" },
  "activationEvents": ["onView:peek", "onView:focus"]
}
```

Key fields borrowed from oclif: `engines.mycli` version check via `semver.satisfies()`.
Key fields borrowed from VSCode: `contributes`, `activationEvents` (lazy load — manifest is read at startup, extension code only `import()`'d when first activated), `when` clauses on keybindings.

### Navigation UX — Adopt Lazygit's Model

- **Number keys 1–N**: jump to specific peek tiles (lazygit's panel navigation)
- **Enter**: peek → focus (3-state zoom: peek → focus → fullscreen if supported)
- **Escape**: pop LIFO context stack — focus → peek → command palette close → etc.
- **Tab / arrow**: cycle between peek tiles in dashboard mode
- **j/k**: vim-style navigation within the active focused extension
- **LIFO context stack**: each navigation push creates a context; Escape always pops. Temporary contexts (command palette, modals) are auto-collapsed when a non-temporary is pushed.

### Useful npm Packages Identified

| Package | Purpose |
|---|---|
| `fzf` | Fuzzy matching for command palette (the actual fzf algorithm in JS) |
| `xdg-app-paths` | XDG-compliant scoped storage paths per extension (`~/.local/share/mycli/extensions/<id>/`) |
| `zod` | Config + manifest schema validation |
| `semver` | Extension `engines.mycli` version compatibility checks |
| `conf` | Typed persistent config with schema validation (used by many Ink-based tools) |
| `@oclif/plugin-plugins` | Reference implementation for `mycli ext install` command |

### Gaps This Project Fills (Nothing Else Does This)

1. **No Node.js TUI dashboard with npm-installable widget extensions** — wtfutil proved the demand; nobody has done it in Node.js with runtime loading
2. **No "peek + focus" dual-view extension contract** — formalized dual-view is novel
3. **No OpenTUI-based app with a published extension marketplace** — OpenTUI has the slot machinery; nobody has shipped a user-facing layer on top of it
4. **No personal productivity TUI with AI sidebar + extension tool protocol** — OpenCode does AI but is a coding assistant, not a personal dashboard

### Anti-Patterns to Avoid

| Anti-pattern | Why |
|---|---|
| Activate all extensions on startup | Kills startup time — use `activationEvents` from manifest, lazy `import()` |
| Extensions construct their own storage paths | No cleanup on uninstall, cross-extension access possible — host provides scoped paths |
| Flat global keybinding namespace | Conflicts inevitable — require `when` clause scoping to `focus.activeExtension` |
| Synchronous extension loading | Blocks render loop — all extension `import()` must be async |
| Cache secrets in manifest | Use oclif's `noCacheDefault` pattern for sensitive config defaults |
| Extensions can call `createCliRenderer()` | Breaks the renderer singleton — document clearly, validate at registration time |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Silvery is younger than Ink — API may shift | M | M | 99% Ink compatible — can swap back to Ink with minimal changes; slot engine is the stable API surface for extensions |
| `stdout` extension silent failures (non-zero exit, no output) | L | M | Capture stderr; render error state in slot with exit code; `refresh` skips if previous run errored |
| Marketplace extension security (arbitrary code execution) | H | H | v1: only built-in extensions; marketplace installs require explicit user confirmation; manifest validation |
| Plugin API breaking changes as app evolves | H | M | Strict semver on `AppContext` interface; extensions declare compatible `cliVersion` in manifest |
| Google OAuth UX awkward in terminal | M | M | Device code flow is the standard CLI pattern; well-documented |
| StorageAPI path escaping / traversal | L | H | All paths normalized and validated against the scoped root before any FS operation |
| Backup conflicts (multiple devices) | M | M | Last-write-wins for v1; add conflict detection in a later spec |
| Keybind conflicts between extensions | M | M | Keys are context-scoped: global keys vs. active-extension keys; manifest declares scope |

---

## Open Questions — Resolved

1. **Extension loader isolation**: Same process, `import().then()` style (dynamic async import, promise-chained rather than top-level `await`/`require`). Preserves shared React instance across host + extensions.
2. **stdout output format**: Wrapped in a dedicated text node (not raw `<Text>` passthrough) — output gets its own wrapper component in the slot so styling/error framing stays consistent regardless of ANSI content.
3. **Agent sidebar width**: Fixed presets — `wide` / `narrow` / `closed`. No free-form resize in v1; forward-compatible to arbitrary resizing later.
4. **Focus view transition**: No animation. Popup / colored-frame treatment to indicate focus state instead.
5. **Keybind scope model**: Ordered resolution — **focused element → local (active extension) → global**. Implemented as a keyboard-capture wrapper per scope level: each level can consume a keypress or let it delegate upward the tree (bubble to parent scope), rather than a flat "handled/not handled" dispatch.

---

## Recommended Direction

**Node.js 26 + OpenTUI (@opentui/react) + bash launcher wrapper.**

Decision rationale: The `--experimental-ffi` flag is entirely encapsulated in a bash wrapper script — users never see it. The remaining risk (3-week Node.js FFI burn-in) is accepted as an early-adopter tradeoff for a tool that can be patched quickly. OpenTUI's `createReactSlotRegistry` is the purpose-built marketplace plugin API this project needs. The team backing (anomalyco, 110 contributors, production via OpenCode) is the strongest of the three options.

### Tech Stack
- **Runtime**: Node.js 26.3.0+
- **TUI Framework**: `@opentui/react` + `@opentui/core`
- **Launch**: bash wrapper — `node --experimental-ffi --allow-ffi dist/index.js "$@"`
- **Plugin architecture**: `createReactSlotRegistry` for marketplace extension slots
- **Extension loading**: dynamic `import()` + React slot registry; extensions are standard TS modules with `peerDependencies: { react, @opentui/react }`
- **Language**: TypeScript (Node.js 26 native type-stripping, no tsc needed)
- **Config**: Zod-validated YAML
- **Storage**: Scoped filesystem per extension via `StorageAPI`

### v1 Build Plan
1. **Core framework**: OpenTUI app (`createCliRenderer` + `createRoot`), `createReactSlotRegistry` for named slots (`dashboard-grid`, `focus-pane`, `sidebar`, `palette-overlay`, `statusbar`), AppContext, StorageAPI, keybind dispatcher (`useKeymap` + `KeymapProvider`), config loader (Zod-validated YAML), theme system (ThemeContext — build ourselves, OpenTUI has no semantic token system)
2. **Extension loader**: Reads `extension.json` manifest, validates peer deps, dynamic `import()` of entry point, registers `peek`/`focus` components into slot registry. `stdout` support deferred to v1.1.
3. **Tasks extension** (built-in): CRUD tasks with categories, peek (count summary + overdue badge), focus (full list, keyboard CRUD), scoped JSON storage
4. **Notes extension** (built-in): Markdown-lite note list, peek (3 recent notes), focus (note viewer + simple editor), scoped JSON storage
5. **Agent sidebar** (built-in): Toggleable, aggregates extension tools/resources, configurable AI provider, streaming chat
6. **Marketplace groundwork**: Extension manifest schema validated at load time; loader handles both built-in and installed extensions from day 0
7. **Command palette**: Build on top of OpenTUI primitives (no built-in) — Input + filtered list + `InputLayer` overlay (~150 lines)

### What to Build vs What's Provided
| Feature | OpenTUI provides | Must build |
|---|---|---|
| Slot registry (marketplace) | `createReactSlotRegistry` ✅ | — |
| Layout engine | Yoga flexbox ✅ | — |
| Keyboard/input | `useKeymap`, `KeymapProvider` ✅ | — |
| Focus management | Native Zig focus ✅ | — |
| Mouse support | ✅ | — |
| React DevTools | ✅ | — |
| Command palette | ❌ | ~150 lines |
| SplitView (dashboard + sidebar) | ❌ | ~100 lines using Box flex |
| Semantic theming | ❌ | ThemeContext + token system |
| Scrollable lists | ScrollBox ✅ | — |
| Diff/code views | ✅ (tree-sitter) | — |

### Deferred
- Google Calendar / Gmail extension (needs OAuth; follow-up spec)
- Backup to Google Drive (depends on Google extension)
- `stdout` extension runtime (v1.1)
- Actual marketplace registry + `mycli ext install` command (v1.2)
- Resizable sidebar, animated transitions
- SQLite storage upgrade path
- Switch to Bun if Node.js FFI instability becomes a recurring problem
