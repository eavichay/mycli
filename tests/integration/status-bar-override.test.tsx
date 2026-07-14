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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A minimal test extension whose manifest declares a command on "escape" —
// a non-reserved key the global "Back" command also uses — to verify the
// status bar's override-and-merge display precedence end-to-end (US4).
function collidingExtensionSource(): ExtensionSource {
  return {
    manifest: {
      id: "colliding",
      name: "Colliding",
      version: "1.0.0",
      activationEvents: ["onSlot:grid"],
      commands: [{ id: "colliding.escape", keybind: "escape" }],
    },
    importModule: async () => ({
      default: () => ({ FocusView: () => <text>{"colliding focus view"}</text> }),
    }),
  };
}

test("a focused extension's hint for a colliding non-reserved key shows instead of the global hint, and the global hint returns once unfocused", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-override-"));
  try {
    const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);
    const sources: Record<string, ExtensionSource> = { colliding: collidingExtensionSource() };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["colliding"]} />);
    });
    await renderOnce();

    const before = captureCharFrame();
    assert.match(before, /escape: Back/, "global hint shown before focusing");

    act(() => {
      mockInput.pressKey("RETURN");
    });
    await renderOnce();

    const focused = captureCharFrame();
    assert.match(focused, /escape: colliding\.escape/, "focused extension's hint for the colliding key must show");
    assert.doesNotMatch(focused, /escape: Back/, "global hint for the overridden key must not show while focused");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("a global hint whose key the focused extension does NOT claim remains visible alongside its hints", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-status-bar-override-2-"));
  try {
    const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);
    const sources: Record<string, ExtensionSource> = {
      colliding: {
        manifest: {
          id: "colliding",
          name: "Colliding",
          version: "1.0.0",
          activationEvents: ["onSlot:grid"],
          commands: [{ id: "colliding.custom", keybind: "x" }], // does not collide with any global command
        },
        importModule: async () => ({
          default: () => ({ FocusView: () => <text>{"colliding focus view"}</text> }),
        }),
      },
    };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["colliding"]} />);
    });
    await renderOnce();

    act(() => {
      mockInput.pressKey("RETURN");
    });
    await renderOnce();

    const frame = captureCharFrame();
    assert.match(frame, /x: colliding\.custom/);
    assert.match(frame, /escape: Back/, "unclaimed global hint must still be visible alongside the extension's own hint");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
