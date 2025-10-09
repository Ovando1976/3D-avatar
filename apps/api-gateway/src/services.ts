import { resolve } from 'node:path';
import { CollaborationSessionService, FileSessionStore, type SessionDetail } from '@3d-avatar/collaboration-sdk';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';

const sessionStorePath = resolve(process.cwd(), process.env.SESSION_STORE_PATH ?? 'data/sessions.json');
const fileStore = new FileSessionStore(sessionStorePath);

let initialSessions: SessionDetail[] = [];

try {
  initialSessions = await fileStore.load();
  if (initialSessions.length > 0) {
    console.log(`[gateway] restored ${initialSessions.length} session(s) from ${sessionStorePath}`);
  }
} catch (error) {
  console.error('[gateway] failed to load session store', error);
}

let persistQueue = Promise.resolve();

function persistSessions(sessions: SessionDetail[]): void {
  persistQueue = persistQueue
    .then(async () => {
      await fileStore.save(sessions);
    })
    .catch(error => {
      console.error('[gateway] failed to persist session store', error);
    });
}

export const sessionService = new CollaborationSessionService({
  initialState: initialSessions,
  onChange: sessions => {
    persistSessions(sessions);
  }
});
export const poseClient = new PoseGenerationClient();
