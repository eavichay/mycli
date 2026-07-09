# Contract: StorageAPI (via AppContext)

Every extension receives a `StorageAPI` instance through `AppContext`, scoped exclusively to that extension's own data. This is the only sanctioned way to persist data (constitution Principle III).

## Interface (illustrative)

```ts
interface StorageAPI {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

## Guarantees

- The extension never receives a filesystem path — only this interface. Path scoping, normalization, and traversal validation are the host's exclusive responsibility.
- Data written under one extension's `StorageAPI` is not visible or writable to any other extension's `StorageAPI` instance.
- Data persists across app restarts (FR-005, FR-010, SC-002); a missing or corrupted backing file is treated as "no data" — the extension starts empty rather than the host crashing (Edge Cases: storage missing/corrupted → empty task list).

## Tasks extension's usage

- Key: `"tasks"` → value: `Task[]` (see data-model.md).
- Read once on activation; every create/edit/delete/toggle-complete writes the full updated array back via `set("tasks", tasks)`.
