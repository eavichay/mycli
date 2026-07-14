import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalKeybinds } from "../../core/keybinds/LocalScope.tsx";
import { useFocusedKeybinds } from "../../core/keybinds/FocusedScope.tsx";
import { sortTasks, filterTasks } from "./task-store.ts";
import type { TasksReactiveStore } from "./reactive-store.ts";
import type { StatusBarContextAPI } from "../../core/statusBar/StatusBarContextAPI.ts";

type Mode =
  | { kind: "list" }
  | { kind: "add"; step: "title" | "dueDate"; title?: string }
  | { kind: "edit"; taskId: string; step: "title" | "dueDate"; title?: string };

/**
 * Full task list (FR-008), add/edit/delete/toggle-complete commands
 * (FR-007, FR-009, FR-016, FR-018), and the hide-completed toggle (FR-017),
 * all wired through LocalScope so they only fire while this view is active
 * (US4 / SC-004).
 */
export function createFocusView(store: TasksReactiveStore, statusBar: StatusBarContextAPI) {
  return function FocusView() {
    const tasks = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const [mode, setMode] = useState<Mode>({ kind: "list" });
    const [showCompleted, setShowCompleted] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      store.refresh();
    }, []);

    // US3: reflect the current mode as custom status-bar hints/message,
    // reverting to manifest defaults (via clear()) while in the plain list
    // mode. The host clears this again on focus-exit regardless (FR-005).
    useEffect(() => {
      if (mode.kind === "list") {
        statusBar.clear();
        return;
      }
      const isTitleStep = mode.step === "title";
      statusBar.setHints([
        { key: "return", label: isTitleStep ? "Next" : "Submit" },
        { key: "escape", label: "Cancel" },
      ]);
      statusBar.setMessage(error);
    }, [mode, error]);

    const visible = sortTasks(filterTasks(tasks, showCompleted));
    const selected = visible[Math.min(selectedIndex, Math.max(0, visible.length - 1))];
    const editingActive = mode.kind !== "list";

    useLocalKeybinds(
      {
        a: () => {
          setInputValue("");
          setError(null);
          setMode({ kind: "add", step: "title" });
        },
        d: () => {
          if (selected) void store.remove(selected.id);
        },
        e: () => {
          if (selected) {
            setInputValue(selected.title);
            setError(null);
            setMode({ kind: "edit", taskId: selected.id, step: "title" });
          }
        },
        space: () => {
          if (selected) void store.toggle(selected.id);
        },
        c: () => setShowCompleted((v) => !v),
        up: () => setSelectedIndex((i) => Math.max(0, i - 1)),
        down: () => setSelectedIndex((i) => Math.min(Math.max(0, visible.length - 1), i + 1)),
      },
      mode.kind === "list",
    );

    useFocusedKeybinds(
      {
        escape: () => {
          setMode({ kind: "list" });
          setError(null);
        },
      },
      editingActive,
    );

    async function handleSubmit(value: string) {
      if (mode.kind === "add" && mode.step === "title") {
        setMode({ kind: "add", step: "dueDate", title: value });
        setInputValue("");
        setError(null);
        return;
      }
      if (mode.kind === "add" && mode.step === "dueDate") {
        const result = await store.add(mode.title ?? "", value || null);
        if (!result.ok) {
          setError(result.error ?? "Invalid due date.");
          return;
        }
        setMode({ kind: "list" });
        setError(null);
        return;
      }
      if (mode.kind === "edit" && mode.step === "title") {
        setMode({ kind: "edit", taskId: mode.taskId, step: "dueDate", title: value });
        const current = tasks.find((t) => t.id === mode.taskId);
        setInputValue(current?.dueDate ?? "");
        setError(null);
        return;
      }
      if (mode.kind === "edit" && mode.step === "dueDate") {
        const result = await store.edit(mode.taskId, { title: mode.title, dueDate: value || null });
        if (!result.ok) {
          setError(result.error ?? "Invalid due date.");
          return;
        }
        setMode({ kind: "list" });
        setError(null);
      }
    }

    return (
      <box flexDirection="column" flexGrow={1}>
        <text>{`Show completed: ${showCompleted ? "on" : "off"} (press 'c' to toggle)`}</text>
        {visible.length === 0 ? (
          <text>{"No tasks yet. Press 'a' to add one."}</text>
        ) : (
          <box flexDirection="column">
            {visible.map((task, i) => (
              <text key={task.id} fg={i === selectedIndex ? "yellow" : undefined}>
                {`${task.completed ? "[x]" : "[ ]"} ${task.title}${task.dueDate ? ` (due ${task.dueDate})` : ""}`}
              </text>
            ))}
          </box>
        )}
        {editingActive && (
          <box flexDirection="column" marginTop={1}>
            <text>
              {mode.kind === "add" && mode.step === "title" && "New task title:"}
              {mode.kind === "add" && mode.step === "dueDate" && "Due date (optional, YYYY-MM-DD, Enter to skip):"}
              {mode.kind === "edit" && mode.step === "title" && "Edit task title:"}
              {mode.kind === "edit" && mode.step === "dueDate" && "Due date (optional, YYYY-MM-DD, Enter to clear):"}
            </text>
            {/* @opentui/react@0.4.3's InputProps.onSubmit type is an unsatisfiable intersection
                of the HTML form onSubmit and its own (value: string) => void signature; the
                runtime behavior (documented in @opentui/react's README) is the latter. */}
            <input
              focused={true}
              value={inputValue}
              onInput={setInputValue}
              onSubmit={((value: string) => void handleSubmit(value)) as never}
            />
            {error && <text fg="red">{error}</text>}
          </box>
        )}
      </box>
    );
  };
}
