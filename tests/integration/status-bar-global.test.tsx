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

test("with no extension focused, the status bar shows global command hints including Ctrl+Q: Quit", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 10 });
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
  assert.match(frame, /ctrl\+q: Quit/i, "status bar must show the quit hint");
  assert.match(frame, /return: Open/i);
  assert.match(frame, /escape: Back/i);
});

test("after visiting an extension and returning, the status bar reverts to the global-only display", async () => {
  const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 10 });
  const host = fakeHost();
  const registry = createHostSlotRegistry(renderer, host);
  const loader = new ExtensionLoader({}, registry, host);
  await loader.fireActivationEvent("onSlot:grid");

  const root = createRoot(renderer);
  act(() => {
    root.render(<App registry={registry} loader={loader} extensionIds={[]} />);
  });
  await renderOnce();

  const before = captureCharFrame();

  act(() => {
    mockInput.pressKey("return");
  });
  await renderOnce();
  act(() => {
    mockInput.pressKey("escape");
  });
  await renderOnce();

  const after = captureCharFrame();
  assert.equal(after, before, "status bar must match the original global-only display exactly after returning");
});

test("Ctrl+Q quits the app", async () => {
  const { renderer, mockInput, renderOnce } = await createTestRenderer({ width: 60, height: 10 });
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
    mockInput.pressKey("q", { ctrl: true });
  });
  await renderOnce().catch(() => {});

  assert.equal(renderer.isDestroyed, true);
});

test("plain q (no modifier) does not quit the app anymore", async () => {
  const { renderer, mockInput, renderOnce } = await createTestRenderer({ width: 60, height: 10 });
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

  assert.equal(renderer.isDestroyed, false, "plain q must be free, not bound to quit (FR-008a)");
});
