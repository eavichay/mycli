import type { KeyEvent } from "@opentui/core";

/**
 * A canonical, modifier-aware key identifier: `[ctrl+][meta+][shift+][option+]<name>`,
 * modifiers always in this fixed order, base name always lowercase (e.g. `ctrl+q`, `q`).
 * Used everywhere a key is identified — manifest `keybind` strings, the reserved-keys
 * list, global command declarations, and status-bar hint keys — so the same key is
 * always spelled the same way, regardless of the order its modifiers were set in.
 */
export function canonicalKeyId(key: Pick<KeyEvent, "name" | "ctrl" | "meta" | "shift" | "option">): string {
  const parts: string[] = [];
  if (key.ctrl) parts.push("ctrl");
  if (key.meta) parts.push("meta");
  if (key.shift) parts.push("shift");
  if (key.option) parts.push("option");
  parts.push(key.name.toLowerCase());
  return parts.join("+");
}

const MODIFIER_ORDER = ["ctrl", "meta", "shift", "option"] as const;

/**
 * Canonicalize a manifest `keybind` string (e.g. `"Ctrl+Q"`, `"ctrl+q"`, `"q"`)
 * into the same fixed-order, lowercase form `canonicalKeyId()` produces from a
 * live KeyEvent, so the two are always directly comparable.
 */
export function canonicalKeyIdFromString(raw: string): string {
  const segments = raw
    .split("+")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (segments.length === 0) return "";

  const name = segments[segments.length - 1];
  const modifierSet = new Set(segments.slice(0, -1));
  const parts: string[] = MODIFIER_ORDER.filter((m) => modifierSet.has(m));
  parts.push(name);
  return parts.join("+");
}
