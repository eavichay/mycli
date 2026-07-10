import React from "react";
import { Slot } from "@opentui/react";
import type { HostSlotRegistry, Slots, HostContext } from "./slots.ts";

export interface DashboardShellProps {
  registry: HostSlotRegistry;
  /** id of the extension currently occupying the focus view, or null when on the dashboard */
  activeExtensionId: string | null;
  /** rendered by the caller when activeExtensionId is set (see FocusFrame, T033/T034) */
  focusContent?: React.ReactNode;
  /** true when zero extensions are configured (FR-001: shell must still render its regions) */
  hasNoExtensions: boolean;
  /**
   * Extra content appended into the grid area alongside any successfully
   * registered extension tiles — used for load-error tiles (FR-014, SC-005),
   * since an extension whose manifest/import failed never reaches
   * `registry.register()` and so has no slot contribution of its own.
   */
  extraGridContent?: React.ReactNode;
  /**
   * The contextual keybind-hint display (002-core-status-bar). Rendered
   * alongside the existing `statusbar` Slot rather than through the
   * registry, since it needs host-level state (focused extension, global
   * commands) the per-plugin Slot render signature doesn't carry.
   */
  statusBarContent?: React.ReactNode;
}

/**
 * The dashboard shell: grid/sidebar/statusbar/overlay regions (FR-001), even
 * when no extensions are loaded. Each `<Slot>` already isolates a
 * misbehaving plugin's render to a placeholder via `pluginFailurePlaceholder`
 * (constitution Principle V, FR-014) — see the note on the de-scoped
 * ErrorBoundary component in tasks.md T007.
 */
export function DashboardShell(props: DashboardShellProps): React.ReactNode {
  const { registry, activeExtensionId, focusContent, hasNoExtensions, extraGridContent, statusBarContent } = props;

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" flexGrow={1}>
        <box flexGrow={1} flexDirection="row" title="grid">
          {activeExtensionId ? (
            focusContent
          ) : (
            <Slot<Slots, HostContext> registry={registry} name="grid" mode="append" pluginFailurePlaceholder={renderPluginFailure}>
              {hasNoExtensions ? <text>{"No extensions loaded."}</text> : null}
              {extraGridContent}
            </Slot>
          )}
        </box>
        <box width={24} title="sidebar">
          <Slot<Slots, HostContext> registry={registry} name="sidebar" mode="append" pluginFailurePlaceholder={renderPluginFailure} />
        </box>
      </box>
      <box height={1} title="statusbar">
        <Slot<Slots, HostContext> registry={registry} name="statusbar" mode="append" pluginFailurePlaceholder={renderPluginFailure} />
        {statusBarContent}
      </box>
      <box position="absolute" title="overlay">
        <Slot<Slots, HostContext> registry={registry} name="overlay" mode="append" pluginFailurePlaceholder={renderPluginFailure} />
      </box>
    </box>
  );
}

function renderPluginFailure(): React.ReactNode {
  return <text fg="red">{"[extension failed to load]"}</text>;
}
