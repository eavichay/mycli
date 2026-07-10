# Research: Core Framework Bootstrap via Tasks Extension

## 1. Renderer & slot composition (`@opentui/react`)

**Decision**: Use `createCliRenderer()` (from `@opentui/core`) once at the host entrypoint, feed it into `createReactSlotRegistry<Slots, AppContext>(renderer, context)`, and expose four typed slots: `grid`, `sidebar`, `statusbar`, `overlay`. Extensions contribute React nodes to these slots via `registry.register({ id, slots: { grid(ctx, props) {...} } })`; the host renders each with `<Slot registry={registry} name="grid" mode="append">`.

**Rationale**: This is the actual API surface OpenTUI ships (confirmed via docs: `createReactSlotRegistry`, `Slot`, `createRoot`). It matches Constitution Principle I (host owns the one renderer; extensions never call `createCliRenderer`) and Principle II (extensions only ever get a slot-registration callback, never a raw renderer handle).

**Fault isolation tie-in**: `<Slot>` already accepts a `pluginFailurePlaceholder` prop — this is the mechanism for FR-014/SC-005 (an extension that throws during render degrades to an error placeholder in its own slot without affecting siblings). Combined with a per-slot React error boundary, this satisfies Principle V without bespoke isolation code.

**Alternatives considered**: Hand-rolling a slot registry — rejected, duplicates what the renderer library already provides and risks violating Principle I/II by accident.

## 2. Keybind resolution chain

**Decision**: Use `@opentui/react`'s `useKeyboard(handler, options?)` hook at three levels, each wrapping the next: a focused-element-level hook (only mounted while a specific input/list item has focus), a local hook (only mounted while an extension's focus view is active), and one global hook (always mounted at the app root). Each handler explicitly returns a "handled" signal; if a level's handler does not claim the key, the app-level dispatcher passes the raw key event to the next level down. No single flat boolean — each scope's capture function is inspectable in isolation, per Constitution Principle IV.

**Rationale**: `useKeyboard` is OpenTUI's real primitive for key events (confirmed via docs, including release-event support via `{ release: true }`). Layering three mount-gated instances of this hook — rather than a single global listener with an if/else ladder — gives the "fixed, inspectable chain" the constitution requires, and mounting/unmounting naturally reflects which scopes are "active" (e.g., the local hook only exists while the Tasks focus view is mounted).

**Alternatives considered**: Single global `useKeyboard` with manual scope-priority branching in one function — rejected, becomes an ad hoc if/else ladder that's exactly what Principle IV prohibits ("no flat handled boolean").

## 3. Extension manifest & lazy loading

**Decision**: Extension identity/capabilities live in `extension.json`, validated with a Zod schema before any of the extension's TypeScript is executed. Extension code (the module registering views/commands) is loaded via `import()` only when its declared `activationEvents` fire (e.g. `onSlot:grid`, `onCommand:tasks.add`) — never eagerly at process startup, per the Development Workflow section of the constitution.

**Rationale**: Directly satisfies "manifest-first loading" and "no built-in shortcut" workflow rules. Built-in extensions (Tasks) go through this exact same manifest + `import()` + slot-registration path as any marketplace extension would.

**Alternatives considered**: `require()` or worker-thread loading — explicitly forbidden by Principle II (breaks the shared React/OpenTUI instance guarantee, or is memory-unsafe across processes).

## 4. Storage scoping

**Decision**: `StorageAPI` is a narrow interface (`get`, `set`, `delete`, `list`) handed to each extension via `AppContext`. The host resolves a real filesystem path internally as `<data-root>/extensions/<extension-id>/` (data root: `os.homedir()/.mycli/`, overridable for tests), JSON-serializing values to files. Extensions never see this path — they only see the `StorageAPI` object and their own keys.

**Rationale**: Matches Principle III exactly ("MUST NOT construct or receive raw filesystem paths"; "host is solely responsible for path scoping"). Filesystem+JSON matches the constitution's stated current storage tier ("Filesystem-backed, scoped per extension"), and keeps a future SQLite-backed StorageAPI (mentioned as a possible future upgrade) a drop-in replacement since extensions only ever see the interface, not the backing store.

**Alternatives considered**: Handing extensions a scoped directory path directly — rejected, this is the exact anti-pattern Principle III rules out.

## 5. Config format

**Decision**: Any host-level configuration (e.g. which extensions are enabled) is authored as YAML and parsed with the `yaml` package, then validated against a Zod schema before use — matching the constitution's "Zod-validated YAML is the only supported configuration format."

**Rationale**: Direct constitution requirement, not a judgment call.

## 6. Testing approach

**Decision**: Use Node.js's built-in test runner (`node:test` + `node:assert`) for all framework-level and Tasks-extension logic tests (keybind chain resolution, manifest validation, StorageAPI scoping). For React/UI-level tests (slot rendering, peek/focus view content, keyboard-driven interaction), use `@opentui/react`'s own `testRender()` (built on `createTestRenderer` from `@opentui/core/testing`), which mounts a real React tree against a mock terminal and exposes `captureCharFrame()` and `mockInput` for simulating keypresses.

**Rationale**: `node:test` requires no additional dependency and no build step, consistent with the constitution's "no separate `tsc` build step" stance (Node 26.4.0 confirmed available locally, satisfies the 26.3.0+ requirement). `testRender`/`createTestRenderer` are OpenTUI's own headless testing utilities (confirmed via docs), which is exactly the "headless/testing-library-style" approach the constitution asks for over manual terminal verification.

**Alternatives considered**: Vitest/Jest — rejected as an unnecessary added dependency and build-tooling surface when `node:test` covers the same need natively.

## Summary of resolved unknowns

| Area | Resolution |
|---|---|
| Language/runtime | TypeScript, Node.js native type-stripping, Node.js 26.3.0+ (26.4.0 available) |
| Renderer/UI | `@opentui/core` + `@opentui/react`, `createReactSlotRegistry`, `Slot`, `useKeyboard` |
| Config format | YAML parsed via `yaml`, validated via `zod` |
| Storage | Filesystem JSON, host-resolved path per extension, exposed only via `StorageAPI` |
| Testing | `node:test` (framework/logic) + `@opentui/react` `testRender`/`createTestRenderer` (UI/keyboard) |
| Manifest loading | `extension.json` + Zod validation before any `import()` of extension code |
