import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import { createHostSlotRegistry, type HostContext } from "../../src/core/slots.ts";
import { createStorageScopeFactory } from "../../src/core/storage/StorageAPI.ts";
import { ExtensionLoader, type ExtensionSource } from "../../src/core/extensions/loader.ts";
import { App } from "../../src/cli/App.tsx";
import tasksManifest from "../../src/extensions/tasks/extension.json" with { type: "json" };

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("focusing Tasks (which has not customized its hints) shows its manifest keybindings, merged with unclaimed global hints", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-defaults-"));
  try {
    const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);
    const sources: Record<string, ExtensionSource> = {
      tasks: { manifest: tasksManifest, importModule: () => import("../../src/extensions/tasks/index.tsx") },
    };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["tasks"]} />);
    });
    await renderOnce();

    act(() => {
      mockInput.pressKey("RETURN");
    });
    await renderOnce();

    const frame = captureCharFrame();
    // extension.json declares: tasks.add (a), tasks.delete (d), tasks.edit (e),
    // tasks.toggleComplete (space), tasks.toggleShowCompleted (c)
    assert.match(frame, /a: tasks\.add/);
    assert.match(frame, /d: tasks\.delete/);
    assert.match(frame, /escape: Back/, "unclaimed global hint (back) must still be visible");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
