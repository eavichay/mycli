import React, { useEffect, useState } from "react";
import { useRenderer } from "@opentui/react";
import { DashboardShell } from "../core/DashboardShell.tsx";
import { KeybindDispatcherProvider, useGlobalKeybinds } from "../core/keybinds/GlobalScope.tsx";
import { useLocalKeybinds } from "../core/keybinds/LocalScope.tsx";
import { FocusFrame } from "../core/FocusFrame.tsx";
import { StatusBar, type FocusedExtensionStatusBarInfo } from "../core/StatusBar.tsx";
import { createGlobalCommands, globalCommandsToKeyMap } from "../core/globalCommands.ts";
import type { HostSlotRegistry } from "../core/slots.ts";
import type { ExtensionLoader } from "../core/extensions/loader.ts";

export interface AppProps {
  registry: HostSlotRegistry;
  loader: ExtensionLoader;
  /** ids of extensions declared enabled in host config, in order */
  extensionIds: string[];
}

function AppInner(props: AppProps) {
  const renderer = useRenderer();
  const [activeExtensionId, setActiveExtensionId] = useState<string | null>(null);

  const globalCommands = createGlobalCommands({
    quit: () => {
      renderer?.destroy();
    },
    openFocusView: () => {
      if (activeExtensionId) return;
      const firstLoaded = props.extensionIds.find((id) => props.loader.getState(id).status === "loaded");
      if (firstLoaded) setActiveExtensionId(firstLoaded);
    },
    backToDashboard: () => {
      if (activeExtensionId) setActiveExtensionId(null);
    },
  });

  useGlobalKeybinds(globalCommandsToKeyMap(globalCommands));

  // Local scope exists only so a focus view's own commands (registered by
  // the extension's FocusView itself, via useLocalKeybinds) take precedence
  // over these global bindings while active; this hook call just documents
  // that the local scope is "active" whenever a focus view is shown.
  useLocalKeybinds({}, activeExtensionId !== null);

  // FR-005: clearing an extension's status-bar customization on focus-exit
  // is host-owned, not an extension responsibility — this effect's cleanup
  // fires the moment activeExtensionId changes away from an extension (or
  // on unmount), regardless of whether that extension cleaned up itself.
  useEffect(() => {
    if (!activeExtensionId) return undefined;
    const id = activeExtensionId;
    return () => {
      props.loader.getStatusBar(id).clear();
    };
  }, [activeExtensionId, props.loader]);

  let focusContent: React.ReactNode = null;
  let focusedStatusBarInfo: FocusedExtensionStatusBarInfo | null = null;
  if (activeExtensionId) {
    const state = props.loader.getState(activeExtensionId);
    if (state.status === "loaded" && state.registration.FocusView) {
      const FocusView = state.registration.FocusView;
      focusContent = (
        <FocusFrame title={state.manifest.name}>
          <FocusView />
        </FocusFrame>
      );
      focusedStatusBarInfo = { manifest: state.manifest, statusBar: props.loader.getStatusBar(activeExtensionId) };
    }
  }

  // FR-014, SC-005: an extension whose manifest failed validation or whose
  // module import/activation threw never reaches registry.register(), so it
  // has no slot contribution of its own — surface a load-error tile for it
  // here instead, without affecting the dashboard or any other extension.
  const errorTiles = props.extensionIds
    .map((id) => ({ id, state: props.loader.getState(id) }))
    .filter(({ state }) => state.status === "invalid-manifest" || state.status === "load-error")
    .map(({ id, state }) => {
      const rawError = state.status === "invalid-manifest" || state.status === "load-error" ? state.error : "";
      // Zod validation errors are large multi-line JSON dumps — truncate so a
      // single failed extension's tile can't blow out the dashboard layout
      // and squeeze sibling tiles (FR-014, SC-005: isolation must be visual too).
      const summary = rawError.split("\n")[0].slice(0, 80);
      return (
        <box key={id} title={id} border borderColor="red">
          <text fg="red">{`[${id}] failed to load: ${summary}`}</text>
        </box>
      );
    });

  return (
    <DashboardShell
      registry={props.registry}
      activeExtensionId={activeExtensionId}
      focusContent={focusContent}
      hasNoExtensions={props.extensionIds.length === 0}
      extraGridContent={errorTiles.length > 0 ? <>{errorTiles}</> : null}
      statusBarContent={<StatusBar globalCommands={globalCommands} focused={focusedStatusBarInfo} />}
    />
  );
}

export function App(props: AppProps) {
  return (
    <KeybindDispatcherProvider>
      <AppInner {...props} />
    </KeybindDispatcherProvider>
  );
}
