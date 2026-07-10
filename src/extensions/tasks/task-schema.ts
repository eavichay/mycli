import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
  dueDate: z.string().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

/** FR-015, FR-019: reject empty or whitespace-only titles on create and edit. */
export function isValidTitle(title: string): boolean {
  return title.trim().length > 0;
}

/**
 * FR-020: reject invalid/unparseable due dates. Empty string / undefined /
 * null means "no due date" and is always valid; anything else must parse to
 * a real calendar date.
 */
export function isValidDueDate(dueDate: string | null | undefined): boolean {
  if (dueDate === null || dueDate === undefined || dueDate === "") return true;
  const parsed = new Date(dueDate);
  return !Number.isNaN(parsed.getTime());
}
