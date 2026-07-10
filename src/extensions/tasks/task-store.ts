import type { StorageAPI } from "../../core/storage/StorageAPI.ts";
import { isValidDueDate, isValidTitle, type Task } from "./task-schema.ts";

const TASKS_KEY = "tasks";

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readAll(storage: StorageAPI): Promise<Task[]> {
  const tasks = await storage.get<Task[]>(TASKS_KEY);
  return tasks ?? [];
}

async function writeAll(storage: StorageAPI, tasks: Task[]): Promise<void> {
  await storage.set(TASKS_KEY, tasks);
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

/** FR-007, FR-015, FR-020: add a task; reject empty title or invalid due date. */
export async function addTask(storage: StorageAPI, title: string, dueDate?: string | null): Promise<MutationResult> {
  if (!isValidTitle(title)) return { ok: false, error: "Title cannot be empty." };
  if (!isValidDueDate(dueDate)) return { ok: false, error: "Invalid due date." };

  const tasks = await readAll(storage);
  const task: Task = {
    id: randomId(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate: dueDate && dueDate !== "" ? dueDate : null,
  };
  tasks.push(task);
  await writeAll(storage, tasks);
  return { ok: true };
}

/** FR-018, FR-019, FR-020: edit a task's title and/or due date; reject invalid edits leaving prior state unchanged. */
export async function editTask(
  storage: StorageAPI,
  id: string,
  changes: { title?: string; dueDate?: string | null },
): Promise<MutationResult> {
  if (changes.title !== undefined && !isValidTitle(changes.title)) {
    return { ok: false, error: "Title cannot be empty." };
  }
  if (changes.dueDate !== undefined && !isValidDueDate(changes.dueDate)) {
    return { ok: false, error: "Invalid due date." };
  }

  const tasks = await readAll(storage);
  const task = tasks.find((t) => t.id === id);
  if (!task) return { ok: false, error: "Task not found." };

  if (changes.title !== undefined) task.title = changes.title.trim();
  if (changes.dueDate !== undefined) task.dueDate = changes.dueDate === "" ? null : changes.dueDate;

  await writeAll(storage, tasks);
  return { ok: true };
}

/** FR-009: mark complete or incomplete. */
export async function toggleComplete(storage: StorageAPI, id: string): Promise<void> {
  const tasks = await readAll(storage);
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  await writeAll(storage, tasks);
}

/** FR-016: delete a task permanently. */
export async function deleteTask(storage: StorageAPI, id: string): Promise<void> {
  const tasks = await readAll(storage);
  await writeAll(storage, tasks.filter((t) => t.id !== id));
}

export async function listTasks(storage: StorageAPI): Promise<Task[]> {
  return readAll(storage);
}

/**
 * FR-008: due date closest-first, then undated tasks by creation time,
 * completed tasks always sorted last (each group ordered the same way).
 */
export function sortTasks(tasks: Task[]): Task[] {
  const rank = (t: Task): number => (t.dueDate ? 0 : 1);
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    if (a.dueDate && b.dueDate) {
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (diff !== 0) return diff;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/** FR-017: hide-completed toggle filtering. */
export function filterTasks(tasks: Task[], showCompleted: boolean): Task[] {
  return showCompleted ? tasks : tasks.filter((t) => !t.completed);
}
