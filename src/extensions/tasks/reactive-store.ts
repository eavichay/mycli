import type { StorageAPI } from "../../core/storage/StorageAPI.ts";
import { addTask, editTask, deleteTask, toggleComplete, listTasks, type MutationResult } from "./task-store.ts";
import type { Task } from "./task-schema.ts";

/**
 * Shared reactive wrapper around task-store.ts so the PeekView and FocusView
 * — two independent React trees mounted into different slots — stay in sync
 * (US2 AC3: "its state updates immediately in both focus and peek views").
 */
export interface TasksReactiveStore {
  getSnapshot(): Task[];
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  add(title: string, dueDate?: string | null): Promise<MutationResult>;
  edit(id: string, changes: { title?: string; dueDate?: string | null }): Promise<MutationResult>;
  remove(id: string): Promise<void>;
  toggle(id: string): Promise<void>;
}

export function createTasksReactiveStore(storage: StorageAPI): TasksReactiveStore {
  let snapshot: Task[] = [];
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  async function refresh() {
    snapshot = await listTasks(storage);
    notify();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    async add(title, dueDate) {
      const result = await addTask(storage, title, dueDate);
      if (result.ok) await refresh();
      return result;
    },
    async edit(id, changes) {
      const result = await editTask(storage, id, changes);
      if (result.ok) await refresh();
      return result;
    },
    async remove(id) {
      await deleteTask(storage, id);
      await refresh();
    },
    async toggle(id) {
      await toggleComplete(storage, id);
      await refresh();
    },
  };
}
