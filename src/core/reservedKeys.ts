export interface ReservedKey {
  /** Canonical key id, per canonicalKeyId.ts */
  key: string;
  /** Display label for the action it's reserved for (e.g. "Quit") */
  label: string;
}

/**
 * Fixed, framework-owned list of keys no extension may ever bind a command
 * to or display as its own hint, at manifest-load time or at runtime
 * (FR-007, FR-008). Designed to grow later without requiring any change to
 * how extensions declare or check keys — the two enforcement points
 * (manifest filter, runtime hint filter) do all the work transparently.
 */
export const RESERVED_KEYS: readonly ReservedKey[] = [{ key: "ctrl+q", label: "Quit" }];

const RESERVED_KEY_SET = new Set(RESERVED_KEYS.map((k) => k.key));

export function isReservedKey(canonicalId: string): boolean {
  return RESERVED_KEY_SET.has(canonicalId);
}
