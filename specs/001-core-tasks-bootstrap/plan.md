# Implementation Plan: Core Framework Bootstrap via Tasks Extension

**Branch**: `001-core-tasks-bootstrap` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-core-tasks-bootstrap/spec.md`

**Note**: This template is filled in by the `/spec.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Stand up the mycli TUI core framework — a single owned renderer, a typed slot registry (`grid`/`sidebar`/`statusbar`/`overlay`), a manifest-first lazy extension loader, a three-level (`focused` → `local` → `global`) keybind resolution chain, and a per-extension scoped `StorageAPI` — then validate the whole stack end-to-end by implementing Tasks as the first real, built-in extension (add/edit/delete/complete tasks, due-date sorting, hide-completed toggle, full peek/focus/persistence round-trip). Built on `@opentui/core` + `@opentui/react`'s `createReactSlotRegistry` and `useKeyboard`, TypeScript via Node.js 26 native type-stripping (`.tsx` files additionally via `tsx`'s `--import tsx/esm` loader hook for JSX — see Technical Context), filesystem+JSON storage behind the `StorageAPI` interface, YAML+Zod config, and `node:test` + `@opentui/react`'s `testRender`/`createTestRenderer` for headless verification.

## Technical Context

**Language/Version**: TypeScript, Node.js native type-stripping for `.ts` files, Node.js 26.3.0+. `.tsx` files additionally run through `tsx`'s loader hook (`--import tsx/esm`) since native type-stripping cannot transform JSX — a JIT transform, not a separate build artifact (constitution v1.1.0, Technology Constraints → Language). The `tsx` CLI wrapper (`tsx <file>`) MUST NOT be used: it was confirmed during this feature's implementation to break OpenTUI's native FFI renderer entirely.
**Primary Dependencies**: `@opentui/core`, `@opentui/react` (`createReactSlotRegistry`, `Slot`, `useKeyboard`, `createCliRenderer`, `createRoot`), `zod`, `yaml`, `tsx` (JSX loader hook only, per Language above — not used as a bundler/CLI)
**Storage**: Filesystem-backed JSON, one scoped directory per extension under `os.homedir()/.mycli/extensions/<id>/`, accessed only through `StorageAPI`
**Testing**: `node:test` + `node:assert` (framework/logic tests); `@opentui/react`'s `testRender()` / `@opentui/core/testing`'s `createTestRenderer` (headless UI + keyboard interaction tests)
**Target Platform**: Cross-platform terminal (macOS/Linux/Windows), launched via a bash wrapper encapsulating `--experimental-ffi` and `--import tsx/esm`
**Project Type**: Single-project CLI/TUI application
**Performance Goals**: Keypress-to-visual-update latency imperceptible to the user (<50ms) at typical task-list sizes; dashboard cold-start render <500ms
**Constraints**: Fully offline/local, single Node.js process, single renderer instance (Principle I), extension code loaded lazily via `import()` only after manifest validation (never `require()`, never a worker thread — Principle II)
**Scale/Scope**: Single user, single machine; task lists in the tens-to-low-hundreds range; this feature delivers the framework's core primitives plus the Tasks extension as their first real consumer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| I. Single-Renderer Ownership | PASS — `createCliRenderer()` is called exactly once, at the host entrypoint. Extensions (including built-in Tasks) only ever receive a slot-registration callback and `HostContext`, never the renderer or a renderer-construction API. |
| II. Extension Peer-Dependency Isolation | PASS — Tasks (and any future extension) declares `@opentui/react`/`@opentui/core` as `peerDependencies`, not bundled deps. Extension modules are loaded via `import()` in-process, gated on manifest `activationEvents`; no `require()`, no worker thread. |
| III. Scoped Storage Only | PASS — Extensions receive only the `StorageAPI` interface (`get`/`set`/`delete`/`list`) via `HostContext`; the host alone resolves and owns the real filesystem path (`contracts/storage-api.md`). |
| IV. Deterministic Keybind Resolution | PASS — Three explicit, independently-inspectable `useKeyboard` capture levels (`focused` → `local` → `global`), each returning claim/delegate, no flat boolean, no skippable level (`contracts/keybind-chain.md`). |
| V. Fault-Isolated Extensions | PASS — Render-time failures are isolated by `@opentui/react`'s `<Slot>`, which already wraps every plugin's rendered node in its own internal error boundary via `pluginFailurePlaceholder` (a standalone `ErrorBoundary.tsx` was found redundant during implementation and dropped). Load-time failures (invalid manifest, `import()`/activation throwing) never reach `registry.register()`, so they're surfaced separately via an explicit load-error tile (`App.tsx`'s `extraGridContent`, added in Polish phase T038) driven by the loader's per-extension state. Neither failure mode affects the host or sibling extensions (FR-014, SC-005). |

No violations. Complexity Tracking table left empty.

**Note (constitution v1.1.0 amendment, 2026-07-10)**: `HostContext` above is named as such — not `AppContext` — specifically to avoid colliding with `@opentui/react`'s own exported `AppContext` (`{ renderer, keyHandler }`), which this plan does not use directly. See constitution's Technology Constraints → Language for the `tsx/esm` loader exception this implementation required and required amending the constitution for.

## Project Structure

### Documentation (this feature)

```text
specs/001-core-tasks-bootstrap/
├── plan.md              # This file (/spec.plan command output)
├── research.md          # Phase 0 output (/spec.plan command)
├── data-model.md         # Phase 1 output (/spec.plan command)
├── quickstart.md         # Phase 1 output (/spec.plan command)
├── contracts/            # Phase 1 output (/spec.plan command)
│   ├── extension-manifest.md
│   ├── storage-api.md
│   └── keybind-chain.md
└── tasks.md              # Phase 2 output (/spec.tasks command - NOT created by /spec.plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── renderer.ts          # createCliRenderer + createRoot bootstrap (Principle I)
│   ├── slots.ts              # createReactSlotRegistry setup, Slots/HostContext types
│   ├── DashboardShell.tsx    # grid/sidebar/statusbar/overlay regions (presentational)
│   ├── FocusFrame.tsx        # framed/highlighted focus-view treatment, no animation
│   ├── config.ts             # YAML+Zod host config loader
│   ├── keybinds/
│   │   ├── GlobalScope.tsx   # KeybindDispatcherProvider (single root useKeyboard
│   │   │                     # subscription) + global-level useGlobalKeybinds
│   │   ├── LocalScope.tsx    # local (active-extension)-level useLocalKeybinds
│   │   └── FocusedScope.tsx  # focused-level useFocusedKeybinds
│   ├── storage/
│   │   └── StorageAPI.ts     # scoped filesystem+JSON implementation (Principle III)
│   └── extensions/
│       ├── manifest.ts       # Zod schema + validation (extension-manifest.md contract)
│       └── loader.ts         # manifest-first, lazy import() loader (Principle II)
├── extensions/
│   └── tasks/
│       ├── extension.json
│       ├── index.tsx         # registers peek/focus views + commands
│       ├── PeekView.tsx
│       ├── FocusView.tsx
│       ├── reactive-store.ts # shared reactive wrapper keeping peek+focus in sync
│       ├── task-store.ts     # Task CRUD + sort logic against StorageAPI
│       └── task-schema.ts    # Task type + validation (data-model.md)
└── cli/
    ├── index.ts               # process entrypoint (invoked by the bash wrapper)
    └── App.tsx                # root component: KeybindDispatcherProvider + navigation state

tests/
├── unit/
│   ├── keybind-chain.test.tsx      # .tsx: needs JSX for the test harness
│   ├── manifest-validation.test.ts
│   ├── storage-api.test.ts
│   └── task-store.test.ts
├── integration/
│   ├── dashboard-shell.test.tsx    # US1 (.tsx: needs JSX)
│   ├── tasks-end-to-end.test.tsx   # US2 (.tsx: needs JSX)
│   ├── focus-navigation.test.tsx   # US3 (.tsx: needs JSX)
│   ├── keybind-scoping.test.tsx    # US4 (.tsx: needs JSX)
│   └── fault-isolation.test.tsx    # SC-005 (.tsx: needs JSX)
└── contract/
    └── extension-manifest.test.ts
```

**Structure Decision**: Single-project layout (`src/` + `tests/`), no frontend/backend split — this is a single Node.js CLI process. `src/core/` holds the framework primitives (renderer, slots, keybind chain, storage, manifest loader); `src/extensions/tasks/` is the first extension, built through the exact same manifest+loader+slot-registry path as any marketplace extension would use (constitution: "Built-in extensions are ordinary extensions").

## Triage Framework: [SYNC] vs [ASYNC] Classification

**Execution Strategy**: This feature will use a hybrid execution model combining human expertise ([SYNC]) with autonomous agent delegation ([ASYNC]).

### Preliminary Task Classification

| Task Category | Estimated [SYNC] Tasks | Estimated [ASYNC] Tasks | Rationale |
|---|---|---|---|
| Business Logic (task CRUD, sort, validation) | 1 | 4 | Sort/validation rules are fully specified in data-model.md; well-suited to autonomous implementation. One SYNC pass to confirm edge-case coverage against FR-015/019/020. |
| Data Operations (StorageAPI, manifest loader) | 2 | 2 | Path-scoping and manifest validation directly implement Constitution Principles II/III — security-adjacent, warrants human review before merge. |
| UI Components (peek/focus views, slot registration) | 1 | 3 | Visual/UX judgment calls (framing, layout) benefit from a human pass; component wiring itself is mechanical. |
| Integrations (keybind chain, renderer bootstrap) | 3 | 1 | Principle I/IV are foundational and load-bearing for every future extension — highest-risk area, mostly SYNC. |
| Infrastructure (test setup, fixtures, config loading) | 0 | 3 | Standard scaffolding, low risk, fully delegable. |

### Triage Decision Criteria Applied

**High-Risk [SYNC] Classifications:**

- Renderer bootstrap (`src/core/renderer.ts`) — single-renderer guarantee (Principle I) has no safe recovery if violated.
- Keybind capture chain (`src/core/keybinds/`) — foundational contract every future extension depends on (Principle IV, SC-004).
- Extension loader (`src/core/extensions/loader.ts`) — manifest-first + lazy `import()` gating is the enforcement point for Principle II.
- StorageAPI path scoping (`src/core/storage/StorageAPI.ts`) — the enforcement point for Principle III; a bug here breaks the sandbox guarantee for every extension, including future third-party ones.

**Agent-Delegated [ASYNC] Classifications:**

- Task CRUD/sort/validation logic (`src/extensions/tasks/task-store.ts`, `task-schema.ts`) — fully specified by data-model.md.
- Peek/Focus view components — layout follows FR-008/FR-011/FR-013 directly.
- Test fixtures, `node:test` scaffolding, quickstart fixture configs.

### Triage Audit Trail

| Task | Classification | Primary Criteria | Risk Level | Rationale |
|---|---|---|---|---|
| Renderer bootstrap | SYNC | Constitutional (Principle I) | High | No safe recovery from a second-renderer bug |
| Keybind capture chain | SYNC | Constitutional (Principle IV) | High | Foundational contract for all future extensions |
| Extension manifest loader | SYNC | Constitutional (Principle II) | High | Enforcement point for peer-dependency isolation |
| StorageAPI implementation | SYNC | Constitutional (Principle III) | High | Enforcement point for the storage sandbox |
| Task CRUD/sort/validation | ASYNC | Fully spec'd (data-model.md) | Low | Deterministic rules, no architectural judgment needed |
| Peek/Focus view components | ASYNC | Fully spec'd (FR-008, FR-011, FR-013) | Low | Mechanical UI wiring against a settled slot API |
| Test scaffolding/fixtures | ASYNC | Standard practice | Low | No project-specific judgment required |

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
