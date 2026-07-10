# Contract: Reserved Keys

A fixed, framework-owned list of keys that no extension may ever bind a command to or display as its own hint, at manifest-load time or at runtime (FR-007). Extensions never need to know this list's contents — the three enforcement points below do all the work transparently.

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

## Enforcement point 3 — dispatch registration (FR-010; discovered during implementation)

Enforcement points 1 and 2 only guard *metadata* (the manifest's declared `commands[]`, and the status bar's displayed hints) — neither prevents an extension's own component code from directly calling `useLocalKeybinds({ "ctrl+q": handler })`, bypassing its manifest entirely. Since local scope has higher dispatch precedence than global (constitution Principle IV), that would let a reserved key be claimed at local scope before global ever saw it.

`useScopeCommands()` (in `src/core/keybinds/GlobalScope.tsx`) is the actual enforcement point that closes this: it filters any reserved key out of the command lookup whenever `level !== "global"`, regardless of how that key ended up in the `commands` object passed to `useLocalKeybinds`/`useFocusedKeybinds`. This is what makes FR-010 ("pressing a reserved key always triggers its global action") hold unconditionally — not "unless an extension circumvents its own manifest."

## What reserved keys do NOT change

- The three-level (focused → local → global) keybind resolution order is untouched — reserved keys are a registration-time content filter, not a fourth scope or a change to dispatch precedence (constitution Principle IV unaffected).
- Pressing a reserved key always triggers its one global action (FR-010) — guaranteed directly by enforcement point 3, not merely as a side effect of enforcement point 1.
