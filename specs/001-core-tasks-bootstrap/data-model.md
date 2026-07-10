# Data Model: Core Framework Bootstrap via Tasks Extension

## Task (owned by the Tasks extension, via StorageAPI)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (uuid) | yes | Generated on creation; stable identity for edit/delete/complete operations |
| `title` | string | yes | Non-empty after trimming (FR-015, FR-019). Rejected on create/edit if empty or whitespace-only |
| `completed` | boolean | yes | Defaults to `false` on creation (FR-009) |
| `createdAt` | string (ISO 8601) | yes | Set once at creation, immutable; used as secondary sort key (Clarifications session 2026-07-09) |
| `dueDate` | string (ISO 8601 date) \| `null` | no | Optional; primary sort key when present (closest-first). Invalid/unparseable input is rejected — value stays `null` (create) or unchanged (edit) per FR-020 |

**Validation rules**:
- `title`: reject if `trim(title).length === 0` (create: FR-015; edit: FR-019).
- `dueDate`: reject if the input fails date parsing; do not persist the invalid value (FR-020).

**Sort order** (focus view listing, FR-008):
1. Tasks with a `dueDate`, ascending (closest first).
2. Tasks without a `dueDate`, ascending by `createdAt`.
3. Within each group above, `completed: true` tasks are excluded when the "hide completed" toggle is active (FR-017); when shown, completed tasks always sort after all incomplete tasks, each completed sub-group ordered the same way (due date first, then creation time).

**Lifecycle**: create → (edit title/dueDate)* → (toggle completed)* → delete. No soft-delete; delete is permanent (FR-016).

## Extension Manifest (`extension.json`, read by the host loader before any extension code executes)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique extension identifier, used as the StorageAPI scope key |
| `name` | string | yes | Display name |
| `version` | string (semver) | yes | |
| `views` | `{ peek?: string; focus?: string }` | no | Named entry points the extension's module exports for the peek/focus slots (FR-003) |
| `commands` | `{ id: string; keybind?: string }[]` | no | Declared commands and their default local-scope keybind, if any (FR-006) |
| `activationEvents` | string[] | yes | e.g. `onSlot:grid`, `onCommand:tasks.add` — module is only `import()`-ed when one fires (constitution: manifest-first, lazy loading) |
| `storage` | boolean | no | Whether the extension needs a `StorageAPI` scope allocated (FR-005) |

**Validation**: Zod schema; validated before any `import()` of the extension's code (constitution: Development Workflow → Manifest-first loading).

## Dashboard Slot (host-defined enum, not persisted)

Named regions extensions register content into: `grid` (tile area), `sidebar`, `statusbar`, `overlay` (transient/popup layer) — FR-001, FR-003.

## Keybind Scope (host-defined enum, not persisted)

Ordered resolution levels used by the capture chain: `focused` → `local` (active extension) → `global` (FR-006). Each level either consumes a keypress or delegates it to the next; no level may be skipped (constitution Principle IV).
