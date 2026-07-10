import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../src/core/extensions/manifest.ts";

// The concrete Tasks manifest instance documented in contracts/extension-manifest.md
const tasksManifest = {
  id: "tasks",
  name: "Tasks",
  version: "1.0.0",
  views: { peek: "PeekView", focus: "FocusView" },
  commands: [
    { id: "tasks.add", keybind: "a" },
    { id: "tasks.delete", keybind: "d" },
    { id: "tasks.edit", keybind: "e" },
    { id: "tasks.toggleComplete", keybind: "space" },
    { id: "tasks.toggleShowCompleted", keybind: "c" },
  ],
  activationEvents: ["onSlot:grid"],
  storage: true,
};

test("contracts/extension-manifest.md's concrete Tasks manifest instance validates against the schema", () => {
  const result = validateManifest(tasksManifest);
  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest, tasksManifest);
});
