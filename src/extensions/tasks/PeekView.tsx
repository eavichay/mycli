import React, { useEffect, useSyncExternalStore } from "react";
import type { TasksReactiveStore } from "./reactive-store.ts";

/** FR-011: live summary count in the compact dashboard tile. */
export function createPeekView(store: TasksReactiveStore) {
  return function PeekView() {
    const tasks = useSyncExternalStore(store.subscribe, store.getSnapshot);

    useEffect(() => {
      store.refresh();
    }, []);

    const completed = tasks.filter((t) => t.completed).length;

    return (
      <box flexDirection="column" title="Tasks" borderStyle="double">
        <text>{`${completed}/${tasks.length} done`}</text>
      </box>
    );
  };
}
