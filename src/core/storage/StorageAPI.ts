import { mkdir, readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The only sanctioned way for an extension to persist data (constitution
 * Principle III). Extensions never see a filesystem path — only this
 * interface, scoped exclusively to their own data.
 */
export interface StorageAPI {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface StorageScopeFactoryOptions {
  /** Overridable for tests; defaults to `~/.mycli`. */
  dataRoot?: string;
}

class FileStorageAPI implements StorageAPI {
  constructor(private readonly dir: string) {}

  private fileFor(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.dir, `${safe}.json`);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await readFile(this.fileFor(key), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      // missing or corrupted -> "no data", never throw (Edge Cases: storage missing/corrupted)
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.fileFor(key), JSON.stringify(value, null, 2), "utf-8");
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.fileFor(key));
    } catch {
      // already absent - fine
    }
  }

  async list(): Promise<string[]> {
    try {
      const entries = await readdir(this.dir);
      return entries.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
    } catch {
      return [];
    }
  }
}

/**
 * Host-only factory: resolves and owns the real filesystem path per
 * extension (`<data-root>/extensions/<id>/`), handing each extension back
 * only the narrow `StorageAPI` interface. Two different extension ids
 * always resolve to disjoint directories.
 */
export function createStorageScopeFactory(options: StorageScopeFactoryOptions = {}): (extensionId: string) => StorageAPI {
  const root = options.dataRoot ?? join(homedir(), ".mycli");
  const cache = new Map<string, StorageAPI>();

  return function getStorage(extensionId: string): StorageAPI {
    let api = cache.get(extensionId);
    if (!api) {
      api = new FileStorageAPI(join(root, "extensions", extensionId));
      cache.set(extensionId, api);
    }
    return api;
  };
}
