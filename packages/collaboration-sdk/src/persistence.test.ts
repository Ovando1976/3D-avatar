import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSessionStore, type SessionDetail } from './index.js';

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'session-store-'));
  return directory;
}

describe('FileSessionStore', () => {
  it('returns an empty array when the file does not exist', async () => {
    const directory = await createTempDir();
    const store = new FileSessionStore(join(directory, 'sessions.json'));

    const sessions = await store.load();
    expect(sessions).toEqual([]);
    await rm(directory, { recursive: true, force: true });
  });

  it('persists sessions to disk', async () => {
    const directory = await createTempDir();
    const filePath = join(directory, 'sessions.json');
    const store = new FileSessionStore(filePath);
    const session: SessionDetail = {
      id: 'session_test',
      participants: ['maya'],
      poseCount: 1,
      lastUpdated: 1700000000000,
      poses: [
        {
          id: 'pose',
          createdAt: 1700000000000,
          keyframeCount: 12,
          source: 'ai'
        }
      ]
    };

    await store.save([session]);
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { version: number; sessions: SessionDetail[] };

    expect(parsed.version).toBe(1);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]?.poses[0]?.id).toBe('pose');

    const hydrated = await store.load();
    expect(hydrated[0]?.id).toBe('session_test');

    await rm(directory, { recursive: true, force: true });
  });
});
