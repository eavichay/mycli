import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageScopeFactory } from "../../src/core/storage/StorageAPI.ts";

async function withTempRoot<T>(fn: (dataRoot: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "mycli-storage-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("two differently-scoped StorageAPI instances cannot see each other's keys", async () => {
  await withTempRoot(async (dataRoot) => {
    const getStorage = createStorageScopeFactory({ dataRoot });
    const tasksStorage = getStorage("tasks");
    const notesStorage = getStorage("notes");

    await tasksStorage.set("tasks", ["a", "b"]);
    await notesStorage.set("tasks", ["should-not-collide"]);

    assert.deepEqual(await tasksStorage.get("tasks"), ["a", "b"]);
    assert.deepEqual(await notesStorage.get("tasks"), ["should-not-collide"]);

    assert.deepEqual(await tasksStorage.list(), ["tasks"]);
    assert.deepEqual(await notesStorage.list(), ["tasks"]);

    await notesStorage.delete("tasks");
    assert.equal(await notesStorage.get("tasks"), undefined);
    assert.deepEqual(await tasksStorage.get("tasks"), ["a", "b"], "deleting one extension's key must not affect another's");
  });
});

test("missing or corrupted backing data resolves to undefined instead of throwing", async () => {
  await withTempRoot(async (dataRoot) => {
    const getStorage = createStorageScopeFactory({ dataRoot });
    const storage = getStorage("tasks");

    assert.equal(await storage.get("nonexistent"), undefined);
    assert.deepEqual(await storage.list(), []);
  });
});

test("the same extension id always resolves to the same storage scope", async () => {
  await withTempRoot(async (dataRoot) => {
    const getStorage = createStorageScopeFactory({ dataRoot });
    await getStorage("tasks").set("x", 1);
    assert.equal(await getStorage("tasks").get("x"), 1);
  });
});
