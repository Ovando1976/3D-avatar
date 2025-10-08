export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  entryPoint: string;
  permissions: string[];
  description?: string;
}

export interface SandboxContext {
  log(message: string): void;
  provideApi<T>(name: string, api: T): void;
  registerTeardown(callback: () => void | Promise<void>): void;
}

export type PluginFactory = (context: SandboxContext) => void | Promise<void>;

interface ActivatedPlugin {
  manifest: PluginManifest;
  teardown?: () => void | Promise<void>;
}

export class PluginManager {
  private readonly manifests = new Map<string, PluginManifest>();
  private readonly factories = new Map<string, PluginFactory>();
  private readonly sandboxApis = new Map<string, unknown>();
  private readonly activePlugins = new Map<string, ActivatedPlugin>();
  

      // prefix unused params with underscore
  registerMessageHandler(_message: string) { /* ... */ }
  registerPlugin(_name: string, _api: any, _callback: Function, _context?: any) { /* ... */ }
  registerManifest(manifest: PluginManifest, factory: PluginFactory): void {
    if (this.manifests.has(manifest.id)) {
      throw new Error(`Plugin with id ${manifest.id} already registered`);
    }
    this.validateManifest(manifest);
    this.manifests.set(manifest.id, manifest);
    this.factories.set(manifest.id, factory);
  }

  exposeSandboxApi<T>(name: string, api: T): void {
    this.sandboxApis.set(name, api);
  }

  listManifests(): PluginManifest[] {
    return [...this.manifests.values()];
  }

  async activate(manifestId: string, context: SandboxContext): Promise<void> {
    const manifest = this.manifests.get(manifestId);
    const factory = this.factories.get(manifestId);
    if (!manifest || !factory) {
      throw new Error(`Unknown plugin: ${manifestId}`);
    }
    if (this.activePlugins.has(manifestId)) {
      return;
    }
    const sandbox: SandboxContext = {
      log: (message) => context.log(`[${manifest.name}] ${message}`),
      provideApi: (name, api) => {
        if (!manifest.permissions.includes(name)) {
          throw new Error(`Plugin ${manifestId} lacks permission for ${name}`);
        }
        this.sandboxApis.set(`${manifestId}:${name}`, api);
        context.provideApi(`${manifestId}:${name}`, api);
      },
      registerTeardown: (callback) => {
        const existing = this.activePlugins.get(manifestId);
        if (existing) {
          existing.teardown = callback;
        } else {
          this.activePlugins.set(manifestId, { manifest, teardown: callback });
        }
      }
    };
    const maybePromise = factory(sandbox);
    if (maybePromise instanceof Promise) {
      await maybePromise;
    }
    if (!this.activePlugins.has(manifestId)) {
      this.activePlugins.set(manifestId, { manifest });
    } else {
      const existing = this.activePlugins.get(manifestId)!;
      existing.manifest = manifest;
    }
  }

  async deactivate(manifestId: string): Promise<void> {
    const active = this.activePlugins.get(manifestId);
    if (!active) {
      return;
    }
    if (active.teardown) {
      await active.teardown();
    }
    this.activePlugins.delete(manifestId);
    for (const key of [...this.sandboxApis.keys()]) {
      if (key.startsWith(`${manifestId}:`)) {
        this.sandboxApis.delete(key);
      }
    }
  }

  isActive(manifestId: string): boolean {
    return this.activePlugins.has(manifestId);
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error(`Manifest ${manifest.id} has invalid semver: ${manifest.version}`);
    }
    if (manifest.permissions.includes('root')) {
      throw new Error(`Manifest ${manifest.id} cannot request root permission`);
    }
    if (!/^\w+([\w./-]*\w+)?$/.test(manifest.entryPoint)) {
      throw new Error(`Manifest ${manifest.id} entryPoint must be a relative module path.`);
    }
  }
}
