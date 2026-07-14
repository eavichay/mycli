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
import { useLocalKeybinds } from "../../src/core/keybinds/LocalScope.tsx";
import { App } from "../../src/cli/App.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A worst-case test extension: its manifest declares a command on the
 * reserved ctrl+q key (which must be silently dropped at manifest-load
 * time), AND its FocusView directly calls useLocalKeybinds with ctrl+q
 * hardcoded too (which must still never claim the key at dispatch time),
 * alongside one genuinely valid command that must keep working regardless.
 */
function reservedKeyConflictSource(log: string[]): ExtensionSource {
  return {
    manifest: {
      id: "conflict",
      name: "Conflict",
      version: "1.0.0",
      activationEvents: ["onSlot:grid"],
      commands: [
        { id: "conflict.quit", keybind: "ctrl+q" },
        { id: "conflict.valid", keybind: "v" },
      ],
    },
    importModule: async () => ({
      default: (ctx) => {
        function FocusView() {
          useLocalKeybinds(
            {
              "ctrl+q": () => log.push("extension-ctrl+q-fired"),
              v: () => log.push("valid-command-fired"),
            },
            true,
          );
          ctx.statusBar.setHints([{ key: "ctrl+q", label: "mine!" }]);
          return <text>{"conflict focus view"}</text>;
        }
        return { FocusView };
      },
    }),
  };
}

test("a test extension declaring a reserved-key command loads successfully, its other commands work, Ctrl+Q still quits, and the status bar never attributes ctrl+q to it", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "mycli-reserved-enforcement-"));
  try {
    const log: string[] = [];
    const { renderer, mockInput, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 20 });
    const getStorage = createStorageScopeFactory({ dataRoot });
    const host: HostContext = { getStorage };
    const registry = createHostSlotRegistry(renderer, host);
    const sources: Record<string, ExtensionSource> = { conflict: reservedKeyConflictSource(log) };
    const loader = new ExtensionLoader(sources, registry, host);
    await loader.fireActivationEvent("onSlot:grid");

    // Extension loads successfully despite the reserved-key manifest entry (FR-009, SC-004).
    assert.equal(loader.getState("conflict").status, "loaded");

    const root = createRoot(renderer);
    act(() => {
      root.render(<App registry={registry} loader={loader} extensionIds={["conflict"]} />);
    });
    await renderOnce();

    act(() => {
      mockInput.pressKey("RETURN");
    });
    await renderOnce();

    // The extension's other, non-conflicting command still works.
    act(() => {
      mockInput.pressKey("v");
    });
    await renderOnce();
    assert.deepEqual(log, ["valid-command-fired"], "the extension's valid command must still register and fire");

    // The status bar never shows ctrl+q as belonging to this extension, even
    // though it tried to set it via setHints().
    const frame = captureCharFrame();
    assert.doesNotMatch(frame, /ctrl\+q: mine!/, "the extension's attempted reserved-key hint must never display");
    assert.match(frame, /ctrl\+q: Quit/, "the reserved hint must still show as the global Quit action");

    // Pressing Ctrl+Q quits — the extension's own local handler for it never fires.
    act(() => {
      mockInput.pressKey("q", { ctrl: true });
    });
    await renderOnce().catch(() => {});
    assert.equal(log.includes("extension-ctrl+q-fired"), false, "the extension's reserved-key handler must never fire");
    assert.equal(renderer.isDestroyed, true, "Ctrl+Q must still quit the app");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
