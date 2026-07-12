# Data Model: Contextual Status Bar with Reserved Keys

## Canonical Key Id (shared primitive, not persisted)

A string of the form `[ctrl+][meta+][shift+][option+]<name>` — modifiers always in that fixed order, `<name>` lowercase (e.g. `q`, `escape`, `tab`). Computed from an OpenTUI `KeyEvent`/`ParsedKey`'s `ctrl`/`meta`/`shift`/`option`/`name` fields via a single shared `canonicalKeyId()` function. Used everywhere a key is identified: manifest `keybind` strings, reserved-keys list membership, global command declarations, and status-bar hint keys — so the same key is always spelled the same way.

## Status Bar Hint

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string (canonical key id) | yes | The key this hint describes |
| `label` | string | yes | Short text describing what the key does (e.g. `"Quit"`, `"Save"`) |

**Source**: either a focused extension's manifest-declared `commands[]` (default, per FR-002) or that extension's runtime `statusBar.setHints()` call (override, per FR-003). Never both at once for the same extension — a custom `setHints()` call fully replaces the manifest-derived default display for that extension (FR-003), though unclaimed global hints remain merged in regardless (FR-006a).

**Known limitation**: the manifest schema's `commands[]` entries have no separate friendly-label field (only `id` and `keybind`) — manifest-derived default hints currently render using the command `id` as the label (e.g. `a: tasks.add` rather than `a: Add`). This is a readability gap, not a functional one; a future manifest schema addition of a `label` field would let extensions supply a nicer default without needing to call `setHints()` just to rename their own hints.

**Validation rule**: any hint whose `key` canonicalizes to an entry in the Reserved Key list is silently dropped before being stored or displayed (FR-011).

## Status Bar Message

A single optional string (or `null`), supplied by the focused extension via `statusBar.setMessage()`. Not tied to any key. Displayed alongside (not instead of) the current hint set, sharing the status bar's available width (FR-013). Cleared automatically by the host when the extension's focus view is exited (FR-005), same as hints.

## Reserved Key

| Field | Type | Notes |
|---|---|---|
| `key` | string (canonical key id) | e.g. `ctrl+q` |
| `label` | string | Display label for the action it's reserved for (e.g. `"Quit"`) |
| `action` | function | The global handler that always fires for this key |

**Fixed list** for this feature: `[{ key: "ctrl+q", label: "Quit", action: <quit> }]`. Framework-owned, not extensible by any extension, at manifest-load time, at runtime, or in raw dispatch code (FR-007). Designed to grow later without requiring changes to how extensions check for or avoid reserved keys (spec Assumptions) — extensions never need to know the list's contents; three enforcement points do all the work: the manifest filter, the runtime hint filter, and a dispatch-registration filter (added during implementation — see `contracts/reserved-keys.md` "Enforcement point 3") that stops an extension's own code from claiming a reserved key directly, bypassing the first two.

**Invariant**: no extension's manifest `commands[]` entry, and no extension's runtime `setHints()` call, may ever result in a reserved key being registered or displayed as belonging to that extension (FR-009, FR-011). Reserved-key hints are always rendered in full and are exempt from status-bar truncation (FR-012).

## Global Command

| Field | Type | Notes |
|---|---|---|
| `key` | string (canonical key id) | e.g. `return`, `escape` |
| `label` | string | e.g. `"Open"`, `"Back"` |
| `action` | function | The handler registered at global keybind scope |

**Fixed list** for this feature (`src/core/globalCommands.ts`): quit (`ctrl+q`, reserved), open/activate focus view (`return`), back to dashboard (`escape`). Single source of truth for both `useGlobalKeybinds`'s dispatch map and the status bar's default (no-extension-focused) hint display (FR-001), and for the "unclaimed global hints" merged into a focused extension's display (FR-006a).

## Status Bar Display State (derived, not persisted)

Computed fresh on every render from three inputs — no independent state of its own:
1. `activeExtensionId` (from `App.tsx`'s existing navigation state)
2. The focused extension's current hints/message (from the `statusBar` context object's held state) or, absent a customization, its manifest `commands[]` (FR-002)
3. `GLOBAL_COMMANDS`, filtered to exclude any key the focused extension has claimed (FR-006, FR-006a)

Rendering order (left to right, width-budgeted): reserved-key hints (always shown in full) → remaining hints (extension + unclaimed global) and message, truncated together to fit whatever width remains (FR-012, FR-013).
