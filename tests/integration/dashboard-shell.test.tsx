import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import { createHostSlotRegistry, type HostContext } from "../../src/core/slots.ts";
import { ExtensionLoader } from "../../src/core/extensions/loader.ts";
import { App } from "../../src/cli/App.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeHost(): HostContext {
  return {
    getStorage: () => ({ get: async () => undefined, set: async () => {}, delete: async () => {}, list: async () => [] }),
  };
}

test("launching with zero extensions renders all shell regions without error", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 40, height: 10 });
  const host = fakeHost();
  const registry = createHostSlotRegistry(renderer, host);
  const loader = new ExtensionLoader({}, registry, host);
  await loader.fireActivationEvent("onSlot:grid");

  const root = createRoot(renderer);
  act(() => {
    root.render(<App registry={registry} loader={loader} extensionIds={[]} />);
  });
  await renderOnce();

  const frame = captureCharFrame();
  assert.ok(frame.length > 0, "dashboard shell should render visible content");
});

test("the quit key destroys the renderer cleanly", async () => {
  const { renderer, mockInput, renderOnce } = await createTestRenderer({ width: 40, height: 10 });
  const host = fakeHost();
  const registry = createHostSlotRegistry(renderer, host);
  const loader = new ExtensionLoader({}, registry, host);
  await loader.fireActivationEvent("onSlot:grid");

  const root = createRoot(renderer);
  act(() => {
    root.render(<App registry={registry} loader={loader} extensionIds={[]} />);
  });
  await renderOnce();

  act(() => {
    mockInput.pressKey("q");
  });
  await renderOnce().catch(() => {});

  assert.equal(renderer.isDestroyed, true);
});
