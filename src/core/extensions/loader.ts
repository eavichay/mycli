import type { ReactNode } from "react";
import { validateManifest, type ExtensionManifest } from "./manifest.ts";
import type { HostContext, HostSlotRegistry } from "../slots.ts";
import { createStatusBarContextAPI, type StatusBarContextAPI } from "../statusBar/StatusBarContextAPI.ts";

export interface ExtensionActivationContext {
  host: HostContext;
  registry: HostSlotRegistry;
  manifest: ExtensionManifest;
  statusBar: StatusBarContextAPI;
}

/** A view component takes no props; each extension closes over its own state. */
export type ExtensionViewComponent = () => ReactNode;

export interface ExtensionRegistration {
  PeekView?: ExtensionViewComponent;
  FocusView?: ExtensionViewComponent;
}

export type ExtensionActivate = (ctx: ExtensionActivationContext) => ExtensionRegistration;

export interface ExtensionModule {
  default: ExtensionActivate;
}

/** A single entry in the host's extension catalogue (built-in or, in the future, marketplace-discovered). */
export interface ExtensionSource {
  manifest: unknown; // raw, unvalidated extension.json content
  importModule: () => Promise<ExtensionModule>;
}

export type LoadedExtensionState =
  | { status: "pending" }
  | { status: "invalid-manifest"; error: string }
  | { status: "loaded"; manifest: ExtensionManifest; registration: ExtensionRegistration }
  | { status: "load-error"; manifest: ExtensionManifest; error: string };

/**
 * Manifest-first, lazily-activated extension loader (constitution Principles II and V; FR-002, FR-014).
 *
 * Extension code is never imported until one of its declared `activationEvents`
 * has fired, and any manifest/import/activation failure degrades to a
 * `load-error` state instead of throwing out of the loader.
 */
export class ExtensionLoader {
  private readonly sources = new Map<string, ExtensionSource>();
  private readonly states = new Map<string, LoadedExtensionState>();
  private readonly statusBars = new Map<string, StatusBarContextAPI>();

  constructor(
    sources: Record<string, ExtensionSource>,
    private readonly registry: HostSlotRegistry,
    private readonly host: HostContext,
  ) {
    for (const [id, source] of Object.entries(sources)) {
      this.sources.set(id, source);
      this.states.set(id, { status: "pending" });
    }
  }

  getState(id: string): LoadedExtensionState {
    return this.states.get(id) ?? { status: "pending" };
  }

  getAllStates(): ReadonlyMap<string, LoadedExtensionState> {
    return this.states;
  }

  /** One StatusBarContextAPI instance per extension, created on first access. */
  getStatusBar(id: string): StatusBarContextAPI {
    let api = this.statusBars.get(id);
    if (!api) {
      api = createStatusBarContextAPI();
      this.statusBars.set(id, api);
    }
    return api;
  }

  /**
   * Fire an activation event. Any pending extension declaring this event in
   * its manifest's `activationEvents` is validated and, if valid, imported
   * and activated — exactly once.
   */
  async fireActivationEvent(event: string): Promise<void> {
    await Promise.all(
      [...this.sources.entries()].map(async ([id, source]) => {
        const current = this.states.get(id);
        if (!current || current.status !== "pending") return;

        const result = validateManifest(source.manifest);
        if (!result.valid || !result.manifest) {
          this.states.set(id, { status: "invalid-manifest", error: result.error ?? "unknown validation error" });
          return;
        }
        if (!result.manifest.activationEvents.includes(event)) return;

        try {
          const mod = await source.importModule();
          const registration = mod.default({
            host: this.host,
            registry: this.registry,
            manifest: result.manifest,
            statusBar: this.getStatusBar(id),
          });
          this.states.set(id, { status: "loaded", manifest: result.manifest, registration });
        } catch (err) {
          this.states.set(id, {
            status: "load-error",
            manifest: result.manifest,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
  }
}
