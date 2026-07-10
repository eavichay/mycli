# Contract: Reserved Keys

A fixed, framework-owned list of keys that no extension may ever bind a command to or display as its own hint, at manifest-load time or at runtime (FR-007). Extensions never need to know this list's contents — the two enforcement points below do all the work transparently.

## The list (this feature)

| Canonical key id | Reserved for |
|---|---|
| `ctrl+q` | Quit |

Designed to grow later (spec Assumptions) without requiring any change to how extensions declare or check keys.

## Enforcement point 1 — manifest load (FR-009)

`validateManifest()` (in `src/core/extensions/manifest.ts`) filters `commands[]`: any entry whose canonicalized `keybind` matches a reserved key is removed from the manifest *before* the loader registers anything. The extension still validates successfully and loads normally — only that one command is absent. This is silent (spec Assumptions: not surfaced to the end user; an extension author's own testing is expected to catch it).

```ts
// illustrative
const filteredCommands = rawManifest.commands?.filter(
  (cmd) => !RESERVED_KEYS.has(canonicalKeyId(cmd.keybind))
);
```

## Enforcement point 2 — runtime hint API (FR-011)

`StatusBarContextAPI.setHints()` (see `status-bar-context.md`) filters out any hint entry whose `key` is reserved before storing it. An extension attempting to display `ctrl+q` as one of its own hints simply never sees that entry appear — no error, no exception.

## What reserved keys do NOT change

- The three-level (focused → local → global) keybind resolution order is untouched — reserved keys are a registration-time content filter, not a fourth scope or a change to dispatch precedence (constitution Principle IV unaffected).
- Pressing a reserved key always triggers its one global action (FR-010) — this falls out naturally from enforcement point 1: since no extension can ever successfully register that key, the global scope is the only registrant, and it always wins by default (nothing else claims the key first).
