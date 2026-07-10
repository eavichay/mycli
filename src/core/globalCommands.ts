export interface GlobalCommand {
  /** Canonical key id, per canonicalKeyId.ts */
  key: string;
  /** Display label shown in the status bar (e.g. "Quit") */
  label: string;
  action: () => void;
}

/**
 * Single source of truth for the app's global commands — both the dispatch
 * map `useGlobalKeybinds()` registers and the status bar's default/unclaimed
 * hint display (FR-001, FR-006a) are derived from this same list, so the two
 * can never drift out of sync.
 */
export function createGlobalCommands(deps: {
  quit: () => void;
  openFocusView: () => void;
  backToDashboard: () => void;
}): GlobalCommand[] {
  return [
    { key: "ctrl+q", label: "Quit", action: deps.quit },
    { key: "return", label: "Open", action: deps.openFocusView },
    { key: "escape", label: "Back", action: deps.backToDashboard },
  ];
}

export function globalCommandsToKeyMap(commands: GlobalCommand[]): Record<string, () => void> {
  const map: Record<string, () => void> = {};
  for (const cmd of commands) map[cmd.key] = cmd.action;
  return map;
}
