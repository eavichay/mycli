import type { GlobalCommand } from "../globalCommands.ts";
import type { StatusBarHint } from "./StatusBarContextAPI.ts";
import { RESERVED_KEYS } from "../reservedKeys.ts";
import { canonicalKeyIdFromString } from "../keybinds/canonicalKeyId.ts";

function formatHint(hint: { key: string; label: string }): string {
  return `${hint.key}: ${hint.label}`;
}

export interface LayoutStatusBarInput {
  /** Global commands (data-model.md "Global Command"). */
  globalCommands: GlobalCommand[];
  /**
   * The focused extension's hints, already resolved to either its custom
   * `setHints()` value or its manifest-derived default (FR-002/FR-003) —
   * `null` when no extension is focused.
   */
  extensionHints: StatusBarHint[] | null;
  /** The focused extension's custom message, if any. */
  message: string | null;
  /** Available terminal width for the status bar's single line. */
  width: number;
}

/**
 * Computes the status bar's display string (data-model.md "Status Bar
 * Display State"). Reserved-key hints are always rendered in full and never
 * truncated (FR-012); everything else — extension hints, unclaimed global
 * hints (FR-006a), and the custom message (FR-013) — is joined and
 * truncated together to whatever width remains.
 */
export function layoutStatusBar(input: LayoutStatusBarInput): string {
  const extensionKeys = new Set((input.extensionHints ?? []).map((h) => canonicalKeyIdFromString(h.key)));

  const reservedHintStrings = RESERVED_KEYS.map((rk) => {
    const owner = input.globalCommands.find((gc) => gc.key === rk.key);
    return formatHint({ key: rk.key, label: owner?.label ?? rk.label });
  });

  const unclaimedGlobalHints = input.globalCommands.filter(
    (gc) => !RESERVED_KEYS.some((rk) => rk.key === gc.key) && !extensionKeys.has(gc.key),
  );

  // Ordering among non-reserved content is not spec-mandated beyond "truncate
  // to fit" — unclaimed global hints (navigation) are prioritized ahead of an
  // extension's own hints, since they're typically fewer/shorter and more
  // safety-critical (e.g. knowing how to get back) than an extension's full
  // command list, which the user can otherwise discover from its manifest.
  const restParts: string[] = [...unclaimedGlobalHints.map(formatHint)];
  if (input.message) restParts.push(input.message);
  restParts.push(...(input.extensionHints ?? []).map(formatHint));

  const reservedText = reservedHintStrings.join("  ");
  const restText = restParts.join("  ");

  const reservedWidth = reservedText.length;
  const separatorWidth = reservedText && restText ? 2 : 0;
  const remainingWidth = Math.max(0, input.width - reservedWidth - separatorWidth);

  const truncatedRest = restText.length > remainingWidth ? restText.slice(0, Math.max(0, remainingWidth - 1)).trimEnd() + (remainingWidth > 0 ? "…" : "") : restText;

  return [reservedText, truncatedRest].filter((s) => s.length > 0).join("  ");
}
