import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageScopeFactory } from "../../src/core/storage/StorageAPI.ts";
import { addTask, editTask, deleteTask, toggleComplete, listTasks, sortTasks, filterTasks } from "../../src/extensions/tasks/task-store.ts";

async function withStorage<T>(fn: (storage: ReturnType<ReturnType<typeof createStorageScopeFactory>>) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "mycli-task-store-test-"));
  try {
    const getStorage = createStorageScopeFactory({ dataRoot: dir });
    return await fn(getStorage("tasks"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("FR-015: adding a task with an empty or whitespace-only title is rejected", async () => {
  await withStorage(async (storage) => {
    const result = await addTask(storage, "   ");
    assert.equal(result.ok, false);
    assert.deepEqual(await listTasks(storage), []);
  });
});

test("FR-020: adding a task with an invalid due date is rejected, no task created", async () => {
  await withStorage(async (storage) => {
    const result = await addTask(storage, "Buy milk", "not-a-date");
    assert.equal(result.ok, false);
    assert.deepEqual(await listTasks(storage), []);
  });
});

test("FR-007, FR-010: a valid task is added and persists", async () => {
  await withStorage(async (storage) => {
    const result = await addTask(storage, "Buy milk", "2026-08-01");
    assert.equal(result.ok, true);
    const tasks = await listTasks(storage);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, "Buy milk");
    assert.equal(tasks[0].dueDate, "2026-08-01");
    assert.equal(tasks[0].completed, false);
  });
});

test("FR-009: toggling completion flips the state", async () => {
  await withStorage(async (storage) => {
    await addTask(storage, "Buy milk");
    const [task] = await listTasks(storage);
    await toggleComplete(storage, task.id);
    assert.equal((await listTasks(storage))[0].completed, true);
    await toggleComplete(storage, task.id);
    assert.equal((await listTasks(storage))[0].completed, false);
  });
});

test("FR-016: deleting a task removes it permanently", async () => {
  await withStorage(async (storage) => {
    await addTask(storage, "Buy milk");
    const [task] = await listTasks(storage);
    await deleteTask(storage, task.id);
    assert.deepEqual(await listTasks(storage), []);
  });
});

test("FR-018, FR-019: editing a task's title to empty is rejected, original title kept", async () => {
  await withStorage(async (storage) => {
    await addTask(storage, "Buy milk");
    const [task] = await listTasks(storage);
    const result = await editTask(storage, task.id, { title: "   " });
    assert.equal(result.ok, false);
    assert.equal((await listTasks(storage))[0].title, "Buy milk");
  });
});

test("FR-018, FR-020: editing a task's due date to an invalid value is rejected, prior due date kept", async () => {
  await withStorage(async (storage) => {
    await addTask(storage, "Buy milk", "2026-08-01");
    const [task] = await listTasks(storage);
    const result = await editTask(storage, task.id, { dueDate: "banana" });
    assert.equal(result.ok, false);
    assert.equal((await listTasks(storage))[0].dueDate, "2026-08-01");
  });
});

test("FR-018: a valid edit updates title and due date", async () => {
  await withStorage(async (storage) => {
    await addTask(storage, "Buy milk");
    const [task] = await listTasks(storage);
    const result = await editTask(storage, task.id, { title: "Buy oat milk", dueDate: "2026-09-01" });
    assert.equal(result.ok, true);
    const [updated] = await listTasks(storage);
    assert.equal(updated.title, "Buy oat milk");
    assert.equal(updated.dueDate, "2026-09-01");
  });
});

test("FR-008: sort order is due-date-first (closest), then undated by creation time, completed always last", () => {
  const base = { id: "", title: "", completed: false, createdAt: "", dueDate: null as string | null };
  const tasks = [
    { ...base, id: "undated-older", createdAt: "2026-01-01T00:00:00.000Z" },
    { ...base, id: "far-due", dueDate: "2026-12-01" },
    { ...base, id: "undated-newer", createdAt: "2026-01-02T00:00:00.000Z" },
    { ...base, id: "near-due", dueDate: "2026-08-01" },
    { ...base, id: "completed-near-due", dueDate: "2026-07-01", completed: true },
  ];

  const sorted = sortTasks(tasks).map((t) => t.id);
  assert.deepEqual(sorted, ["near-due", "far-due", "undated-older", "undated-newer", "completed-near-due"]);
});

test("FR-017: filterTasks hides completed tasks when showCompleted is false", () => {
  const base = { id: "", title: "", completed: false, createdAt: "", dueDate: null as string | null };
  const tasks = [
    { ...base, id: "a", completed: false },
    { ...base, id: "b", completed: true },
  ];
  assert.deepEqual(filterTasks(tasks, false).map((t) => t.id), ["a"]);
  assert.deepEqual(filterTasks(tasks, true).map((t) => t.id), ["a", "b"]);
});
