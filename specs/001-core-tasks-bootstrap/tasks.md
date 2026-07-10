# Tasks: Core Framework Bootstrap via Tasks Extension

**Input**: Design documents from `/specs/001-core-tasks-bootstrap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution requires automated coverage of framework-level behavior (slot registry, keybind resolution chain, storage scoping) before any extension may depend on it, and quickstart.md defines the integration scenarios each story must satisfy.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 P1, US2 P1, US3 P2, US4 P2) so each can be implemented and independently verified per its Independent Test.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to its user story (US1–US4); omitted for Setup/Foundational/Polish
- Per `plan.md`'s Triage Framework, tasks touching Principles I/II/III/IV (renderer, keybind chain, manifest loader, StorageAPI) and the task-store's validation edge cases warrant a human (SYNC) review pass before merge; all others are safe to delegate (ASYNC). This classification is advisory, not part of the task ID.

## Path Conventions

Single project: `src/`, `tests/` at repository root, per plan.md's Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization per plan.md's Technical Context

- [X] T001 Update `package.json`: add `@opentui/core`, `@opentui/react`, `zod`, `yaml` as dependencies, set `"engines": {"node": ">=26.3.0"}`, add a `"test": "node --test"` script — implemented via `tsx` (see note below)
- [X] T002 [P] Create the source/test directory skeleton per plan.md: `src/core/keybinds/`, `src/core/storage/`, `src/core/extensions/`, `src/extensions/tasks/`, `src/cli/`, `tests/unit/`, `tests/integration/`, `tests/contract/`
- [X] T003 [P] Add `tsconfig.json` for type-checking only (no emit — Node's native type-stripping runs `.ts` directly, no separate `tsc` build step)
- [X] T004 [P] Create `bin/mycli` bash wrapper that launches `node --experimental-ffi src/cli/index.ts "$@"` (flag MUST NOT be exposed to end users directly) — launches via `tsx`'s CLI entry, see note below

**Implementation note (discovered during T001-T004, revised after T012-T017)**: Node's native type-stripping (`--experimental-strip-types`) only erases TypeScript-only syntax — it cannot transform JSX, so running `.tsx` directly under plain `node` throws a `SyntaxError`. The `tsx` CLI (`node_modules/.bin/tsx`) fixes JSX but was found to break OpenTUI's native FFI renderer entirely (`"OpenTUI native FFI is not available for this runtime yet"` — confirmed via a minimal repro: identical code succeeds under plain `node --experimental-ffi`, fails under the `tsx` CLI). The working combination, verified end-to-end (real renderer, real JSX, `node --test`): **`node --experimental-ffi --import tsx/esm`** — using `tsx`'s loader hook directly rather than its CLI wrapper avoids whatever the CLI does that breaks FFI detection. `bin/mycli`, `npm start`, and `npm test` all use this form. One caveat: this loader defaults to the classic JSX runtime rather than honoring `tsconfig.json`'s `"jsx": "react-jsx"`, so every `.tsx` file needs an explicit `import React from "react"`.

**Checkpoint**: Project scaffolding ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core framework primitives every user story depends on — renderer, slots, manifest loader, storage, keybind chain (constitution Principles I–V)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement single-renderer bootstrap in `src/core/renderer.ts` — one `createCliRenderer()` call plus `createRoot()`, exported for the CLI entrypoint only (Principle I)
- [X] T006 Implement slot registry and `HostContext`/`Slots` types in `src/core/slots.ts` using `createReactSlotRegistry<Slots, HostContext>` with `grid`, `sidebar`, `statusbar`, `overlay` slots (FR-001, FR-003; depends on T005) — named `HostContext` rather than `AppContext` to avoid colliding with `@opentui/react`'s own internal `AppContext` export
- [X] T007 [P] ~~Implement a per-slot React error boundary~~ — de-scoped: `@opentui/react`'s `<Slot>` already wraps every plugin's rendered node in its own internal `PluginErrorBoundary`, driven by the `pluginFailurePlaceholder` prop (confirmed by reading `node_modules/@opentui/react/index.js`). Folded into `DashboardShell` (T015) instead of a separate component (Principle V, FR-014)
- [X] T008 [P] Implement the extension manifest Zod schema in `src/core/extensions/manifest.ts` per `contracts/extension-manifest.md`
- [X] T009 Implement the manifest-first lazy extension loader in `src/core/extensions/loader.ts` — validates `extension.json` via T008 before any `import()`, gates the `import()` on declared `activationEvents`, and catches load/import failures into a load-error state (Principle II, Principle V, FR-002, FR-014; depends on T008)
- [X] T010 Implement `StorageAPI` in `src/core/storage/StorageAPI.ts` — `get`/`set`/`delete`/`list`, resolving `<data-root>/extensions/<id>/` internally, never exposing a path to callers; missing/corrupted backing file resolves to "no data" instead of throwing (Principle III, FR-005; per `contracts/storage-api.md`)
- [X] T011 [P] Unit test: two differently-scoped `StorageAPI` instances (e.g. `"tasks"` and `"notes"`) cannot read or write each other's keys, and a missing/corrupted backing file resolves to empty rather than throwing, in `tests/unit/storage-api.test.ts` (Principle III, FR-005; depends on T010) — 3/3 passing
- [X] T012 Implement the `focused`-scope keybind capture wrapper in `src/core/keybinds/FocusedScope.tsx` using `useKeyboard`, returning claim/delegate (Principle IV, FR-006; per `contracts/keybind-chain.md`)
- [X] T013 Implement the `local`-scope keybind capture wrapper in `src/core/keybinds/LocalScope.tsx`, only mounted while an extension's focus view is active, delegating unclaimed keys onward (depends on T012)
- [X] T014 Implement the `global`-scope keybind capture wrapper in `src/core/keybinds/GlobalScope.tsx`, always mounted at the app root, receiving only keys no more specific scope claimed (depends on T013) — completes the three-level chain. Implemented as a single shared `KeybindDispatcherProvider` (one root `useKeyboard` subscription that routes to registered focused/local/global handlers in fixed order) exported from this file, consumed by FocusedScope/LocalScope via `useScopeCommands`
- [X] T015 [P] Implement the `DashboardShell` component skeleton (grid/sidebar/statusbar/overlay regions, no navigation logic yet) in `src/core/DashboardShell.tsx` (FR-001; depends on T006, T007)
- [X] T016 [P] Implement the YAML+Zod host config loader in `src/core/config.ts` (which extensions are enabled) per the constitution's "Zod-validated YAML is the only supported configuration format"
- [X] T017 [P] Unit test keybind-chain precedence and delegation (focused claims → local never sees it; local claims → global never sees it; unclaimed key reaches global) in `tests/unit/keybind-chain.test.tsx` (depends on T012–T014) — `.tsx` not `.ts` since it needs JSX; 4/4 passing
- [X] T018 [P] Unit test manifest validation (valid manifest passes; missing `activationEvents`/malformed `id` rejected; code is never imported for an invalid manifest) in `tests/unit/manifest-validation.test.ts` (depends on T008, T009) — 6/6 passing (one extra test beyond the ones listed here: import-once-per-activation-event)
- [X] T019 [P] Contract test for the extension manifest schema in `tests/contract/extension-manifest.test.ts` against `contracts/extension-manifest.md`'s concrete Tasks manifest instance (depends on T008) — 1/1 passing

**Checkpoint**: Foundation ready — all user stories can now proceed.

---

## Phase 3: User Story 1 - Launch to an Empty Dashboard (Priority: P1) 🎯 MVP

**Goal**: Dashboard shell renders its regions with zero extensions loaded; quit key exits cleanly.

**Independent Test**: Launch the app with zero extensions configured; confirm the shell renders grid/sidebar/status-bar regions without errors and responds to a quit keypress.

### Tests for User Story 1

- [X] T020 [P] [US1] Integration test: launching with zero extensions renders all shell regions and the quit key exits cleanly, in `tests/integration/dashboard-shell.test.tsx` (uses `@opentui/core/testing`'s `createTestRenderer`) — 2/2 passing

### Implementation for User Story 1

- [X] T021 [US1] Implement `src/cli/index.ts`: load config (T016), bootstrap renderer+slot registry (T005, T006), mount `DashboardShell` (T015) wrapped in `GlobalScope` (T014), register the quit command at global scope (FR-001; depends on T005, T006, T014, T015, T016) — via `src/cli/App.tsx` + `src/cli/index.ts`
- [X] T022 [P] [US1] Add `fixtures/no-extensions.yaml` config fixture (empty extensions list) for quickstart Scenario 1

**Checkpoint**: User Story 1 fully functional and independently testable — MVP.

---

## Phase 4: User Story 2 - Manage Tasks End-to-End (Priority: P1)

**Goal**: Add, list, edit, complete, and delete tasks via keyboard, with due-date sorting, a hide-completed toggle, and full persistence across restarts.

**Independent Test**: With only the Tasks extension enabled, add a task via keyboard, confirm it appears in both the peek tile and the focus view, mark it complete, restart the app, and confirm the state persisted.

### Tests for User Story 2

- [X] T023 [P] [US2] Integration test: add → peek count updates → focus view lists it → mark complete → delete a task (removed from both peek and focus views immediately, stays gone after relaunch) → toggle hide-completed (completed tasks hidden, then shown again) → relaunch → remaining tasks and their state persisted, in `tests/integration/tasks-end-to-end.test.tsx` (FR-009, FR-010, FR-016, FR-017) — 3/3 passing (split across 3 focused tests rather than one combined scenario)
- [X] T024 [P] [US2] Unit test: task-store CRUD (add/edit/delete/toggle-complete), sort order (due-date-first, then creation time, completed last), hide-completed toggle filtering, and validation (empty/whitespace title rejected on create and edit, invalid due date rejected without mutating existing state) in `tests/unit/task-store.test.ts` — 10/10 passing

### Implementation for User Story 2

- [X] T025 [P] [US2] Define the `Task` type and field validators in `src/extensions/tasks/task-schema.ts` per `data-model.md` (title, completed, createdAt, optional dueDate; FR-015, FR-019, FR-020)
- [X] T026 [US2] Implement `src/extensions/tasks/task-store.ts`: add/edit/delete/toggle-complete against `StorageAPI` (T010), plus the sort function (due date closest-first → undated by creation time → completed always last) (FR-007–FR-010, FR-016–FR-020; depends on T025, T010) — human review pass recommended to confirm edge-case coverage against FR-015/FR-019/FR-020
- [X] T027 [P] [US2] Create `src/extensions/tasks/extension.json` per `contracts/extension-manifest.md`'s concrete Tasks instance
- [X] T028 [US2] Implement `src/extensions/tasks/PeekView.tsx`: live task-count summary for the dashboard tile (FR-011; depends on T026) — factored as `createPeekView(store)` closure over a shared `TasksReactiveStore` (`reactive-store.ts`) so peek and focus views stay in sync
- [X] T029 [US2] Implement `src/extensions/tasks/FocusView.tsx`: full sorted task list with completion state and due date, add/edit/delete/toggle-complete commands, and the hide-completed toggle, wired through `LocalScope` (T013) (FR-008, FR-009, FR-016–FR-020; depends on T026, T013) — human review pass recommended since this is the primary local-keybind integration point. Title/due-date entry uses OpenTUI's native `<input>` component (its own `focused` prop drives imperative `.focus()`/keystroke capture — this is literally the "focused" scope of Principle IV for text entry); only Escape-to-cancel is wired through `useFocusedKeybinds`
- [X] T030 [US2] Implement `src/extensions/tasks/index.tsx`: register the Tasks extension's manifest-declared peek/focus views and commands with the slot registry and loader (depends on T027, T028, T029, T009)
- [X] T031 [P] [US2] Add `fixtures/tasks-only.yaml` config fixture (Tasks extension only) for quickstart Scenario 2

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Move Between Dashboard and Task Details by Keyboard (Priority: P2)

**Goal**: Peek-to-focus navigation with a distinct framed/highlighted visual treatment (no animation), and back-key return to the dashboard.

**Independent Test**: From the dashboard, select the Tasks tile and confirm the view swaps to a framed/highlighted focus view; press the back key and confirm it returns to the dashboard.

### Tests for User Story 3

- [X] T032 [P] [US3] Integration test: activation key swaps to the framed Tasks focus view, back key returns to the dashboard, each direction in ≤2 keypresses (SC-003), in `tests/integration/focus-navigation.test.tsx` — 1/1 passing (each direction is a single keypress: RETURN / ESCAPE)

### Implementation for User Story 3

- [X] T033 [US3] Wire grid-tile activation → focus-view swap and back-key → dashboard-return navigation into `DashboardShell` (FR-012; depends on T015, T030) — implemented in `src/cli/App.tsx` (`AppInner`'s `activeExtensionId` state + global `return`/`escape` commands), not inside `DashboardShell` itself, since `DashboardShell` stays a presentational component driven by `activeExtensionId`/`focusContent` props
- [X] T034 [P] [US3] Implement `src/core/FocusFrame.tsx`: framed/highlighted visual treatment for any extension's focus view, no animation, reused by Tasks (FR-013; depends on T033) — double border box, no animation properties used

**Checkpoint**: User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Predictable Keyboard Handling Across Contexts (Priority: P2)

**Goal**: A key bound in the Tasks focus view's local scope never triggers that action when pressed on the dashboard.

**Independent Test**: Assign a key that means "add task" only within the Tasks focus view and confirm it has no effect (or a different, global effect) when pressed on the dashboard.

### Tests for User Story 4

- [X] T035 [P] [US4] Integration test: `tasks.add` key triggers inside the Tasks focus view, does NOT trigger on the dashboard, and an unclaimed key still reaches global scope (SC-004), in `tests/integration/keybind-scoping.test.tsx` — 3/3 passing

### Implementation for User Story 4

- [X] T036 [US4] Confirm/adjust Tasks' local commands (add/delete/edit/toggle-complete/hide-completed) are registered exclusively through `LocalScope` (T013), mounted only while the Tasks focus view is active (depends on T013, T029) — confirmed via `keybind-scoping.test.tsx`; `FocusView`'s `useLocalKeybinds({...}, mode.kind === "list")` is the only registration point for these five commands
- [X] T037 [US4] Confirm/adjust global commands (quit, back) are registered exclusively through `GlobalScope` (T014) and never collide with Tasks' local keybinds (depends on T014, T033) — confirmed via `keybind-scoping.test.tsx`'s third test (quit still reaches global scope from within an active focus view for a key Tasks doesn't claim)

**Checkpoint**: All four user stories independently functional — SC-004 verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the fault-isolation guarantee and close out documentation/validation

- [X] T038 [P] Integration test: a broken Tasks `extension.json` leaves the dashboard, other tiles, status bar, and quit fully usable, with the Tasks tile showing a load-error state (SC-005), in `tests/integration/fault-isolation.test.tsx`, plus `fixtures/tasks-broken-manifest.yaml` — 2/2 passing. Required adding `extraGridContent` to `DashboardShell`/`App.tsx` since a manifest/import failure never reaches `registry.register()`, so it has no slot contribution to isolate via `pluginFailurePlaceholder` alone
- [X] T039 [P] Write `README.md`: install, `bin/mycli` launch instructions, `node --test` usage
- [X] T040 Run all 6 `quickstart.md` scenarios end-to-end and confirm expected outcomes — validated via their automated headless equivalents rather than an interactive terminal launch (launching the real alternate-screen renderer inside this sandboxed session risks hanging the driving terminal, confirmed during early FFI research): Scenario 1 → `dashboard-shell.test.tsx`, Scenario 2 → `tasks-end-to-end.test.tsx`, Scenario 3 → `focus-navigation.test.tsx`, Scenario 4 → `keybind-scoping.test.tsx`, Scenario 5 → `fault-isolation.test.tsx`, Scenario 6 (delete/edit/due-date sort/hide-completed) → `tasks-end-to-end.test.tsx` + `task-store.test.ts`. All 35 tests pass (`npm test`). Manual `./bin/mycli` verification in a real terminal is still recommended before shipping — noted as a follow-up.
- [X] T041 [P] Cleanup pass across `src/core/` and `src/extensions/tasks/` (dead code, consistent naming, no leftover TODOs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational completion; may proceed in parallel if staffed, or in priority order P1 → P1 → P2 → P2
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — can ship alone as the MVP shell
- **US2 (P1)**: No functional dependency on US1, but shares `DashboardShell`/renderer/loader from Foundational; independently testable per its own Independent Test
- **US3 (P2)**: Builds on US2's Tasks focus view existing (T030) to have something to navigate to, but the navigation mechanism itself is generic (any extension's focus view)
- **US4 (P2)**: Builds on US2's Tasks local commands (T029) and US3's navigation (T033) existing, to verify scoping against a real local/global command pair

### Parallel Opportunities

- All `[P]` Setup tasks (T002–T004) run in parallel
- Within Foundational: T007, T008 in parallel after T006/T005; T011 in parallel with T012 once T010 lands; T015, T016 in parallel after T006; T017–T019 in parallel once their dependencies land
- Once Foundational completes, US1 and US2 implementation can proceed in parallel by different contributors (US3/US4 need US2's Tasks views/commands to exist first, so they trail US2)
- All test tasks within a story marked `[P]` can run in parallel with each other

---

## Parallel Example: Foundational Phase

```bash
# After T005 (renderer) and T006 (slots) land:
Task: "Implement per-slot error boundary in src/core/ErrorBoundary.tsx"
Task: "Implement extension manifest Zod schema in src/core/extensions/manifest.ts"
Task: "Implement DashboardShell skeleton in src/core/DashboardShell.tsx"
Task: "Implement YAML+Zod config loader in src/core/config.ts"

# After T010 (StorageAPI) lands:
Task: "Unit test cross-extension StorageAPI isolation in tests/unit/storage-api.test.ts"
Task: "Implement focused-scope keybind wrapper in src/core/keybinds/FocusedScope.tsx"
```

## Parallel Example: User Story 2

```bash
# Tests, in parallel:
Task: "Integration test for tasks end-to-end in tests/integration/tasks-end-to-end.test.ts"
Task: "Unit test for task-store CRUD/sort/validation in tests/unit/task-store.test.ts"

# Independent implementation files, in parallel:
Task: "Define Task type and validators in src/extensions/tasks/task-schema.ts"
Task: "Create extension.json manifest in src/extensions/tasks/extension.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. Demo the empty dashboard shell

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → validate → demo (MVP)
3. + US2 → validate (quickstart Scenario 2 & 6) → demo (task manager working)
4. + US3 → validate (quickstart Scenario 3) → demo (keyboard navigation)
5. + US4 → validate (quickstart Scenario 4) → demo (scoped keybinds proven)
6. Polish → validate fault isolation (quickstart Scenario 5) → ship

---

## Notes

- `[P]` tasks touch different files with no incomplete-task dependency
- `[Story]` label maps a task to its user story for traceability
- Constitution Principles I–V are enforced entirely within the Foundational phase (T005–T019); every user story builds on top of an already-compliant core
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
