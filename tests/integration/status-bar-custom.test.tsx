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

test("entering add-task mode updates the status bar to custom hints instead of manifest defaults", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-custom-"));
  try {
    const { press, captureCharFrame } = await boot(dataRoot);

    await press("RETURN"); // focus Tasks
    assert.match(captureCharFrame(), /a: tasks\.add/, "manifest defaults shown before customization");

    await press("a"); // enter add mode
    const frame = captureCharFrame();
    assert.match(frame, /return: Next/, "custom hint for add-mode title step");
    assert.match(frame, /escape: Cancel/);
    assert.doesNotMatch(frame, /a: tasks\.add/, "manifest defaults must not show while customized");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("canceling back to the list reverts to manifest-derived default hints", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-custom-2-"));
  try {
    const { press, captureCharFrame } = await boot(dataRoot);

    await press("RETURN");
    await press("a");
    await press("ESCAPE"); // cancel back to list

    const frame = captureCharFrame();
    assert.match(frame, /a: tasks\.add/, "manifest defaults must be restored after canceling");
    assert.doesNotMatch(frame, /return: Next/);
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("leaving the focus view entirely and re-entering starts from manifest defaults, not a stale customization", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-custom-3-"));
  try {
    const { press, captureCharFrame } = await boot(dataRoot);

    await press("RETURN");
    await press("a"); // customize hints (add mode)
    await press("ESCAPE"); // ESCAPE here is focused-scope: cancels add mode back to list
    await press("ESCAPE"); // global escape: back to dashboard (list mode has no local escape handler)

    await press("RETURN"); // re-enter Tasks
    const frame = captureCharFrame();
    assert.match(frame, /a: tasks\.add/, "must show manifest defaults, not a stale customization");
    assert.doesNotMatch(frame, /return: Next/);
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
