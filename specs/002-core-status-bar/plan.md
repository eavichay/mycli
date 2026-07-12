# Implementation Plan: Contextual Status Bar with Reserved Keys

**Branch**: `002-core-status-bar` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-core-status-bar/spec.md`

**Note**: This template is filled in by the `/spec.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Populate the dashboard shell's existing `statusbar` slot with a contextual keybind-hint display: global command hints when nothing is focused, an extension's manifest-declared keybindings by default when it is focused, and a way for the extension to override those hints and/or show a free-text message dynamically via a `statusBar` property added to the existing per-extension activation context. Unclaimed global hints always merge in alongside a focused extension's hints. A new, framework-owned reserved-keys list (starting with `Ctrl+Q` for quit) can never be claimed by any extension, at manifest-load time, at runtime, or in raw dispatch code, enforced via three drop-and-continue filters rather than a load failure — a manifest-load filter, a runtime status-bar-hint filter, and (found necessary during implementation) a filter at the keybind dispatch registration itself, since the first two only guard metadata and can't stop an extension's own component code from calling `useLocalKeybinds({ "ctrl+q": ... })` directly. This requires generalizing the existing keybind dispatch to modifier-aware canonical key ids (`ctrl+q`, not just `q`), and moving quit's binding from `q` to `ctrl+q` accordingly. No changes to the three-level (focused → local → global) resolution order itself — purely additive to `001-core-tasks-bootstrap`'s framework.

## Technical Context

**Language/Version**: Same as `001-core-tasks-bootstrap` — TypeScript, Node.js 26.3.0+, native type-stripping for `.ts` plus `tsx`'s `--import tsx/esm` loader hook for `.tsx` (JSX). No change.
**Primary Dependencies**: Same as `001-core-tasks-bootstrap` (`@opentui/core`, `@opentui/react`, `zod`, `yaml`, `tsx`) — no new dependencies required.
**Storage**: N/A — the status bar's display state is derived on every render from existing in-memory state (extension activation context, navigation state); nothing new is persisted.
**Testing**: Same as `001-core-tasks-bootstrap` — `node:test` + `node:assert`, `@opentui/react`'s `testRender`/`@opentui/core/testing`'s `createTestRenderer` for headless UI + keyboard interaction tests.
**Target Platform**: Same as `001-core-tasks-bootstrap` — cross-platform terminal, launched via the existing bash wrapper.
**Project Type**: Single-project CLI/TUI application (unchanged).
**Performance Goals**: Status bar re-render on every keypress/hint change must stay within the same imperceptible-latency budget already established (`001-core-tasks-bootstrap`: <50ms keypress-to-visual-update) — this feature adds a width-budgeted string-truncation pass, not additional I/O or async work, so no new performance risk.
**Constraints**: Status bar remains the existing single-line region (`height={1}`, unchanged from `001-core-tasks-bootstrap`'s `DashboardShell`); reserved-key enforcement must never cause an otherwise-valid extension to fail loading (FR-009, SC-004).
**Scale/Scope**: One reserved key (`ctrl+q`) and one built-in consumer (Tasks) for this feature; the reserved-keys list and the set of global commands are both designed to grow later without requiring changes to how extensions interact with either.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| I. Single-Renderer Ownership | PASS — no change; this feature adds a component (`StatusBar.tsx`) and data, not a renderer. |
| II. Extension Peer-Dependency Isolation | PASS — no change; extensions still only ever receive a context object and slot-registration callback, now with one added property (`statusBar`) on that same context object. |
| III. Scoped Storage Only | PASS — not applicable; this feature persists nothing. |
| IV. Deterministic Keybind Resolution | PASS — the three-level resolution order (focused → local → global) is untouched. Reserved keys are enforced as a registration-time content filter (an entry is dropped before any scope ever sees it), not a fourth scope and not a change to "first scope that claims it wins." Generalizing key identification to modifier-aware canonical ids (`ctrl+q` vs `q`) makes the existing dispatch *more* precise, not less deterministic — see `research.md` §1. **Re-affirmed post-implementation**: `useScopeCommands()` (`GlobalScope.tsx`) was found to need a third reserved-key filter — any reserved key is excluded from the command lookup whenever `level !== "global"` — to stop an extension's own code from claiming one directly via `useLocalKeybinds`/`useFocusedKeybinds`, bypassing the manifest and hint filters entirely. This is still a content filter applied before lookup, not a scope removal or a precedence change: `focused`/`local` still resolve before `global` for every non-reserved key, unchanged. See `contracts/reserved-keys.md` "Enforcement point 3". |
| V. Fault-Isolated Extensions | PASS — an extension declaring a reserved-key command in its manifest still loads and registers its other commands normally (FR-009); this is a direct extension of the same "drop the one bad command, load everything else" pattern `001-core-tasks-bootstrap` already established for load-time isolation. |

No violations. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-core-status-bar/
├── plan.md              # This file (/spec.plan command output)
├── research.md          # Phase 0 output (/spec.plan command)
├── data-model.md        # Phase 1 output (/spec.plan command)
├── quickstart.md        # Phase 1 output (/spec.plan command)
├── contracts/           # Phase 1 output (/spec.plan command)
│   ├── status-bar-context.md
│   └── reserved-keys.md
└── tasks.md             # Phase 2 output (/spec.tasks command - NOT created by /spec.plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── globalCommands.ts     # NEW: structured GlobalCommand[] (key/label/action), single
│   │                          # source for useGlobalKeybinds' dispatch map AND the status
│   │                          # bar's default/unclaimed hint display (FR-001, FR-006a)
│   ├── reservedKeys.ts        # NEW: RESERVED_KEYS list + canonicalKeyId() helper (FR-007/008)
│   ├── StatusBar.tsx          # NEW: renders into the existing `statusbar` slot; merge +
│   │                          # truncation-with-reserved-exemption layout (FR-001..FR-013)
│   ├── DashboardShell.tsx     # MODIFIED: registers StatusBar into the statusbar slot
│   │                          # (slot itself unchanged, per Assumptions)
│   ├── keybinds/
│   │   └── GlobalScope.tsx    # MODIFIED: dispatch keyed by canonicalKeyId() instead of
│   │                          # raw key.name (to distinguish ctrl+q from q), AND filters
│   │                          # reserved keys out of focused/local lookup — enforcement
│   │                          # point 3, added during implementation (FR-010)
│   └── extensions/
│       ├── manifest.ts        # MODIFIED: validateManifest() filters reserved-key
│       │                      # commands[] entries out before returning (FR-009)
│       └── loader.ts          # MODIFIED: ExtensionActivationContext gains `statusBar`
│                               # (StatusBarContextAPI), constructed per-extension by the loader
├── extensions/
│   └── tasks/
│       ├── extension.json     # unchanged (existing commands[] already have keybinds)
│       ├── index.tsx          # MODIFIED: passes ctx.statusBar into createFocusView()
│       └── FocusView.tsx      # MODIFIED: calls statusBar.setHints()/setMessage() on
│                              # mode changes (add/edit flows) — User Story 3
└── cli/
    └── App.tsx                # MODIFIED: uses globalCommands.ts instead of inline object;
                                # calls statusBar.clear() when activeExtensionId changes away

tests/
├── unit/
│   ├── canonical-key-id.test.ts       # NEW: modifier-aware key-id formatting
│   ├── reserved-keys.test.ts          # NEW: manifest filter + runtime hint filter (FR-009/011)
│   └── status-bar-layout.test.tsx     # NEW: merge/truncation/reserved-exemption algorithm
├── integration/
│   ├── status-bar-global.test.tsx     # NEW: US1 — global hints, dashboard/back-and-forth
│   ├── status-bar-defaults.test.tsx   # NEW: US2 — manifest-derived default hints
│   ├── status-bar-custom.test.tsx     # NEW: US3 — runtime customization + clear-on-exit
│   ├── status-bar-override.test.tsx   # NEW: US4 — focused-overrides-global + merge
│   ├── reserved-key-enforcement.test.tsx  # NEW: US5 — end-to-end reserved-key guarantee
│   ├── dashboard-shell.test.tsx       # MODIFIED (001): quit key press updated to ctrl+q
│   ├── fault-isolation.test.tsx       # MODIFIED (001): quit key press updated to ctrl+q
│   └── keybind-scoping.test.tsx       # MODIFIED (001): quit key press updated to ctrl+q
└── contract/
    └── (no new contract tests — this feature has no external interface beyond the
        in-process StatusBarContextAPI, exercised via the integration tests above)
```

**Structure Decision**: Purely additive to `001-core-tasks-bootstrap`'s existing single-project `src/` + `tests/` layout — no new top-level directories. New framework primitives live in `src/core/` alongside the existing renderer/slots/keybinds/loader; the one extension-side change (Tasks calling `statusBar.setHints()`) lives in `src/extensions/tasks/`, matching the existing pattern of built-in extensions consuming framework services through their activation context rather than any special-cased path (constitution: "Built-in extensions are ordinary extensions").

## Triage Framework: [SYNC] vs [ASYNC] Classification

**Execution Strategy**: This feature will use a hybrid execution model combining human expertise ([SYNC]) with autonomous agent delegation ([ASYNC]).

### Preliminary Task Classification

| Task Category | Estimated [SYNC] Tasks | Estimated [ASYNC] Tasks | Rationale |
|---|---|---|---|
| Business Logic (canonical key id, reserved-key filters, layout/truncation algorithm) | 2 | 1 | The canonical-key-id helper and the reserved-key enforcement points (three, not two — see Triage Audit Trail) are security/correctness-adjacent (a bug here silently defeats the whole feature's safety guarantee) — human review warranted. The truncation-layout algorithm is fully specified by data-model.md and delegable. |
| Data Operations (extension context, StatusBarContextAPI) | 1 | 1 | Extending `ExtensionActivationContext` touches the loader's existing constitution-relevant contract (Principle II) — one human pass. The API object's own get/set implementation is mechanical. |
| UI Components (StatusBar.tsx, Tasks' setHints/setMessage calls) | 1 | 2 | Visual layout judgment (StatusBar.tsx) benefits from a human pass; wiring Tasks' existing mode changes to call the new API is mechanical, following an established pattern. |
| Integrations (GlobalScope.tsx dispatch key change, globalCommands.ts, App.tsx rewire) | 2 | 0 | Changing how the *existing, already-shipped* keybind dispatch identifies keys is the highest-risk change in this feature — a mistake here could silently break every existing keybind, not just this feature's new ones. Both SYNC. |
| Infrastructure (test updates for the quit-key rebind, new test fixtures) | 0 | 3 | Mechanical: updating three existing tests' mock key-press calls, and writing new fixture/test scaffolding for the new scenarios. |

### Triage Decision Criteria Applied

**High-Risk [SYNC] Classifications:**

- `canonicalKeyId()` helper and its integration into `GlobalScope.tsx`'s dispatch — every existing and future keybind's matching depends on this being correct; a subtle bug (e.g. wrong modifier order, case mismatch) could silently break keybinds across both features.
- The three reserved-key enforcement points (manifest filter in `manifest.ts`; runtime hint filter in `StatusBarContextAPI`; dispatch-registration filter in `GlobalScope.tsx`'s `useScopeCommands`, added during implementation once the first two were found insufficient — see Triage Audit Trail) — this is the feature's core safety guarantee (SC-002); an off-by-one or wrong-comparison bug in any of the three would silently defeat it.
- `globalCommands.ts` + `App.tsx`'s rewire away from the inline `useGlobalKeybinds({...})` object — quit, open, and back are the app's only global commands; a mistake here breaks basic navigation for every user, in every feature.

**Agent-Delegated [ASYNC] Classifications:**

- `StatusBar.tsx`'s merge/truncation-with-reserved-exemption layout — fully specified by `data-model.md`'s "Status Bar Display State" section and `research.md` §6.
- Tasks' `FocusView.tsx` calling `statusBar.setHints()`/`setMessage()` on its existing mode transitions — mechanical wiring against an already-settled API, following the exact pattern Tasks already uses for `store.add()`/`store.edit()` etc.
- Test scaffolding: updating the three `001-core-tasks-bootstrap` tests' quit-key press calls, and writing new fixtures for the reserved-key-conflict test extension used in `reserved-key-enforcement.test.tsx`.

### Triage Audit Trail

| Task | Classification | Primary Criteria | Risk Level | Rationale |
|---|---|---|---|---|
| `canonicalKeyId()` + `GlobalScope.tsx` dispatch change | SYNC | Foundational, high blast radius | High | Every keybind, old and new, depends on this being correct |
| Reserved-key manifest filter (`manifest.ts`) | SYNC | Core safety guarantee (SC-002) | High | Silent defeat of the feature's central promise if wrong |
| Reserved-key runtime hint filter (`StatusBarContextAPI`) | SYNC | Core safety guarantee (SC-002) | High | Same as above, second enforcement point |
| Reserved-key dispatch filter (`GlobalScope.tsx`'s `useScopeCommands`) | SYNC | Core safety guarantee (SC-002) | High | Discovered during implementation: the first two enforcement points only guard metadata (manifest `commands[]`, status-bar hints) — neither stops an extension's own code from calling `useLocalKeybinds({ "ctrl+q": handler })` directly, which would claim the key at local scope before global ever saw it. This third filter, applied in dispatch lookup itself, is what actually makes FR-010 unconditional. |
| `globalCommands.ts` + `App.tsx` rewire | SYNC | Foundational, high blast radius | High | Breaks basic app navigation (quit/open/back) if wrong |
| `StatusBar.tsx` layout algorithm | ASYNC | Fully spec'd (data-model.md, research.md §6) | Low | Deterministic algorithm, no architectural judgment needed |
| Tasks' `FocusView.tsx` `setHints`/`setMessage` wiring | ASYNC | Mechanical, established pattern | Low | Same pattern Tasks already uses for its store calls |
| Test updates + new fixtures | ASYNC | Standard practice | Low | No project-specific judgment required |

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
