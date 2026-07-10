import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalKeyId } from "../../src/core/keybinds/canonicalKeyId.ts";

function key(overrides: Partial<{ name: string; ctrl: boolean; meta: boolean; shift: boolean; option: boolean }>) {
  return { name: "a", ctrl: false, meta: false, shift: false, option: false, ...overrides };
}

test("a plain key with no modifiers canonicalizes to just its lowercase name", () => {
  assert.equal(canonicalKeyId(key({ name: "q" })), "q");
  assert.equal(canonicalKeyId(key({ name: "Q" })), "q");
});

test("a single modifier is prefixed in the fixed order", () => {
  assert.equal(canonicalKeyId(key({ name: "q", ctrl: true })), "ctrl+q");
  assert.equal(canonicalKeyId(key({ name: "q", meta: true })), "meta+q");
  assert.equal(canonicalKeyId(key({ name: "tab", shift: true })), "shift+tab");
  assert.equal(canonicalKeyId(key({ name: "q", option: true })), "option+q");
});

test("multiple modifiers are always ordered ctrl, meta, shift, option regardless of which were set", () => {
  assert.equal(canonicalKeyId(key({ name: "q", ctrl: true, shift: true })), "ctrl+shift+q");
  assert.equal(canonicalKeyId(key({ name: "q", shift: true, ctrl: true, meta: true, option: true })), "ctrl+meta+shift+option+q");
});

test("base name is always lowercase regardless of input casing", () => {
  assert.equal(canonicalKeyId(key({ name: "ESCAPE" })), "escape");
  assert.equal(canonicalKeyId(key({ name: "Return", ctrl: true })), "ctrl+return");
});
