import React, { useSyncExternalStore } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { layoutStatusBar } from "./statusBar/layoutStatusBar.ts";
import type { GlobalCommand } from "./globalCommands.ts";
import type { StatusBarContextAPI, StatusBarHint } from "./statusBar/StatusBarContextAPI.ts";
import type { ExtensionManifest } from "./extensions/manifest.ts";

export interface FocusedExtensionStatusBarInfo {
  manifest: ExtensionManifest;
  statusBar: StatusBarContextAPI;
}

export interface StatusBarProps {
  globalCommands: GlobalCommand[];
  /** null when no extension is focused (dashboard) */
  focused: FocusedExtensionStatusBarInfo | null;
}

const noopSubscribe = () => () => {};
const emptyHints: StatusBarHint[] = [];

/**
 * Renders into the existing `statusbar` slot: global command hints when
 * nothing is focused (FR-001), the focused extension's manifest-derived
 * default hints (FR-002) unless it has customized them (FR-003), merged
 * with any unclaimed global hints (FR-006a) and the extension's custom
 * message (FR-013), all width-budgeted with reserved-key hints exempt from
 * truncation (FR-012).
 */
export function StatusBar(props: StatusBarProps): React.ReactNode {
  const { width } = useTerminalDimensions();
  const subscribe = props.focused ? props.focused.statusBar.subscribe : noopSubscribe;
  const getHints = props.focused ? props.focused.statusBar.getHints : () => emptyHints;
  const getMessage = props.focused ? props.focused.statusBar.getMessage : () => null;

  const customHints = useSyncExternalStore(subscribe, getHints);
  const message = useSyncExternalStore(subscribe, getMessage);

  let extensionHints: StatusBarHint[] | null = null;
  if (props.focused) {
    // FR-002/FR-003: custom hints (if any) fully replace the manifest-derived default.
    extensionHints = customHints.length > 0 ? customHints : manifestHints(props.focused.manifest);
  }

  const text = layoutStatusBar({
    globalCommands: props.globalCommands,
    extensionHints,
    message: props.focused ? message : null,
    width,
  });

  return <text>{text}</text>;
}

function manifestHints(manifest: ExtensionManifest): StatusBarHint[] {
  return (manifest.commands ?? [])
    .filter((cmd) => !!cmd.keybind)
    .map((cmd) => ({ key: cmd.keybind as string, label: cmd.id }));
}
