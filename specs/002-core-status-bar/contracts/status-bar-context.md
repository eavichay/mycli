# Contract: Status Bar Context API

Every extension's `activate()` function already receives an `ExtensionActivationContext` (`{ host, registry, manifest }`) at load time, per `001-core-tasks-bootstrap`'s loader. This feature adds one more property to that same object: `statusBar`.

## Interface (illustrative)

```ts
interface StatusBarContextAPI {
  /** Replace this extension's hint set. Manifest-derived defaults stop applying until clear() is called. */
  setHints(hints: { key: string; label: string }[]): void;
  /** Replace this extension's free-text message, independent of any hints. Pass null to clear just the message. */
  setMessage(message: string | null): void;
  /** Clear both hints and message; the extension reverts to its manifest-derived default display. */
  clear(): void;
}

interface ExtensionActivationContext {
  host: HostContext;
  registry: HostSlotRegistry;
  manifest: ExtensionManifest;
  statusBar: StatusBarContextAPI;
}
```

## Usage pattern

Extensions capture `statusBar` in their module-level closure at `activate()` time, the same way Tasks already captures `store`:

```ts
const activate: ExtensionActivate = (ctx) => {
  const store = createTasksReactiveStore(ctx.host.getStorage(ctx.manifest.id));
  const FocusView = createFocusView(store, ctx.statusBar);
  // ...
};
```

`FocusView`'s own event handlers call `ctx.statusBar.setHints([...])` / `setMessage(...)` when its internal mode changes (e.g. entering an "add task" flow), exactly as they already call `store.add(...)` etc.

## Guarantees

- **Default behavior (FR-002)**: until an extension calls `setHints()`, the host displays that extension's manifest-declared `commands[]` as hints automatically — no action required from the extension.
- **Override (FR-003)**: calling `setHints()` fully replaces the manifest-derived default for that extension's own hints. Unclaimed global hints (see `reserved-keys.md`) still merge in regardless.
- **Reserved-key filtering (FR-011)**: any hint passed to `setHints()` whose key is reserved is silently dropped before storage — it will never render, and no error is raised.
- **Automatic cleanup (FR-005)**: the host — not the extension — calls `clear()` on this extension's behalf the moment its focus view is exited. Extensions do not need to call `clear()` themselves on unmount, though they may call it any time they want to explicitly revert to defaults while still focused.
- **Immediate reflection (FR-004, SC-003)**: any `setHints()`/`setMessage()` call is reflected in the status bar's next render — no additional signal or refresh call is needed.
