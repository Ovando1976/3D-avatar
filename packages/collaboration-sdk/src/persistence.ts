import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SessionDetail } from './index.js';

interface SessionStoreFileV1 {
  version: 1;
  sessions: SessionDetail[];
}

type SessionStoreFile = SessionStoreFileV1 | SessionDetail[];

function isSessionStoreFileV1(value: SessionStoreFile): value is SessionStoreFileV1 {
  return typeof (value as SessionStoreFileV1).version === 'number' && Array.isArray((value as SessionStoreFileV1).sessions);
}

function normalisePayload(payload: SessionStoreFile): SessionDetail[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isSessionStoreFileV1(payload)) {
    return payload.sessions;
  }

  throw new Error('Unsupported session store payload format');
}

export class FileSessionStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<SessionDetail[]> {
    try {
      const buffer = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(buffer) as SessionStoreFile;
      return normalisePayload(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async save(sessions: SessionDetail[]): Promise<void> {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    const payload: SessionStoreFileV1 = {
      version: 1,
      sessions
    };

    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
