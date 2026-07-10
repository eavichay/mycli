import { createReactSlotRegistry, type ReactPlugin } from "@opentui/react";
import type { CliRenderer } from "@opentui/core";
import type { ReactNode } from "react";
import type { StorageAPI } from "./storage/StorageAPI.ts";

/**
 * Host-supplied context every extension slot render function receives.
 * Extensions only ever see this — never the renderer or a raw filesystem path
 * (constitution Principles I and III).
 */
export interface HostContext {
  getStorage(extensionId: string): StorageAPI;
}

/**
 * Named dashboard regions extensions can contribute into (FR-001, FR-003).
 * `grid` carries no per-registration data: each extension's own closure
 * already knows which extension it is.
 */
export type Slots = {
  grid: {};
  sidebar: {};
  statusbar: {};
  overlay: {};
};

export type HostSlotRegistry = ReturnType<typeof createReactSlotRegistry<Slots, HostContext>>;

export function createHostSlotRegistry(renderer: CliRenderer, context: HostContext): HostSlotRegistry {
  return createReactSlotRegistry<Slots, HostContext>(renderer, context);
}

export type HostPlugin = ReactPlugin<Slots, HostContext>;

export type { ReactNode };
