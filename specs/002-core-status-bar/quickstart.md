# Quickstart: Validate Contextual Status Bar with Reserved Keys

## Prerequisites

- Everything from `001-core-tasks-bootstrap`'s quickstart (Node.js 26.3.0+, `npm install`, launch via `./bin/mycli`)
- This feature is additive; no new fixtures are required beyond `001-core-tasks-bootstrap`'s `fixtures/tasks-only.yaml`

## Scenario 1 — Global hints on the empty dashboard (User Story 1)

```bash
./bin/mycli --config ./fixtures/tasks-only.yaml
```

1. On launch, before pressing anything, look at the status bar.
2. **Expected**: it lists the global commands and their keys, including `Ctrl+Q: Quit`.
3. Press `Return` to focus Tasks, then `Escape` to return to the dashboard.
4. **Expected**: the status bar reverts to the same global-only display it showed at launch.

## Scenario 2 — Manifest-derived default hints (User Story 2)

1. From the dashboard, press `Return` to focus the Tasks extension.
2. **Expected**: the status bar shows Tasks' manifest-declared commands (`a: add`, `d: delete`, `e: edit`, `space: toggle complete`, `c: toggle hide-completed`) — derived from `extension.json`, not hand-written by the FocusView.
3. **Expected**: the status bar *also* still shows `Esc: Back` (an unclaimed global hint) merged alongside Tasks' hints.

## Scenario 3 — Extension customizes its own hints (User Story 3)

1. With Tasks focused, press `a` to enter add-task mode.
2. **Expected**: the status bar's hints change to reflect the add-task flow (e.g. `Return: submit`, `Esc: cancel`) instead of the manifest defaults — set via `ctx.statusBar.setHints(...)` from within `FocusView`.
3. Press `Escape` to cancel back to the task list.
4. **Expected**: the status bar reverts to Tasks' manifest-derived default hints (the customization does not persist).

## Scenario 4 — Focused hints override global hints for the same key (User Story 4)

1. Configure (for this validation only) a non-reserved key that both a global command and Tasks bind to (e.g. temporarily rebind Tasks' hide-completed toggle to whatever key a global command also uses).
2. Focus Tasks.
3. **Expected**: the status bar shows only Tasks' hint for that key, and pressing it performs Tasks' action, not the global one.
4. Leave the focus view.
5. **Expected**: the status bar shows the global command's hint for that key again, and pressing it performs the global action.

## Scenario 5 — Reserved keys can never be claimed (User Story 5)

```bash
# Using a test extension whose manifest declares a command on ctrl+q alongside otherwise-valid commands
```

1. Load an extension whose manifest includes a command bound to `ctrl+q`.
2. **Expected**: the extension loads successfully; its other commands work normally.
3. Focus that extension and press `Ctrl+Q`.
4. **Expected**: the app quits (the global/reserved action fires) — the extension's declared command for that key never registers.
5. **Expected**: the status bar never shows `ctrl+q` as belonging to that extension, even if it attempts `setHints()` with that key.

## Automated validation

```bash
npm test
```

Expected: all `001-core-tasks-bootstrap` tests still pass (with quit-key assertions updated to `ctrl+q`, per `research.md` §2), plus new tests covering: global-hint display, manifest-default hint display, runtime hint/message customization and its clearing on focus-exit, focused-overrides-global display, unclaimed-global-hints merging, reserved-key manifest filtering, reserved-key runtime hint filtering, and truncation with reserved-hint exemption.
