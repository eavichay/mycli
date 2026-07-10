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

test("a broken Tasks manifest leaves the dashboard, status bar, and quit fully usable, with a load-error tile (SC-005, FR-014)", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-fault-isolation-test-"));
  try {
    const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);

    // Deliberately broken manifest: missing the required `activationEvents` field.
    const sources: Record<string, ExtensionSource> = {
      tasks: {
        manifest: { id: "tasks", name: "Tasks", version: "1.0.0" },
        importModule: () => import("../../src/extensions/tasks/index.tsx"),
      },
    };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    assert.equal(loader.getState("tasks").status, "invalid-manifest", "loader must record the manifest failure without throwing");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["tasks"]} />);
    });
    await renderOnce();

    const frame = captureCharFrame();
    assert.match(frame, /failed to load/i, "the Tasks tile must show a load-error state");
    assert.doesNotMatch(frame, /Error:|TypeError|at\s+\S+\.tsx/, "the raw exception must not crash/leak past the dashboard shell");

    // The rest of the dashboard — quit — must remain fully usable.
    act(() => {
      mockInput.pressKey("q");
    });
    await renderOnce();
    assert.equal(renderer.isDestroyed, true, "quit must still work when an extension fails to load");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("a valid extension alongside a broken one is unaffected by the broken one's failure", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-fault-isolation-test-2-"));
  try {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);

    const sources: Record<string, ExtensionSource> = {
      broken: {
        manifest: { id: "broken" }, // missing everything required
        importModule: () => {
          throw new Error("should never be imported");
        },
      },
      tasks: {
        manifest: {
          id: "tasks",
          name: "Tasks",
          version: "1.0.0",
          views: { peek: "PeekView", focus: "FocusView" },
          activationEvents: ["onSlot:grid"],
          storage: true,
        },
        importModule: () => import("../../src/extensions/tasks/index.tsx"),
      },
    };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    assert.equal(loader.getState("broken").status, "invalid-manifest");
    assert.equal(loader.getState("tasks").status, "loaded", "a sibling extension must load normally despite another's failure");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["broken", "tasks"]} />);
    });
    await renderOnce();

    const frame = captureCharFrame();
    assert.match(frame, /failed to load/i);
    assert.match(frame, /0\/0 done/, "Tasks' own peek tile must still render normally");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
