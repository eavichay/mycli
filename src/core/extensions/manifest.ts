import { z } from "zod";

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

export function validateManifest(raw: unknown): ManifestValidationResult {
  const result = ExtensionManifestSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, manifest: result.data };
  }
  return { valid: false, error: result.error.message };
}
