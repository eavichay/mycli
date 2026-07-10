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

async function boot(dataRoot: string) {
  const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
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

  const press = async (key: string) => {
    act(() => {
      mockInput.pressKey(key);
    });
    await renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await renderOnce();
  };

  return { press, captureCharFrame };
}

test("tasks.add's local 'a' key triggers inside the Tasks focus view (SC-004)", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-scoping-test-"));
  try {
    const { press, captureCharFrame } = await boot(dataRoot);
    await press("RETURN"); // dashboard -> Tasks focus view
    await press("a"); // local tasks.add
    assert.match(captureCharFrame(), /New task title:/, "'a' must trigger add-task while the Tasks focus view is active");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("tasks.add's local 'a' key does NOT trigger on the dashboard with no extension focused (SC-004)", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-scoping-test-"));
  try {
    const { press, captureCharFrame } = await boot(dataRoot);
    // stay on the dashboard — never press RETURN to activate the focus view
    await press("a");
    const frame = captureCharFrame();
    assert.doesNotMatch(frame, /New task title:/, "'a' must NOT trigger tasks.add from the dashboard");
    assert.doesNotMatch(frame, /╔.*Tasks.*╗/, "the dashboard must still show the grid, not the focus view");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("a key unclaimed by focused/local scope still reaches global scope (quit) even while a focus view is active", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-scoping-test-"));
  try {
    const { renderer, mockInput, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
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

    // 'q' is not one of Tasks' local commands (a/d/e/space/c), so it must fall through to the global quit handler
    act(() => {
      mockInput.pressKey("q");
    });
    await renderOnce();

    assert.equal(renderer.isDestroyed, true, "global quit must still fire from within a focus view for keys the extension doesn't claim");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
