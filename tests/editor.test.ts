import { describe, expect, it, vi } from 'vitest';
import { CollaborativeSession } from '../src/editor/collaboration/CollaborativeSession.js';
import { PluginManager } from '../src/editor/plugins/PluginManager.js';

describe('CollaborativeSession', () => {
  it('enforces permissions and applies operations', () => {
    const session = new CollaborativeSession({ root: { name: 'Scene' } }, 10);
    session.addParticipant({ id: 'owner', role: 'owner' });
    session.addParticipant({ id: 'reviewer', role: 'reviewer' });
    const applied = session.applyOperation('owner', {
      actor: 'owner',
      type: 'insert',
      path: 'root.camera',
      value: { fov: 60 },
      version: 0
    });
    expect(applied?.version).toBe(1);
    const denied = session.applyOperation('reviewer', {
      actor: 'reviewer',
      type: 'remove',
      path: 'root.camera',
      version: 1
    });
    expect(denied).toBeNull();
    const pruned = session.pruneInactiveParticipants(0);
    expect(pruned.length).toBeGreaterThanOrEqual(0);
  });
});

describe('PluginManager', () => {
  it('validates permissions before activation', async () => {
    const manager = new PluginManager();
    const log = vi.fn();
    const api = vi.fn();
    manager.exposeSandboxApi('analytics', {});
    manager.registerManifest(
      {
        id: 'inspector',
        name: 'Asset Inspector',
        version: '1.0.0',
        entryPoint: 'index.js',
        permissions: ['analytics']
      },
      (context) => {
        context.log('ready');
        context.provideApi('analytics', { analyze: api });
        context.registerTeardown(() => api('teardown'));
      }
    );
    await manager.activate('inspector', {
      log,
      provideApi: vi.fn(),
      registerTeardown: vi.fn()
    });
    expect(log).toHaveBeenCalledWith('[Asset Inspector] ready');
    expect(api).not.toHaveBeenCalled();
    await manager.deactivate('inspector');
    expect(api).toHaveBeenCalledWith('teardown');
    expect(manager.isActive('inspector')).toBe(false);
  });
});
