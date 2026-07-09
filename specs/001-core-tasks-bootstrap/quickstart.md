# Quickstart: Validate Core Framework Bootstrap via Tasks Extension

## Prerequisites

- Node.js 26.3.0+ (`node --version`)
- Repo dependencies installed (`npm install`)
- Launch via the project's bash wrapper (encapsulates `--experimental-ffi`; see project README once added)

## Scenario 1 — Empty dashboard shell (User Story 1)

```bash
# launch with zero extensions enabled (e.g. empty extensions list in config)
./bin/mycli --config ./fixtures/no-extensions.yaml
```

**Expected**: Terminal shows grid, sidebar, and status bar regions, all empty. Press the quit key (`q` by default) — app exits cleanly, terminal control returned.

## Scenario 2 — Add, view, complete, persist a task (User Story 2)

```bash
./bin/mycli --config ./fixtures/tasks-only.yaml
```

1. Press `a` (add task), type a title, confirm.
2. Confirm the Tasks peek tile's count increments.
3. Press the activation key to open the Tasks focus view — confirm the new task is listed with its incomplete state.
4. Press `space` on the task to mark it complete — confirm both focus and peek views update immediately.
5. Quit and relaunch with the same config.

**Expected**: The task and its completed state are still present (SC-002).

## Scenario 3 — Peek → focus → back navigation (User Story 3)

1. From the dashboard, select the Tasks tile, press the activation key.
2. **Expected**: Main area swaps to a framed/highlighted focus view (no animation).
3. Press the back key.
4. **Expected**: Returns to the dashboard; total keypresses each direction ≤ 2 (SC-003).

## Scenario 4 — Scoped keybind resolution (User Story 4)

1. Inside the Tasks focus view, press `a` — confirm "add task" triggers.
2. Return to the dashboard (no extension focused), press `a` again.
3. **Expected**: `tasks.add` does NOT trigger (SC-004). Either nothing happens or an unrelated global action fires.

## Scenario 5 — Fault isolation (SC-005)

```bash
# deliberately break the Tasks extension's manifest
./bin/mycli --config ./fixtures/tasks-broken-manifest.yaml
```

**Expected**: Dashboard still renders; Tasks tile shows a load-error state; other tiles, status bar, and quit remain fully usable.

## Scenario 6 — Task delete, edit, due-date sort, hide-completed toggle

1. Add three tasks: one with a near due date, one with a far due date, one with no due date.
2. Open the Tasks focus view — confirm order is: near-due-date task, far-due-date task, then the undated task (by creation time).
3. Edit the undated task to add a due date between the two existing ones — confirm it re-sorts into position.
4. Attempt to edit a task's title to blank/whitespace — confirm the edit is rejected and the original title remains (FR-019).
5. Attempt to set an invalid due date (e.g. malformed input) — confirm the edit is rejected with an error and the task's due date is unchanged (FR-020).
6. Mark one task complete — confirm it moves to the end of the list.
7. Toggle "hide completed" — confirm the completed task disappears from the list; toggle again — confirm it reappears in its sorted position at the end.
8. Delete a task — confirm it disappears from both focus view and peek tile count immediately, and stays gone after a relaunch.

## Automated validation

Run the framework-level and extension-level test suite:

```bash
node --test
```

Expected: keybind-chain resolution, manifest validation, StorageAPI scoping, and Tasks extension behavior (add/edit/delete/complete/sort/validation) all pass headlessly via `node:test` and `@opentui/react`'s `testRender`.
