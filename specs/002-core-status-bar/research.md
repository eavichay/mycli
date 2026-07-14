# Research: Contextual Status Bar with Reserved Keys

## 1. Canonical key identifier format (modifier-aware)

**Decision**: Introduce a canonical key-id string format — modifiers in a fixed order (`ctrl+`, `meta+`, `shift+`, `option+`), followed by the lowercase base key name, e.g. `ctrl+q`, `shift+tab`, `q`. A shared `canonicalKeyId(key: KeyEvent): string` function computes this from OpenTUI's `ParsedKey`/`KeyEvent` fields (`ctrl`, `meta`, `shift`, `option`, `name`), and every place a key is identified — manifest `keybind` strings, the reserved-keys list, global command declarations, and status-bar hint keys — uses this same canonical form.

**Rationale**: `001-core-tasks-bootstrap`'s `useScopeCommands` dispatch handler currently keys its command map purely by `key.name` (e.g. `"q"`, `"space"`, `"escape"`), with no modifier awareness. This feature's central ask — "Ctrl+Q reserved for quit" — cannot be expressed or enforced without a modifier-aware identifier; `q` and `ctrl+q` must be distinguishable both when *matching* a keypress and when *declaring* a command (manifest keybind, reserved-key membership, or a status-bar hint).

**Alternatives considered**: Special-casing only `ctrl` for this feature (since it's the only modifier currently needed) — rejected, because the reserved-keys list is explicitly designed to grow (per spec Assumptions), and a half-generalized solution would need revisiting the moment a `shift+` or `meta+` reserved key is added. Better to generalize once, now, while touching this code anyway.

## 2. Where the quit command lives, and its key

**Decision**: Move quit out of `App.tsx`'s ad hoc `useGlobalKeybinds({ q: ... })` call into a new, explicit `GLOBAL_COMMANDS` list (see #3) and rebind it from `q` to `ctrl+q`, matching the terminal-convention meaning the spec's own example assumes.

**Rationale**: The spec's User Story 5 and the feature's motivating example both anchor on "Ctrl+Q for quit" as the first reserved key — the reserved-keys mechanism only has real teeth if the key it protects is actually the one a global command uses. Leaving quit on plain `q` while separately reserving `ctrl+q` (unused by anything) would make the example hollow and the tests unable to demonstrate the actual protection.

**Alternatives considered**: Keep quit on `q`, reserve `ctrl+q` as a *second*, currently-unused global command (e.g. an alias for quit) — rejected as needless indirection; simpler to have exactly one quit binding, on the reserved key, matching user intent directly.

**Impact**: Every existing test in `001-core-tasks-bootstrap` that presses `"q"` to simulate quitting (`dashboard-shell.test.tsx`, `fault-isolation.test.tsx`, `keybind-scoping.test.tsx`) must be updated to press `ctrl+q` (via the mock input's modifier argument) instead. This is a required, planned side-effect of this feature, not a regression — captured in tasks.md.

## 3. Structured global commands registry

**Decision**: Replace `App.tsx`'s inline `useGlobalKeybinds({...})` object literal with a declarative list: `GlobalCommand[] = [{ key: "ctrl+q", label: "Quit", action }, { key: "return", label: "Open", action }, { key: "escape", label: "Back", action }]`, defined once in a new `src/core/globalCommands.ts`. `App.tsx` derives both the `useGlobalKeybinds` command map (key → handler) and the status bar's default global-hints list from this single source of truth.

**Rationale**: FR-001 requires the status bar to display "the set of currently active global commands and their keys" — this requires a structured, introspectable list, not just a bag of closures. A single declarative source avoids the two ever drifting out of sync (e.g. a key registered for dispatch but never shown as a hint, or vice versa).

**Alternatives considered**: Deriving hint labels from a separate, hand-maintained map keyed by the same strings used in `useGlobalKeybinds`'s object — rejected, this is exactly the duplication FR-001 (structured display) is meant to avoid.

## 4. How a focused extension supplies hints/messages ("the context object")

**Decision**: Extend `ExtensionActivationContext` (already passed to every extension's `activate()` function at load time, per `001-core-tasks-bootstrap`'s loader) with a `statusBar` property: `{ setHints(hints: { key: string; label: string }[]): void; setMessage(message: string | null): void; clear(): void }`. The extension captures this object in its module-level closure (the same pattern Tasks already uses for `store` in `createFocusView(store)`) and calls `statusBar.setHints(...)` / `setMessage(...)` from within its `FocusView`'s own event handlers (e.g. on mode change) — no new React context or hook is introduced.

**Rationale**: This matches the established activation pattern exactly — extensions already receive a context object once, at `activate()` time, and close over whatever they need (registry, storage, and now the status bar API) rather than consuming ambient React context inside their view components. It requires no new plumbing through `App.tsx`'s component tree, and keeps `ExtensionViewComponent`'s `() => ReactNode` signature (zero props) unchanged.

**Alternatives considered**: A React context (`StatusBarContext`) consumed via a `useStatusBar()` hook inside `FocusView` — rejected as a second, inconsistent mechanism for extensions to reach host services, when the existing activation-context pattern already solves this identically for `registry` and `host`.

**Enforcement of FR-005 (clear on exit)**: The host (not the extension) is responsible for clearing whatever the focused extension set, at the moment focus is lost — `App.tsx` calls `statusBar.clear()` itself when `activeExtensionId` transitions away from an extension, rather than trusting every extension to clean up after itself on unmount. This makes FR-005 a host-owned guarantee, not an extension convention that could be forgotten.

## 5. Reserved-key enforcement points

**Decision**: Two enforcement points, matching the spec's two attack surfaces (manifest + runtime):
1. **Manifest-load time** (FR-009): `validateManifest`'s existing Zod schema gains a `.refine()` check that filters `commands[]` entries whose canonical `keybind` is in the reserved-keys list *out* of the manifest before the loader ever registers them — the extension still loads successfully (per FR-009/SC-004), just without that one command.
2. **Runtime hint API** (FR-011): the `statusBar.setHints()` implementation (see #4) silently drops any hint entry whose `key` canonicalizes to a reserved key before it's stored, so a reserved key can never appear as "belonging to" the focused extension no matter what it passes in.

**Rationale**: These are the exact two places the spec's User Story 5 describes an extension "declaring" a reserved key — via its manifest, or via runtime customization. Filtering at the boundary (drop-and-continue) rather than rejecting the whole manifest/call matches FR-009's explicit requirement that the extension's other valid commands still register.

**Alternatives considered**: Failing manifest validation entirely if a reserved key is declared — rejected, directly contradicts FR-009 and SC-004 ("reserved-key enforcement never prevents an otherwise-valid extension from loading").

## 6. Status bar rendering: merge, truncation-exemption, and layout

**Decision**: A new `StatusBar.tsx` component (registered by the host into the existing `statusbar` slot, replacing nothing — the slot itself is unchanged per Assumptions) computes, on every render: `reservedHints` (always shown in full) + `extensionHints` (focused extension's custom or manifest-derived hints, capped to fit) + `unclaimedGlobalHints` (global commands whose key isn't overridden by the focused extension) + `message` (focused extension's custom message, if any) — concatenated left-to-right, truncated as a whole to the terminal's available width via a single width-budget pass: reserved hints are rendered first and never cut; remaining content is joined and truncated (via a shared truncation helper, `text-based`, not word-wrap) to whatever width remains.

**Rationale**: Directly implements the resolved Clarifications (merge, message+hints coexist, reserved-hints truncation-exempt) as one deterministic layout algorithm, avoiding ad hoc per-case logic scattered across the component.

**Alternatives considered**: Giving the message and hints separate fixed-width sub-regions of the status bar — rejected, over-engineered for a single-line bar and would waste width when one side is empty.

## Summary of resolved unknowns

| Area | Resolution |
|---|---|
| Modifier-aware key identity | New `canonicalKeyId()` helper; `ctrl+`/`meta+`/`shift+`/`option+` prefix + lowercase name |
| Quit keybinding | Moves from `q` to `ctrl+q`; existing tests updated accordingly |
| Global commands | Structured `GlobalCommand[]` list in `src/core/globalCommands.ts`, single source for dispatch + hint display |
| Extension hint/message API | New `statusBar` property on the existing `ExtensionActivationContext`, closure-captured like `store` |
| Clearing on focus exit | Host-owned (`App.tsx` calls `statusBar.clear()`), not an extension responsibility |
| Reserved-key enforcement | Manifest-load filter (Zod refine, drop-and-continue) + runtime `setHints()` filter |
| Status bar layout | New `StatusBar.tsx`; reserved hints always shown, everything else truncated to fit |
