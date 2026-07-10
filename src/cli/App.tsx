import React, { useState } from "react";
import { useRenderer } from "@opentui/react";
import { DashboardShell } from "../core/DashboardShell.tsx";
import { KeybindDispatcherProvider, useGlobalKeybinds } from "../core/keybinds/GlobalScope.tsx";
import { useLocalKeybinds } from "../core/keybinds/LocalScope.tsx";
import { FocusFrame } from "../core/FocusFrame.tsx";
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

  useGlobalKeybinds({
    q: () => {
      renderer?.destroy();
    },
    return: () => {
      if (activeExtensionId) return;
      const firstLoaded = props.extensionIds.find((id) => props.loader.getState(id).status === "loaded");
      if (firstLoaded) setActiveExtensionId(firstLoaded);
    },
    escape: () => {
      if (activeExtensionId) setActiveExtensionId(null);
    },
  });

  // Local scope exists only so a focus view's own commands (registered by
  // the extension's FocusView itself, via useLocalKeybinds) take precedence
  // over these global bindings while active; this hook call just documents
  // that the local scope is "active" whenever a focus view is shown.
  useLocalKeybinds({}, activeExtensionId !== null);

  let focusContent: React.ReactNode = null;
  if (activeExtensionId) {
    const state = props.loader.getState(activeExtensionId);
    if (state.status === "loaded" && state.registration.FocusView) {
      const FocusView = state.registration.FocusView;
      focusContent = (
        <FocusFrame title={state.manifest.name}>
          <FocusView />
        </FocusFrame>
      );
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
