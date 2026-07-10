import React from "react";
import type { ExtensionActivate } from "../../core/extensions/loader.ts";
import { createTasksReactiveStore } from "./reactive-store.ts";
import { createPeekView } from "./PeekView.tsx";
import { createFocusView } from "./FocusView.tsx";

const activate: ExtensionActivate = (ctx) => {
  const storage = ctx.host.getStorage(ctx.manifest.id);
  const store = createTasksReactiveStore(storage);

  const PeekView = createPeekView(store);
  const FocusView = createFocusView(store);

  ctx.registry.register({
    id: ctx.manifest.id,
    slots: {
      grid: () => <PeekView />,
    },
  });

  return { PeekView, FocusView };
};

export default activate;
