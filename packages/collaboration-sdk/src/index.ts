import * as Automerge from 'automerge';

export type PoseSource = 'ai' | 'manual' | 'imported';

export interface PoseSnapshot {
  id: string;
  createdAt: number;
  source: PoseSource;
  keyframeCount: number;
  prompt?: string;
  previewUrl?: string;
}

export interface SessionSummary {
  id: string;
  participants: string[];
  lastUpdated: number;
  poseCount: number;
}

export interface SessionDetail extends SessionSummary {
  poses: PoseSnapshot[];
}

function createPoseSnapshot(input: Omit<PoseSnapshot, 'createdAt' | 'source'> & {
  createdAt?: number;
  source?: PoseSource;
}): PoseSnapshot {
  return {
    createdAt: input.createdAt ?? Date.now(),
    source: input.source ?? 'ai',
    id: input.id,
    keyframeCount: input.keyframeCount,
    prompt: input.prompt,
    previewUrl: input.previewUrl
  };
}

function toSummary(detail: SessionDetail): SessionSummary {
  const { poses, ...rest } = detail;
  return { ...rest, poseCount: poses.length };
}

export class CollaborationSessionService {
  private readonly sessions: Map<string, SessionDetail> = new Map();

  constructor(seedSessions: Array<{ participants: string[]; poses?: PoseSnapshot[] }> = []) {
    if (seedSessions.length === 0) {
      this.seed([{ participants: ['maya', 'devon'] }]);
    } else {
      this.seed(seedSessions);
    }
  }

  private seed(definitions: Array<{ participants: string[]; poses?: PoseSnapshot[] }>): void {
    for (const definition of definitions) {
      this.createSession(definition.participants, definition.poses);
    }
  }

  private generateSessionId(): string {
    return `session_${Math.random().toString(36).slice(2, 10)}`;
  }

  private writeSession(
    sessionId: string,
    mutation: (doc: Automerge.MutableDoc<SessionDetail>) => void
  ): SessionDetail {
    const current = this.sessions.get(sessionId);

    if (!current) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const doc = Automerge.from<SessionDetail>(current);
    const updated = Automerge.change(doc, mutation);
    const next = Automerge.toJS(updated) as SessionDetail;

    this.sessions.set(sessionId, next);
    return next;
  }

  createSession(participants: string[], seedPoses: PoseSnapshot[] = []): SessionDetail {
    const id = this.generateSessionId();

    const doc = Automerge.change<SessionDetail>(Automerge.init(), draft => {
      const snapshots = seedPoses
        .map(pose => createPoseSnapshot(pose))
        .sort((a, b) => b.createdAt - a.createdAt);
      const lastUpdated = snapshots[0]?.createdAt ?? Date.now();
      draft.id = id;
      draft.participants = participants;
      draft.lastUpdated = lastUpdated;
      draft.poseCount = snapshots.length;
      draft.poses = snapshots;
    });

    const session = Automerge.toJS(doc) as SessionDetail;
    this.sessions.set(id, session);
    return session;
  }

  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  listSessionSummaries(): SessionSummary[] {
    return Array.from(this.sessions.values())
      .map(session => toSummary(session))
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  getSession(sessionId: string): SessionDetail | null {
    return this.sessions.get(sessionId) ?? null;
  }

  recordPose(
    sessionId: string,
    pose: Omit<PoseSnapshot, 'createdAt' | 'source'> & {
      createdAt?: number;
      source?: PoseSource;
      prompt?: string;
      previewUrl?: string;
    }
  ): SessionDetail {
    return this.writeSession(sessionId, draft => {
      const snapshot = createPoseSnapshot(pose);
      draft.poses = [snapshot, ...draft.poses].slice(0, 200);
      draft.poseCount = draft.poses.length;
      draft.lastUpdated = snapshot.createdAt;
    });
  }
}

export class CRDTDocument<T> {
  private doc = Automerge.init<T>();

  applyChange(change: (doc: Automerge.MutableDoc<T>) => void): void {
    this.doc = Automerge.change(this.doc, change);
  }

  merge(remote: Automerge.Doc<T>): void {
    this.doc = Automerge.merge(this.doc, remote);
  }

  toJSON(): T {
    return Automerge.toJS(this.doc) as T;
  }
}
