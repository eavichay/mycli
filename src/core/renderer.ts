import { createCliRenderer, type CliRenderer, type CliRendererConfig } from "@opentui/core";
import { createRoot, type Root } from "@opentui/react";
import type { ReactNode } from "react";

let bootstrapped = false;

/**
 * The single owned terminal renderer for the process (constitution Principle I).
 * MUST be called exactly once, by the CLI entrypoint, never by extension code.
 */
export async function bootstrapRenderer(
  config?: CliRendererConfig,
): Promise<{ renderer: CliRenderer; root: Root; mount: (node: ReactNode) => void }> {
  if (bootstrapped) {
    throw new Error("bootstrapRenderer() was already called once in this process (Principle I violation)");
  }
  bootstrapped = true;

  const renderer = await createCliRenderer(config);
  const root = createRoot(renderer);

  return {
    renderer,
    root,
    mount: (node: ReactNode) => root.render(node),
  };
}
