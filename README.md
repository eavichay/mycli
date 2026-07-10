# mycli

A terminal dashboard with a manifest-first extension system, built on [OpenTUI](https://github.com/anomalyco/opentui) (`@opentui/core` + `@opentui/react`). Ships with **Tasks** — a built-in keyboard-driven to-do list — as its first extension and end-to-end integration test.

See `.specify/memory/constitution.md` for the architectural principles this project is built against, and `specs/001-core-tasks-bootstrap/` for the full spec/plan/tasks history.

## Requirements

- Node.js 26.3.0+ (native TypeScript type-stripping)

## Install

```bash
npm install
```

## Run

```bash
./bin/mycli
# or, to launch against a specific host config:
./bin/mycli --config ./fixtures/tasks-only.yaml
```

`bin/mycli` launches via `node --experimental-ffi --import tsx/esm src/cli/index.ts`. Both flags matter:

- `--experimental-ffi` — OpenTUI's native renderer is FFI-backed and requires this.
- `--import tsx/esm` — enables JSX (Node's native type-stripping only erases TypeScript syntax, not JSX). Note this must be the `tsx` *loader* (`--import tsx/esm`), not the `tsx` CLI — the CLI wrapper was found to break OpenTUI's native FFI detection entirely; see `specs/001-core-tasks-bootstrap/tasks.md` (T001-T004 implementation note) for the full story.

### Keybinds

| Key | Scope | Action |
|---|---|---|
| `q` | global | quit |
| `Return` | global | open the Tasks focus view from the dashboard |
| `Escape` | global / focused | back to dashboard / cancel add-edit |
| `a` | local (Tasks focus view) | add a task |
| `d` | local | delete the selected task |
| `e` | local | edit the selected task |
| `Space` | local | toggle complete |
| `c` | local | toggle hide-completed |
| `↑` / `↓` | local | change the selected task |

## Test

```bash
npm test
```

Runs the full suite (unit, contract, integration) headlessly via `node:test` and `@opentui/react`'s `testRender`/`createTestRenderer` — no real terminal needed.

## Project structure

- `src/core/` — framework primitives: renderer bootstrap, slot registry, the three-level keybind resolution chain, `StorageAPI`, the manifest-first extension loader, the dashboard shell.
- `src/extensions/tasks/` — the Tasks extension, built through the exact same manifest + loader + slot-registry path any marketplace extension would use.
- `src/cli/` — the process entrypoint and root `App` component.
- `tests/` — `unit/`, `contract/`, `integration/`, mirroring `specs/001-core-tasks-bootstrap/tasks.md`.
- `fixtures/` — host config YAML files used by tests and manual quickstart validation.
