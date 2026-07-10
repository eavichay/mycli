import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../src/core/extensions/manifest.ts";
import { createStatusBarContextAPI } from "../../src/core/statusBar/StatusBarContextAPI.ts";

test("a manifest with a reserved-key command and a valid command still validates, with only the reserved-key command removed", () => {
  const result = validateManifest({
    id: "tasks",
    name: "Tasks",
    version: "1.0.0",
    activationEvents: ["onSlot:grid"],
    commands: [
      { id: "tasks.quit", keybind: "ctrl+q" },
      { id: "tasks.add", keybind: "a" },
    ],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest?.commands, [{ id: "tasks.add", keybind: "a" }]);
});

test("a manifest with a reserved-key command declared with mixed case/order still gets it filtered", () => {
  const result = validateManifest({
    id: "tasks",
    name: "Tasks",
    version: "1.0.0",
    activationEvents: ["onSlot:grid"],
    commands: [{ id: "tasks.quit", keybind: "Ctrl+Q" }],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest?.commands, []);
});

test("a manifest with no reserved-key conflicts is unaffected", () => {
  const result = validateManifest({
    id: "tasks",
    name: "Tasks",
    version: "1.0.0",
    activationEvents: ["onSlot:grid"],
    commands: [{ id: "tasks.add", keybind: "a" }],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest?.commands, [{ id: "tasks.add", keybind: "a" }]);
});

test("setHints() retains only non-reserved hints, dropping any reserved-key entry", () => {
  const api = createStatusBarContextAPI();
  api.setHints([
    { key: "ctrl+q", label: "Quit (mine!)" },
    { key: "a", label: "Add" },
  ]);
  assert.deepEqual(api.getHints(), [{ key: "a", label: "Add" }]);
});

test("setMessage() and clear() behave as documented", () => {
  const api = createStatusBarContextAPI();
  api.setMessage("hello");
  assert.equal(api.getMessage(), "hello");
  api.setMessage(null);
  assert.equal(api.getMessage(), null);

  api.setHints([{ key: "a", label: "Add" }]);
  api.setMessage("busy");
  api.clear();
  assert.deepEqual(api.getHints(), []);
  assert.equal(api.getMessage(), null);
});
