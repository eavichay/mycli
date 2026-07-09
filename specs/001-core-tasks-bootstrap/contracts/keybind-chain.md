# Contract: Keybind Resolution Chain

Implements FR-006 and constitution Principle IV: every keypress resolves through a fixed, three-level chain — `focused` → `local` (active extension) → `global` — with no level skippable and no flat "handled" boolean.

## Levels

1. **Focused**: bound only while a specific focusable UI element (e.g. a list item, a text input) has focus. Highest precedence.
2. **Local**: bound only while an extension's focus view is the active view (e.g. the Tasks focus view). Declared via the extension's `commands[].keybind` in its manifest.
3. **Global**: always bound at the app root (e.g. quit, dashboard navigation). Lowest precedence — only sees keys no more specific level claimed.

## Resolution contract

- Each level's handler returns whether it claimed the key.
- If a level claims the key, no lower-precedence level is invoked (constitution: "stopping at the first scope that handles the key").
- If a level does not claim the key, resolution continues to the next level down.
- A key with no claimant at any level is a no-op.

## Verification points (SC-004)

- A keybind declared in the Tasks extension's `local` scope (e.g. `a` for `tasks.add`) MUST NOT trigger `tasks.add` when the same key is pressed while the dashboard is active and no extension is focused (Acceptance Scenario, User Story 4).
- Two keybinds at different scopes claiming the same key: the more specific (focused, then local) scope always wins; the global handler never receives that key (Edge Cases).
