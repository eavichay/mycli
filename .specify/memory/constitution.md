<!--
Sync Impact Report
Version change: (none) → 1.0.0
Modified principles: n/a (initial ratification)
Added sections:
  - Core Principles I–V (Single-Renderer Ownership, Extension Peer-Dependency Isolation,
    Scoped Storage Only, Deterministic Keybind Resolution, Fault-Isolated Extensions)
  - Technology Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ⚠ pending (add Constitution Check gate referencing
    these 5 principles before Phase 0 research)
  - .specify/templates/spec-template.md ✅ no changes needed (stays implementation-agnostic
    by design; principles apply at plan/implementation stage)
  - .specify/templates/tasks-template.md ⚠ pending (ensure task categorization can flag
    peer-dependency violations, storage-path violations, and per-extension error boundaries)
Follow-up TODOs: none — all fields fully specified from project brainstorm context.
-->

# MyCLI Constitution

## Core Principles

### I. Single-Renderer Ownership
There is exactly one terminal renderer per process, owned by the host application.
Extensions MUST NOT call renderer-construction APIs (e.g. `createCliRenderer`) themselves,
under any circumstance. All extension UI is composed into the host's render tree through the
slot registry only. Rationale: a second renderer instance racing the host for control of the
terminal is a class of bug with no safe recovery — it must be structurally impossible, not
just discouraged.

### II. Extension Peer-Dependency Isolation
Extensions MUST declare their UI framework (React and the OpenTUI renderer package) as
`peerDependencies` and MUST NOT bundle their own copies. Extension code is loaded in-process
via `import().then()` — never `require()`, never a worker thread — so the host's single
framework instance is always what extension code executes against. Rationale: duplicate
framework instances in the same process cause invalid-hook-call errors (JS-level) or, on
native-backed renderers, memory-unsafe crashes (process-level). Same-process dynamic import
is also what keeps the shared-instance guarantee possible; workers would silently break it.

### III. Scoped Storage Only
Extensions MUST access persistent data exclusively through the `StorageAPI` object supplied
via `AppContext`. Extensions MUST NOT construct or receive raw filesystem paths. The host is
solely responsible for path scoping, normalization, and traversal validation. Rationale:
this is what makes extension uninstall, backup, and marketplace-installed third-party code
safe by construction — an extension that never sees a real path cannot escape its sandbox
even if compromised or buggy.

### IV. Deterministic Keybind Resolution
Every keypress resolves through a fixed, three-level scope chain: focused element → local
(active extension) → global. Each level is implemented as a capture wrapper that either
consumes the key or explicitly delegates it upward; there is no flat "handled" boolean and
no scope may be skipped. Rationale: with multiple independently-authored extensions sharing
one keyboard, an undefined or ad hoc resolution order guarantees collisions. A fixed,
inspectable chain makes every keybind conflict resolvable by inspection, not by trial and
error.

### V. Fault-Isolated Extensions
A failure in one extension (load error, render exception, crashed subprocess for `stdout`
extensions) MUST NOT crash the host application or affect any other extension's slot. The
failing extension's slot MUST degrade to a visible error state while the rest of the
dashboard continues operating normally. Rationale: this is a marketplace of independently
authored, independently versioned code from day 0 — the host's stability cannot depend on
the correctness of code it did not write.

## Technology Constraints

- **Runtime**: Node.js 26.3.0+, launched through a bash wrapper that encapsulates
  `--experimental-ffi` — this flag MUST NOT be exposed to end users directly.
- **TUI stack**: `@opentui/react` + `@opentui/core`, using `createReactSlotRegistry` as the
  marketplace extension mechanism. Switching renderers (e.g. to a future stable OpenTUI
  major, or away from OpenTUI entirely) is a constitutional amendment, not a routine
  dependency bump, because Principles I and II are written against this renderer's specific
  guarantees.
- **Language**: TypeScript, using Node.js's native type-stripping — no separate `tsc` build
  step for running the app.
- **Config**: Zod-validated YAML is the only supported configuration format.
- **Storage**: Filesystem-backed, scoped per extension. A future SQLite-backed StorageAPI
  upgrade must preserve the same scoping guarantee (Principle III) before it can replace or
  supplement filesystem storage.

## Development Workflow

- **Manifest-first loading**: The host MUST read and validate an extension's
  `extension.json` before executing any of that extension's code. Extension code is loaded
  lazily, only when its declared `activationEvents` fire — not eagerly at startup.
- **Testing**: Framework-level behavior (slot registry, keybind resolution chain, storage
  scoping) MUST have automated test coverage before an extension is allowed to depend on it.
  Headless/testing-library-style tests are preferred over manual terminal verification for
  anything that isn't purely visual.
- **Built-in extensions are ordinary extensions**: Tasks, Notes, and any other bundled
  extension MUST go through the same manifest + loader + slot-registry path as a
  marketplace-installed extension. No built-in extension may take a shortcut (e.g. direct
  renderer access) unavailable to third-party extensions.

## Governance

This constitution supersedes ad hoc practice for every principle it states. Any plan or
implementation that conflicts with a Core Principle MUST either be revised to comply or the
constitution MUST be amended first — silent deviation is not permitted.

**Amendment procedure**: Amendments are proposed as an edit to this file, accompanied by a
Sync Impact Report (prepended as an HTML comment, as in this version) explaining what
changed and why. Amendments take effect immediately upon being committed to the repository;
there is no separate ratification step beyond the commit itself for this single-maintainer
project.

**Versioning policy** (semantic versioning applied to this document):
- **MAJOR**: A principle is removed or redefined in a way that is incompatible with prior
  guidance (e.g., relaxing Principle I to allow multiple renderers).
- **MINOR**: A new principle or a materially expanded section is added.
- **PATCH**: Wording, clarification, or typo fixes with no change in obligation.

**Compliance review**: `/spec-plan` MUST include an explicit Constitution Check against
these five principles before implementation planning proceeds. Any violation must be
justified in the plan's complexity-tracking section or the plan must be revised.

**Version**: 1.0.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
