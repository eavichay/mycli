import { canonicalKeyIdFromString } from "../keybinds/canonicalKeyId.ts";
import { isReservedKey } from "../reservedKeys.ts";

export interface StatusBarHint {
  /** Canonical key id or a manifest-style keybind string; canonicalized internally. */
  key: string;
  label: string;
}

/**
 * Extension-facing API for dynamically supplying status-bar hints/messages
 * (contracts/status-bar-context.md). One instance per extension, added to
 * that extension's ExtensionActivationContext by the loader.
 */
export interface StatusBarContextAPI {
  setHints(hints: StatusBarHint[]): void;
  setMessage(message: string | null): void;
  clear(): void;
  /** Host-side reads, used by StatusBar.tsx to render and by tests. */
  getHints(): StatusBarHint[];
  getMessage(): string | null;
  subscribe(listener: () => void): () => void;
}

export function createStatusBarContextAPI(): StatusBarContextAPI {
  let hints: StatusBarHint[] = [];
  let message: string | null = null;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    setHints(newHints) {
      // FR-011: reserved keys can never be displayed as belonging to an extension.
      hints = newHints.filter((h) => !isReservedKey(canonicalKeyIdFromString(h.key)));
      notify();
    },
    setMessage(newMessage) {
      message = newMessage;
      notify();
    },
    clear() {
      hints = [];
      message = null;
      notify();
    },
    getHints() {
      return hints;
    },
    getMessage() {
      return message;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
