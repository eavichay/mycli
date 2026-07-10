import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../src/core/extensions/manifest.ts";
import { ExtensionLoader } from "../../src/core/extensions/loader.ts";
import type { HostContext, HostSlotRegistry } from "../../src/core/slots.ts";

const validManifest = {
  id: "tasks",
  name: "Tasks",
  version: "1.0.0",
  views: { peek: "PeekView", focus: "FocusView" },
  commands: [{ id: "tasks.add", keybind: "a" }],
  activationEvents: ["onSlot:grid"],
  storage: true,
};

test("a valid manifest passes validation", () => {
  const result = validateManifest(validManifest);
  assert.equal(result.valid, true);
  assert.equal(result.manifest?.id, "tasks");
});

test("a manifest missing activationEvents is rejected", () => {
  const { activationEvents, ...rest } = validManifest;
  const result = validateManifest(rest);
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("a manifest with an empty id is rejected", () => {
  const result = validateManifest({ ...validManifest, id: "" });
  assert.equal(result.valid, false);
});

test("a manifest with a malformed version is rejected", () => {
  const result = validateManifest({ ...validManifest, version: "not-a-version" });
  assert.equal(result.valid, false);
});

test("code is never imported for an invalid manifest", async () => {
  let imported = false;
  const registry = {} as HostSlotRegistry;
  const host: HostContext = { getStorage: () => ({ get: async () => undefined, set: async () => {}, delete: async () => {}, list: async () => [] }) };

  const loader = new ExtensionLoader(
    {
      broken: {
        manifest: { id: "broken" }, // missing required fields
        importModule: async () => {
          imported = true;
          throw new Error("should never be called");
        },
      },
    },
    registry,
    host,
  );

  await loader.fireActivationEvent("onSlot:grid");

  assert.equal(imported, false);
  assert.equal(loader.getState("broken").status, "invalid-manifest");
});

test("a valid manifest is only imported once its declared activation event fires", async () => {
  let importCount = 0;
  const registry = {} as HostSlotRegistry;
  const host: HostContext = { getStorage: () => ({ get: async () => undefined, set: async () => {}, delete: async () => {}, list: async () => [] }) };

  const loader = new ExtensionLoader(
    {
      tasks: {
        manifest: validManifest,
        importModule: async () => {
          importCount += 1;
          return { default: () => ({}) };
        },
      },
    },
    registry,
    host,
  );

  await loader.fireActivationEvent("onCommand:unrelated");
  assert.equal(importCount, 0, "must not import before its own activation event fires");

  await loader.fireActivationEvent("onSlot:grid");
  assert.equal(importCount, 1);

  await loader.fireActivationEvent("onSlot:grid");
  assert.equal(importCount, 1, "must not import a second time");
});
