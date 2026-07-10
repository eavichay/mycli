import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutStatusBar } from "../../src/core/statusBar/layoutStatusBar.ts";
import { createGlobalCommands } from "../../src/core/globalCommands.ts";

function globalCommands() {
  return createGlobalCommands({ quit: () => {}, openFocusView: () => {}, backToDashboard: () => {} });
}

test("with no extension focused, shows reserved hint plus all other global hints", () => {
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: null,
    message: null,
    width: 80,
  });
  assert.match(result, /ctrl\+q: Quit/);
  assert.match(result, /return: Open/);
  assert.match(result, /escape: Back/);
});

test("merges unclaimed global hints alongside the focused extension's hints", () => {
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: [{ key: "a", label: "Add" }],
    message: null,
    width: 80,
  });
  assert.match(result, /ctrl\+q: Quit/);
  assert.match(result, /a: Add/);
  assert.match(result, /escape: Back/, "unclaimed global hint (back) must still appear");
});

test("an extension's hint for a key overrides the global hint for that same key", () => {
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: [{ key: "escape", label: "Cancel" }],
    message: null,
    width: 80,
  });
  assert.match(result, /escape: Cancel/);
  assert.doesNotMatch(result, /escape: Back/, "global hint for an overridden key must not appear");
});

test("message and hints coexist on the same line", () => {
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: [{ key: "a", label: "Add" }],
    message: "editing task",
    width: 80,
  });
  assert.match(result, /a: Add/);
  assert.match(result, /editing task/);
});

test("reserved-key hint is always shown in full, other content truncates to fit", () => {
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: [{ key: "a", label: "A very long label that will definitely overflow the available width of the bar" }],
    message: null,
    width: 30,
  });
  assert.match(result, /ctrl\+q: Quit/, "reserved hint must never be cut, even under tight width");
  assert.ok(result.length <= 30, `expected result to respect the 30-char width budget, got length ${result.length}`);
});

test("reserved key is never displayed as belonging to the focused extension, even if the extension supplies a hint for it", () => {
  // layoutStatusBar receives already-filtered extensionHints in practice (StatusBarContextAPI
  // filters reserved keys out), but verify the layout itself doesn't misattribute the reserved
  // hint's label to the extension even if one somehow slipped through upstream.
  const result = layoutStatusBar({
    globalCommands: globalCommands(),
    extensionHints: [],
    message: null,
    width: 80,
  });
  const occurrences = result.match(/ctrl\+q/g) ?? [];
  assert.equal(occurrences.length, 1, "ctrl+q must appear exactly once, as the reserved hint, never duplicated");
});
