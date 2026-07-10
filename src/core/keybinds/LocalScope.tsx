import { useScopeCommands } from "./GlobalScope.tsx";

/**
 * Local-scope keybinds — only registered while the owning extension's focus
 * view is active (`active` should reflect that). Delegates any unclaimed key
 * to the global scope.
 */
export function useLocalKeybinds(commands: Record<string, () => void>, active: boolean): void {
  useScopeCommands("local", commands, active);
}
