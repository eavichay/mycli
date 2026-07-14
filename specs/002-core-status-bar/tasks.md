# Tasks: Contextual Status Bar with Reserved Keys

**Input**: Design documents from `/specs/002-core-status-bar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included, per the constitution's testing requirement for framework-level behavior (keybind dispatch, reserved-key enforcement) and this feature's own quickstart scenarios.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 P1, US2 P1, US3 P2, US4 P2, US5 P1) so each can be implemented and independently verified per its Independent Test.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to its user story (US1–US5); omitted for Setup/Foundational/Polish
- Per `plan.md`'s Triage Framework: tasks touching the canonical-key-id helper, the two reserved-key enforcement points, and the global-commands rewire (`GlobalScope.tsx`, `globalCommands.ts`, `App.tsx`) warrant a human (SYNC) review pass before merge — these are foundational and high-blast-radius. All others are safe to delegate (ASYNC). This classification is advisory, not part of the task ID.

## Path Conventions

Single project: `src/`, `tests/` at repository root, additive to `001-core-tasks-bootstrap`'s existing layout — no new top-level directories.

---

## Phase 1: Setup

**Purpose**: No new dependencies or scaffolding are required — this feature is purely additive to `001-core-tasks-bootstrap`'s existing `src/core/`, `src/extensions/tasks/`, and `tests/` structure.

- [X] T001 Confirm `npm test` and `npx tsc --noEmit` both pass cleanly on `002-core-status-bar` before making any changes (baseline check; no new files) — 35/35 tests, 0 type errors

**Checkpoint**: Baseline confirmed green — ready for Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The modifier-aware key-identity primitive, the reserved-keys list, the structured global-commands registry, and the two reserved-key enforcement points every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story either displays hints derived from these primitives or depends on the reserved-key guarantee they enforce.

- [X] T002 Implement `canonicalKeyId(key: KeyEvent): string` in `src/core/keybinds/canonicalKeyId.ts` — modifiers in fixed order (`ctrl+`, `meta+`, `shift+`, `option+`) + lowercase base name (data-model.md "Canonical Key Id"; research.md §1) — also added `canonicalKeyIdFromString()` for manifest keybind strings, needed by T007/T009
- [X] T003 [P] Unit test `canonicalKeyId()`: plain key (`q` → `"q"`), single modifier (`ctrl+q` → `"ctrl+q"`), multiple modifiers in fixed order regardless of input order, case-insensitivity of the base name, in `tests/unit/canonical-key-id.test.ts` (depends on T002) — 4/4 passing
- [X] T004 Update `src/core/keybinds/GlobalScope.tsx`'s `useScopeCommands` dispatch handler to look up `commands[canonicalKeyId(key)]` instead of `commands[key.name]`, so `ctrl+q` and `q` are distinguishable at every scope (focused/local/global) (depends on T002) — human review recommended: highest-blast-radius change in this feature, per plan.md Triage
- [X] T005 [P] Implement the reserved-keys list in `src/core/reservedKeys.ts`: `RESERVED_KEYS: ReservedKey[] = [{ key: "ctrl+q", label: "Quit" }]`, exported as both the raw list and a `isReservedKey(canonicalId: string): boolean` helper (data-model.md "Reserved Key"; FR-007, FR-008)
- [X] T006 Implement the structured global-commands registry in `src/core/globalCommands.ts` — implemented as `createGlobalCommands(deps)` factory rather than a static list, since quit/open/back need closures over `renderer`/navigation state only available inside `App.tsx`; `globalCommandsToKeyMap()` derives the `useGlobalKeybinds` dispatch map from the same list (data-model.md "Global Command"; FR-001, FR-008, FR-008a; depends on T005) — human review recommended: breaks basic navigation for every user if wrong
- [X] T007 Update `src/core/extensions/manifest.ts`'s `validateManifest()` to filter `commands[]` entries whose canonicalized `keybind` is a reserved key out of the returned manifest before the loader ever sees them (drop-and-continue, not a validation failure) (FR-009; contracts/reserved-keys.md "Enforcement point 1"; depends on T002, T005) — human review recommended: core safety guarantee (SC-002)
- [X] T008 [P] Unit test the manifest reserved-key filter: a manifest with one reserved-key command and one valid command still validates successfully, with only the reserved-key command absent from the result, in `tests/unit/reserved-keys.test.ts` (depends on T007) — 3/3 passing (plus a mixed-case/order variant)
- [X] T009 Implement `StatusBarContextAPI` (`setHints`, `setMessage`, `clear`) in `src/core/statusBar/StatusBarContextAPI.ts` — `setHints()` filters out any reserved-key entry before storing (FR-011; contracts/status-bar-context.md; contracts/reserved-keys.md "Enforcement point 2"; depends on T005) — human review recommended: second half of the core safety guarantee (SC-002). Also exposes `getHints()`/`getMessage()`/`subscribe()` for `StatusBar.tsx` to read and re-render on change (US1)
- [X] T010 [P] Unit test `StatusBarContextAPI`: `setHints()` with a mix of reserved and non-reserved keys retains only the non-reserved ones; `setMessage()`/`clear()` behave as documented, in `tests/unit/reserved-keys.test.ts` (same file as T008; depends on T009) — 2/2 passing
- [X] T011 Wire `StatusBarContextAPI` into the loader: `ExtensionActivationContext` (in `src/core/extensions/loader.ts`) gains a `statusBar` property, one `StatusBarContextAPI` instance constructed per extension via a new `getStatusBar(id)` accessor (depends on T009)
- [X] T012 [P] Implement the status-bar layout/truncation algorithm as a pure function in `src/core/statusBar/layoutStatusBar.ts`: given reserved hints, extension hints (custom or manifest-derived), unclaimed global hints, and an optional message, produce a single width-budgeted string — reserved hints always shown in full, everything else truncated to fit (data-model.md "Status Bar Display State"; research.md §6; FR-012, FR-013)
- [X] T013 [P] Unit test `layoutStatusBar()`: merge behavior (unclaimed global hints included), message+hints coexistence, and truncation with reserved-hint exemption (content long enough to overflow retains reserved hints in full while other content is cut), in `tests/unit/status-bar-layout.test.ts` (depends on T012) — 6/6 passing

**Checkpoint**: Foundation ready — all user stories can now proceed.

---

## Phase 3: User Story 1 - See Global Hints on the Dashboard (Priority: P1) 🎯 MVP

**Goal**: With no extension focused, the status bar shows the global commands and their keys, including quit (now `Ctrl+Q`).

**Independent Test**: Launch the app with any extensions enabled but none focused; confirm the status bar displays the global commands and no extension-specific content.

### Tests for User Story 1

- [X] T014 [P] [US1] Integration test: on launch (no extension focused), the status bar shows all `GLOBAL_COMMANDS` hints including `Ctrl+Q: Quit`; after focusing and returning from an extension, the status bar reverts to the same global-only display, in `tests/integration/status-bar-global.test.tsx` — 4/4 passing (added two extra tests beyond the plan: Ctrl+Q actually quits, and plain `q` no longer does — direct proof of FR-008/FR-008a)

### Implementation for User Story 1

- [X] T015 [US1] Implement `src/core/StatusBar.tsx`: a component rendering `layoutStatusBar()`'s output, given the current `activeExtensionId`, `GLOBAL_COMMANDS`, and (if focused) the extension's hints/message from its `StatusBarContextAPI` instance (depends on T006, T009, T012) — manifest-derived hint labels use the command `id` (e.g. `tasks.add`) since the manifest schema has no separate friendly-label field; noted as a minor readability gap, not a functional one
- [X] T016 [US1] Register `StatusBar` into the existing `statusbar` slot in `src/core/DashboardShell.tsx` (slot itself unchanged, per spec Assumptions; depends on T015) — `StatusBar` is passed down as a new `statusBarContent` prop (rendered alongside the existing, still-unused-by-any-extension `<Slot name="statusbar">`) rather than registered through the plugin registry, since it needs host-level state (focused extension, global commands) the per-plugin `Slot` render signature (`ctx, props`) doesn't carry
- [X] T017 [US1] Update `src/cli/App.tsx` to build its `useGlobalKeybinds()` command map from `GLOBAL_COMMANDS` (T006) instead of the current inline object literal, and pass `GLOBAL_COMMANDS` + the focused extension's `StatusBarContextAPI` (if any) down to `StatusBar` (depends on T006, T011, T016)

**Checkpoint**: User Story 1 fully functional and independently testable — MVP.

---

## Phase 4: User Story 2 - See an Extension's Manifest Keybindings by Default (Priority: P1)

**Goal**: Focusing an extension that hasn't customized its hints shows its manifest-declared `commands[]` as status-bar hints automatically, merged with unclaimed global hints.

**Independent Test**: Focus an extension that declares commands in its manifest but does not customize its status-bar hints at runtime; confirm the status bar shows exactly those manifest-declared keybindings (plus unclaimed global hints).

### Tests for User Story 2

- [X] T018 [P] [US2] Integration test: focusing Tasks (which declares `commands[]` in `extension.json` and, at this point in the plan, has not yet been wired to call `setHints()`) shows its manifest keybindings in the status bar, merged with `Esc: Back`, in `tests/integration/status-bar-defaults.test.tsx` — 1/1 passing. Surfaced a real layout bug in `layoutStatusBar()` (T012): extension hints were ordered before unclaimed global hints, so Tasks' 5 manifest commands pushed `escape: Back` off the truncated line — fixed by reprioritizing unclaimed global hints ahead of extension hints (spec doesn't mandate non-reserved ordering, only that reserved hints are exempt)

### Implementation for User Story 2

- [X] T019 [US2] Extend `StatusBar.tsx` (T015) to fall back to the focused extension's `manifest.commands[]` as its hint source whenever that extension's `StatusBarContextAPI` has no custom hints set (FR-002; depends on T015) — already implemented as part of T015; this task's scope was absorbed there

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - An Extension Customizes Its Own Hints (Priority: P2)

**Goal**: An extension can dynamically override its default hints and/or show a custom message via `ctx.statusBar`, reflected immediately, and cleared automatically by the host when its focus view is exited.

**Independent Test**: With an extension focused, trigger a mode change that updates its status-bar hints via the context object; confirm the status bar immediately reflects the new hints instead of the manifest defaults, and reverts to defaults after the extension is unfocused.

### Tests for User Story 3

- [X] T020 [P] [US3] Integration test: entering Tasks' add-task mode updates the status bar to reflect add-mode hints (e.g. `Return: submit`, `Esc: cancel`) instead of manifest defaults; canceling back to the list reverts to manifest-derived hints; leaving Tasks' focus view entirely and re-entering also starts from manifest defaults (not a stale customization), in `tests/integration/status-bar-custom.test.tsx` — 3/3 passing on first run

### Implementation for User Story 3

- [X] T021 [US3] Update `src/extensions/tasks/index.tsx` to pass `ctx.statusBar` into `createFocusView(store, ctx.statusBar)` (depends on T011)
- [X] T022 [US3] Update `src/extensions/tasks/FocusView.tsx`'s mode-change handlers (`a`/`e`/`escape`/submit) to call `statusBar.setHints([...])`/`setMessage(...)` reflecting the current mode (list vs. add vs. edit), per contracts/status-bar-context.md's usage pattern (depends on T021, T019) — implemented as one `useEffect` keyed on `[mode, error]` rather than scattering calls across each handler, so no transition can be missed; list mode calls `clear()` to revert to manifest defaults
- [X] T023 [US3] In `src/cli/App.tsx`, call the previously-focused extension's `statusBar.clear()` when `activeExtensionId` changes away from it, so FR-005's clear-on-exit guarantee is host-owned rather than relying on the extension to clean up (depends on T017) — implemented as a `useEffect` cleanup function keyed on `activeExtensionId`, fires on both change-away and unmount

**Checkpoint**: User Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 - Focused Hints Override Global Hints for the Same Key (Priority: P2)

**Goal**: When a focused extension's key collides with a non-reserved global command's key, the status bar shows only the extension's hint for that key; unclaimed global hints still show alongside it.

**Independent Test**: Configure a non-reserved key with both a global meaning and a focused-extension meaning; confirm the status bar shows only the extension's meaning while focused, and the global meaning again once it isn't — with other unclaimed global hints (e.g. back) visible throughout.

### Tests for User Story 4

- [X] T024 [P] [US4] Integration test: a temporarily-configured colliding non-reserved key shows only the focused extension's hint while focused and the global hint again once unfocused; an unclaimed global hint remains visible throughout, in `tests/integration/status-bar-override.test.tsx` — 2/2 passing, using a minimal inline test extension (colliding on `escape`, then a variant colliding on nothing) rather than a temporarily-reconfigured Tasks

### Implementation for User Story 4

- [X] T025 [US4] Confirm/adjust `layoutStatusBar()` (T012) excludes any global command whose key matches one of the focused extension's active hint keys before merging (FR-006, FR-006a — likely already satisfied by T012/T013's design; this task is the explicit verification pass against a real collision scenario) — confirmed correct, no adjustment needed; already exercised end-to-end by T024

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Reserved Keys Can Never Be Claimed by an Extension (Priority: P1)

**Goal**: An extension's manifest or runtime customization can never successfully bind or display a reserved key; the reserved key's global action always fires instead, and the extension's other commands still work.

**Independent Test**: Configure an extension's manifest to declare a command on `ctrl+q`; confirm the extension still loads and functions normally, `Ctrl+Q` still quits, and the status bar never shows `ctrl+q` as belonging to that extension.

### Tests for User Story 5

- [X] T026 [P] [US5] Integration test, end-to-end: a test extension whose manifest declares a command on `ctrl+q` alongside other valid commands loads successfully; focusing it and pressing `Ctrl+Q` quits (not the extension's declared action); the extension's other commands still register and work; the status bar never shows `ctrl+q` under that extension even if it calls `setHints([{ key: "ctrl+q", ... }])`, in `tests/integration/reserved-key-enforcement.test.tsx` (depends on T007, T009, T017) — 1/1 passing, including the worst case where the extension's `FocusView` also directly calls `useLocalKeybinds({ "ctrl+q": ... })` in code (not just via its manifest)

### Implementation for User Story 5

- [X] T027 [US5] **A real gap was found and fixed here, not "no new implementation" as originally planned**: T007 (manifest filter) and T009 (runtime hint filter) only guard *metadata* — an extension's `FocusView` could still directly call `useLocalKeybinds({ "ctrl+q": handler })` in its own code, which would legitimately claim the key at local scope before global ever saw it, since local scope has higher dispatch precedence (Principle IV). Neither T007 nor T009 could have caught this. Fixed by adding a third enforcement point in `src/core/keybinds/GlobalScope.tsx`'s `useScopeCommands`: any reserved key is filtered out of the command lookup at `focused`/`local` scope (never at `global`), so no registration mechanism — manifest, runtime hint, or raw dispatch code — can ever make a reserved key fire anywhere but global. Covered by a new unit test in `tests/unit/keybind-chain.test.tsx` and exercised end-to-end by T026.

**Checkpoint**: All five user stories independently functional — SC-002 verified end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Update the three `001-core-tasks-bootstrap` tests affected by the quit-key rebind, and validate the full quickstart.

- [X] T028 [P] Update `tests/integration/dashboard-shell.test.tsx`'s quit-key assertion from `mockInput.pressKey("q")` to a `ctrl+q` press (via the mock input's modifier argument), per research.md §2's planned impact
- [X] T029 [P] Update `tests/integration/fault-isolation.test.tsx`'s quit-key assertion the same way
- [X] T030 [P] Update `tests/integration/keybind-scoping.test.tsx`'s quit-key assertion the same way
- [X] T031 Run all 5 `quickstart.md` scenarios end-to-end (via their automated integration-test equivalents, consistent with `001-core-tasks-bootstrap`'s approach) and confirm expected outcomes — Scenario 1 → `status-bar-global.test.tsx`, Scenario 2 → `status-bar-defaults.test.tsx`, Scenario 3 → `status-bar-custom.test.tsx`, Scenario 4 → `status-bar-override.test.tsx`, Scenario 5 → `reserved-key-enforcement.test.tsx` + `keybind-chain.test.tsx`'s dispatch-level test. All 62 tests pass (`npm test`), 0 tsc errors. Manual `./bin/mycli` verification in a real terminal not performed in this session — same noted follow-up as 001.
- [X] T032 [P] Cleanup pass across `src/core/statusBar/`, `src/core/globalCommands.ts`, `src/core/reservedKeys.ts`, and touched files in `src/extensions/tasks/` (dead code, consistent naming, no leftover TODOs) — no TODOs/dead code/unused imports found; 0 tsc errors, 62/62 tests passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational completion; US1/US2 may proceed in parallel once Foundational lands, but US3/US4/US5 each depend on artifacts US1 introduces (`StatusBar.tsx`, T015) — see below
- **Polish (Phase 8)**: Depends on all five user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — introduces `StatusBar.tsx` itself (T015), which every later story extends
- **US2 (P1)**: Extends `StatusBar.tsx` from US1 (T019 depends on T015) — cannot start before US1's T015 lands, though its own test (T018) can be written in parallel
- **US3 (P2)**: Depends on US1's `App.tsx` wiring (T017) and US2's manifest-fallback behavior (T019) both existing, since customization is "override the default" — sequenced after US1 and US2
- **US4 (P2)**: Depends on US1's `layoutStatusBar()` merge behavior (T012/T025) — can proceed in parallel with US3 once US1 is done, since it doesn't depend on US3's customization API
- **US5 (P1)**: Depends on Foundational's two enforcement points (T007, T009) directly, and on US1's `App.tsx` wiring (T017) to have something to focus for the end-to-end test — can proceed in parallel with US2/US3/US4 once US1 is done

### Parallel Opportunities

- Within Foundational: T003 (parallel with T002 once T002 lands), T005/T006 in parallel with each other and with T002-T004, T008/T010 in parallel once their respective implementation tasks land, T012/T013 in parallel with the rest of Foundational (no dependency on T002-T011)
- Once US1 (T015-T017) lands, US2, US4, and US5's test-writing can all proceed in parallel; US3 trails since it depends on US2's fallback behavior existing first
- All Polish test-file updates (T028-T030) are independent of each other and can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Independent of each other, once T002 (canonicalKeyId) lands:
Task: "Implement reserved-keys list in src/core/reservedKeys.ts"
Task: "Implement structured global-commands registry in src/core/globalCommands.ts"

# Fully independent of the above, no shared dependencies:
Task: "Implement layoutStatusBar() pure function in src/core/statusBar/layoutStatusBar.ts"
Task: "Unit test layoutStatusBar() in tests/unit/status-bar-layout.test.ts"
```

## Parallel Example: User Story 1 boundary

```bash
# Once T015-T017 (StatusBar.tsx, slot registration, App.tsx wiring) land, in parallel:
Task: "Write US2 default-hints integration test in tests/integration/status-bar-defaults.test.tsx"
Task: "Write US4 override integration test in tests/integration/status-bar-override.test.tsx"
Task: "Write US5 reserved-key end-to-end integration test in tests/integration/reserved-key-enforcement.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. Demo the global-hints status bar

### Incremental Delivery

1. Setup + Foundational → foundation ready (canonical key ids, reserved keys, global commands, both enforcement points, layout algorithm)
2. + US1 → validate (quickstart Scenario 1) → demo (global hints working, quit now on Ctrl+Q)
3. + US2 → validate (quickstart Scenario 2) → demo (manifest-default hints working)
4. + US3 → validate (quickstart Scenario 3) → demo (dynamic customization working)
5. + US4 → validate (quickstart Scenario 4) → demo (override-wins-and-merges proven)
6. + US5 → validate (quickstart Scenario 5) → demo (reserved-key guarantee proven end-to-end)
7. Polish → update the three affected 001 tests, run full quickstart → ship

---

## Notes

- `[P]` tasks touch different files with no incomplete-task dependency
- `[Story]` label maps a task to its user story for traceability
- The quit-key rebind (`q` → `ctrl+q`) is a deliberate, spec-clarified behavior change (spec.md FR-008/FR-008a) — T028-T030 are not bug fixes, they're the planned follow-through
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
