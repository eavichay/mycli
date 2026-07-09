# Contract: Extension Manifest (`extension.json`)

Every extension — built-in or marketplace — ships an `extension.json` at its root. The host validates it against this schema before importing any of the extension's code (constitution: manifest-first loading).

## Schema (Zod, illustrative)

```ts
const ExtensionManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  views: z.object({
    peek: z.string().optional(),
    focus: z.string().optional(),
  }).optional(),
  commands: z.array(z.object({
    id: z.string().min(1),
    keybind: z.string().optional(),
  })).optional(),
  activationEvents: z.array(z.string()).min(1),
  storage: z.boolean().optional(),
});
```

## Guarantees provided to the extension author

- The host reads and validates this file before executing any of the extension's TypeScript (FR-002).
- The extension's module is `import()`-ed lazily, only when one of `activationEvents` fires — never at process startup.
- If validation fails, or the subsequent `import()`/render throws, the host renders a load-error state in that extension's `grid` slot instead of crashing (FR-014, SC-005). Sibling extensions and the dashboard shell are unaffected.

## Tasks extension's manifest (concrete instance)

```json
{
  "id": "tasks",
  "name": "Tasks",
  "version": "1.0.0",
  "views": { "peek": "PeekView", "focus": "FocusView" },
  "commands": [
    { "id": "tasks.add", "keybind": "a" },
    { "id": "tasks.delete", "keybind": "d" },
    { "id": "tasks.edit", "keybind": "e" },
    { "id": "tasks.toggleComplete", "keybind": "space" },
    { "id": "tasks.toggleShowCompleted", "keybind": "c" }
  ],
  "activationEvents": ["onSlot:grid"],
  "storage": true
}
```
