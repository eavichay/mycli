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

test("activation key swaps to the framed Tasks focus view, back key returns to the dashboard, each in one keypress", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-focus-nav-test-"));
  try {
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

    const before = captureCharFrame();
    assert.doesNotMatch(before, /╔.*Tasks.*╗/, "dashboard should not show the framed focus view yet");

    // one keypress: activation key opens the framed focus view (SC-003: <=2 keypresses each direction)
    act(() => {
      mockInput.pressKey("RETURN");
    });
    await renderOnce();

    const afterActivate = captureCharFrame();
    assert.match(afterActivate, /╔.*Tasks.*╗/, "activation should swap to a framed/highlighted Tasks focus view");
    assert.match(afterActivate, /╚.*╝/, "the frame must be a closed border, i.e. a distinct visual treatment");

    // one keypress: back key returns to the dashboard
    act(() => {
      mockInput.pressKey("ESCAPE");
    });
    await renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await renderOnce();

    const afterBack = captureCharFrame();
    assert.doesNotMatch(afterBack, /╔.*Tasks.*╗/, "back key should return to the dashboard, closing the focus view");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
