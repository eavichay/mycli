import { bootstrapRenderer } from "../core/renderer.ts";
import { createHostSlotRegistry, type HostContext } from "../core/slots.ts";
import { createStorageScopeFactory } from "../core/storage/StorageAPI.ts";
import { ExtensionLoader, type ExtensionSource } from "../core/extensions/loader.ts";
import { loadHostConfig } from "../core/config.ts";
import { App } from "./App.tsx";
import tasksManifest from "../extensions/tasks/extension.json" with { type: "json" };

function parseArgs(argv: string[]): { configPath: string } {
  const idx = argv.indexOf("--config");
  const configPath = idx !== -1 ? argv[idx + 1] : new URL("../../fixtures/tasks-only.yaml", import.meta.url).pathname;
  return { configPath };
}

/** The host's built-in extension catalogue. Built-in extensions go through the exact same manifest+loader+slot-registry path as a marketplace extension would (constitution: Development Workflow). */
const BUILT_IN_EXTENSIONS: Record<string, ExtensionSource> = {
  tasks: {
    manifest: tasksManifest,
    importModule: () => import("../extensions/tasks/index.tsx"),
  },
};

async function main() {
  const { configPath } = parseArgs(process.argv.slice(2));
  const config = await loadHostConfig(configPath);

  const { renderer, mount } = await bootstrapRenderer();

  const getStorage = createStorageScopeFactory();
  const host: HostContext = { getStorage };
  const registry = createHostSlotRegistry(renderer, host);

  const enabledSources: Record<string, ExtensionSource> = {};
  for (const id of config.extensions) {
    if (BUILT_IN_EXTENSIONS[id]) enabledSources[id] = BUILT_IN_EXTENSIONS[id];
  }

  const loader = new ExtensionLoader(enabledSources, registry, host);
  await loader.fireActivationEvent("onSlot:grid");

  mount(App({ registry, loader, extensionIds: config.extensions }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
