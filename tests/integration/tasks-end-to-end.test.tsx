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

function tasksSource(): Record<string, ExtensionSource> {
  return {
    tasks: { manifest: tasksManifest, importModule: () => import("../../src/extensions/tasks/index.tsx") },
  };
}

async function bootSession(dataRoot: string) {
  const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
  const getStorage = createStorageScopeFactory({ dataRoot });
  const host: HostContext = { getStorage };
  const registry = createHostSlotRegistry(renderer, host);
  const loader = new ExtensionLoader(tasksSource(), registry, host);
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
    // task-store mutations are async (real file I/O), and OpenTUI debounces
    // a raw ESC byte to disambiguate it from multi-byte escape sequences
    // (arrow keys, etc.) before dispatching it as a standalone Escape
    // keypress — flush generously so both settle before the next assertion.
    await new Promise((resolve) => setTimeout(resolve, 60));
    await renderOnce();
  };

  return { renderer, press, renderOnce, captureCharFrame };
}

test("add -> peek count updates -> focus lists it -> complete -> delete -> peek reflects deletion", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-e2e-test-"));
  try {
    const { press, captureCharFrame } = await bootSession(dataRoot);

    assert.match(captureCharFrame(), /0\/0 done/, "peek tile should start empty");

    await press("RETURN"); // dashboard -> Tasks focus view
    await press("a"); // enter add mode (title step)
    await press("H");
    await press("i");
    await press("RETURN"); // submit title -> due date step
    await press("RETURN"); // skip due date -> task created

    assert.match(captureCharFrame(), /Hi/, "new task should appear in the focus view");

    await press("ESCAPE"); // back to dashboard
    assert.match(captureCharFrame(), /0\/1 done/, "peek summary should reflect the new task");

    await press("RETURN"); // re-enter focus view
    await press(" "); // mark complete
    assert.match(captureCharFrame(), /\[x\] Hi/);

    await press("d"); // delete
    assert.doesNotMatch(captureCharFrame(), /Hi/, "deleted task must disappear from the focus view immediately");

    await press("ESCAPE");
    assert.match(captureCharFrame(), /0\/0 done/, "peek summary must reflect the deletion immediately");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("added tasks and completion state persist across a relaunch", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-e2e-persist-"));
  try {
    // Session 1: add a task and mark it complete.
    const session1 = await bootSession(dataRoot);
    await session1.press("RETURN");
    await session1.press("a");
    await session1.press("Y");
    await session1.press("o");
    await session1.press("RETURN");
    await session1.press("RETURN");
    await session1.press(" ");
    assert.match(session1.captureCharFrame(), /\[x\] Yo/);

    // Session 2: fresh renderer + loader against the same dataRoot. PeekView's
    // initial refresh runs in a useEffect after mount, so flush a tick.
    const session2 = await bootSession(dataRoot);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await session2.renderOnce();
    assert.match(session2.captureCharFrame(), /1\/1 done/, "completed count must persist across relaunch");

    await session2.press("RETURN");
    assert.match(session2.captureCharFrame(), /\[x\] Yo/, "task title and completion state must persist across relaunch");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("hide-completed toggle hides and re-shows completed tasks in the focus view", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-e2e-toggle-"));
  try {
    const { press, captureCharFrame } = await bootSession(dataRoot);

    await press("RETURN");
    await press("a");
    await press("X");
    await press("RETURN");
    await press("RETURN");
    await press(" "); // complete it

    assert.match(captureCharFrame(), /\[x\] X/);

    await press("c"); // hide completed
    assert.doesNotMatch(captureCharFrame(), /\[x\] X/, "completed task must be hidden");

    await press("c"); // show completed again
    assert.match(captureCharFrame(), /\[x\] X/, "completed task must reappear");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
