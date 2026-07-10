import { useScopeCommands } from "./GlobalScope.tsx";

/**
 * Focused-scope keybinds — only registered while a specific focusable UI
 * element (e.g. an inline text input) holds focus. Highest precedence:
 * claims a key before local or global ever sees it.
 */
export function useFocusedKeybinds(commands: Record<string, () => void>, active: boolean): void {
  useScopeCommands("focused", commands, active);
}
