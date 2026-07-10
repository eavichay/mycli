import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { KeybindDispatcherProvider } from "../../src/core/keybinds/GlobalScope.tsx";
import { useFocusedKeybinds } from "../../src/core/keybinds/FocusedScope.tsx";
import { useLocalKeybinds } from "../../src/core/keybinds/LocalScope.tsx";
import { useGlobalKeybinds } from "../../src/core/keybinds/GlobalScope.tsx";

function Harness(props: {
  log: string[];
  focusedActive: boolean;
  localActive: boolean;
}) {
  useFocusedKeybinds({ a: () => props.log.push("focused:a") }, props.focusedActive);
  useLocalKeybinds({ a: () => props.log.push("local:a"), b: () => props.log.push("local:b") }, props.localActive);
  useGlobalKeybinds({
    a: () => props.log.push("global:a"),
    b: () => props.log.push("global:b"),
    c: () => props.log.push("global:c"),
  });
  return null;
}

test("focused scope claims a key before local or global ever see it", async () => {
  const log: string[] = [];
  const { mockInput, renderOnce } = await testRender(
    <KeybindDispatcherProvider>
      <Harness log={log} focusedActive={true} localActive={true} />
    </KeybindDispatcherProvider>,
    { width: 20, height: 5 },
  );
  await renderOnce();

  mockInput.pressKey("a");
  await renderOnce();

  assert.deepEqual(log, ["focused:a"]);
});

test("local scope claims a key before global sees it, when focused scope is inactive", async () => {
  const log: string[] = [];
  const { mockInput, renderOnce } = await testRender(
    <KeybindDispatcherProvider>
      <Harness log={log} focusedActive={false} localActive={true} />
    </KeybindDispatcherProvider>,
    { width: 20, height: 5 },
  );
  await renderOnce();

  mockInput.pressKey("a");
  await renderOnce();

  assert.deepEqual(log, ["local:a"]);
});

test("an unclaimed key at focused and local scope reaches global scope", async () => {
  const log: string[] = [];
  const { mockInput, renderOnce } = await testRender(
    <KeybindDispatcherProvider>
      <Harness log={log} focusedActive={true} localActive={true} />
    </KeybindDispatcherProvider>,
    { width: 20, height: 5 },
  );
  await renderOnce();

  mockInput.pressKey("c");
  await renderOnce();

  assert.deepEqual(log, ["global:c"]);
});

test("when local scope is inactive, its keybinds never fire and fall through to global", async () => {
  const log: string[] = [];
  const { mockInput, renderOnce } = await testRender(
    <KeybindDispatcherProvider>
      <Harness log={log} focusedActive={false} localActive={false} />
    </KeybindDispatcherProvider>,
    { width: 20, height: 5 },
  );
  await renderOnce();

  mockInput.pressKey("b");
  await renderOnce();

  assert.deepEqual(log, ["global:b"]);
});
