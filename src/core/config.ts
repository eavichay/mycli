import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

/**
 * Host-level config format: Zod-validated YAML is the only supported
 * configuration format (constitution: Technology Constraints).
 */
export const HostConfigSchema = z.object({
  extensions: z.array(z.string()).default([]),
});

export type HostConfig = z.infer<typeof HostConfigSchema>;

export async function loadHostConfig(configPath: string): Promise<HostConfig> {
  const raw = await readFile(configPath, "utf-8");
  const parsed = parse(raw);
  return HostConfigSchema.parse(parsed);
}
