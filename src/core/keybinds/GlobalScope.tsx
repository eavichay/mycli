import React, { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { canonicalKeyId } from "./canonicalKeyId.ts";
import { isReservedKey } from "../reservedKeys.ts";

export type ScopeLevel = "focused" | "local" | "global";

/** A scope handler either consumes the key (returns true) or delegates it onward (returns false). */
export type KeyClaimHandler = (key: KeyEvent) => boolean;

interface DispatcherContextValue {
  register(level: ScopeLevel, handler: KeyClaimHandler): () => void;
}

const DispatcherContext = createContext<DispatcherContextValue | null>(null);

/**
 * Fixed, inspectable resolution order (constitution Principle IV, FR-006):
 * focused element -> local (active extension) -> global. No level may be
 * skipped, and each level's handler explicitly claims or delegates — there
 * is no flat "handled" boolean.
 */
const LEVEL_ORDER: readonly ScopeLevel[] = ["focused", "local", "global"];

/**
 * The single root-mounted keyboard subscription for the whole process. Every
 * `FocusedScope`/`LocalScope`/`GlobalScope` registers into this dispatcher
 * rather than each mounting its own independent `useKeyboard` listener, so
 * that "the first scope that handles the key" can be enforced deterministically.
 */
export function KeybindDispatcherProvider({ children }: { children: ReactNode }) {
  const registries = useRef<Record<ScopeLevel, KeyClaimHandler[]>>({
    focused: [],
    local: [],
    global: [],
  });

  const register = useCallback((level: ScopeLevel, handler: KeyClaimHandler) => {
    registries.current[level].push(handler);
    return () => {
      registries.current[level] = registries.current[level].filter((h) => h !== handler);
    };
  }, []);

  useKeyboard((key) => {
    for (const level of LEVEL_ORDER) {
      const handlers = registries.current[level];
      for (let i = handlers.length - 1; i >= 0; i -= 1) {
        if (handlers[i](key)) return; // claimed: stop here, no lower-precedence scope sees this key
      }
    }
  });

  return <DispatcherContext.Provider value={{ register }}>{children}</DispatcherContext.Provider>;
}

/** Shared by FocusedScope/LocalScope/GlobalScope to register a command map at a given level. */
export function useScopeCommands(
  level: ScopeLevel,
  commands: Record<string, () => void>,
  active = true,
): void {
  const ctx = useContext(DispatcherContext);
  if (!ctx) {
    throw new Error("Keybind scope hooks must be used within a KeybindDispatcherProvider");
  }

  const handler = useCallback<KeyClaimHandler>(
    (key) => {
      const id = canonicalKeyId(key);
      // Reserved keys can never be claimed at focused/local scope, no matter
      // how an extension's code tries to register one — this is the
      // authoritative enforcement point (FR-007, FR-010): the manifest
      // filter and the status-bar hint filter both guard *metadata/display*,
      // but only this guarantees the reserved key's global action always
      // actually fires, regardless of what any extension's own code does.
      if (level !== "global" && isReservedKey(id)) return false;
      const action = commands[id];
      if (action) {
        action();
        return true;
      }
      return false;
    },
    [commands, level],
  );

  useEffect(() => {
    if (!active) return undefined;
    return ctx.register(level, handler);
  }, [active, ctx, handler, level]);
}

/**
 * Global-scope keybinds — always mounted at the app root, only ever receiving
 * keys that no more specific (focused/local) scope claimed.
 */
export function useGlobalKeybinds(commands: Record<string, () => void>): void {
  useScopeCommands("global", commands, true);
}
