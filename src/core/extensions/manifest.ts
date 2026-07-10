import { z } from "zod";
import { canonicalKeyIdFromString } from "../keybinds/canonicalKeyId.ts";
import { isReservedKey } from "../reservedKeys.ts";

/**
 * extension.json schema — validated before any of the extension's code is
 * imported (constitution: manifest-first loading; FR-002).
 */
export const ExtensionManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  views: z
    .object({
      peek: z.string().optional(),
      focus: z.string().optional(),
    })
    .optional(),
  commands: z
    .array(
      z.object({
        id: z.string().min(1),
        keybind: z.string().optional(),
      }),
    )
    .optional(),
  activationEvents: z.array(z.string()).min(1),
  storage: z.boolean().optional(),
});

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

export interface ManifestValidationResult {
  valid: boolean;
  manifest?: ExtensionManifest;
  error?: string;
}

/**
 * Drops any `commands[]` entry whose keybind canonicalizes to a reserved key
 * (FR-009) — a drop-and-continue filter, not a validation failure, so the
 * extension's other commands still register normally (FR-009, SC-004).
 */
function filterReservedCommands(manifest: ExtensionManifest): ExtensionManifest {
  if (!manifest.commands) return manifest;
  const commands = manifest.commands.filter(
    (cmd) => !cmd.keybind || !isReservedKey(canonicalKeyIdFromString(cmd.keybind)),
  );
  return { ...manifest, commands };
}

export function validateManifest(raw: unknown): ManifestValidationResult {
  const result = ExtensionManifestSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, manifest: filterReservedCommands(result.data) };
  }
  return { valid: false, error: result.error.message };
}
