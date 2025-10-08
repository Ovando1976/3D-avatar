import * as Automerge from 'automerge';

export interface SessionState {
  id: string;
  participants: string[];
  lastUpdated: number;
}

export class CollaborationSessionService {
  private readonly sessions: Map<string, SessionState> = new Map();

  constructor(seedSessions: Array<{ participants: string[] }> = []) {
    if (seedSessions.length === 0) {
      this.seed([{ participants: ['maya', 'devon'] }]);
    } else {
      this.seed(seedSessions);
    }
  }

  private seed(definitions: Array<{ participants: string[] }>): void {
    for (const definition of definitions) {
      this.createSession(definition.participants);
    }
  }

  createSession(participants: string[]): SessionState {
    const id = `session_${Math.random().toString(36).slice(2, 10)}`;
    const state = Automerge.change<SessionState>(Automerge.init<SessionState>(), doc => {
      doc.id = id;
      doc.participants = participants;
      doc.lastUpdated = Date.now();
    });

    const session = Automerge.toJS(state) as SessionState;
    this.sessions.set(id, session);
    return session;
  }

  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  listSessionSummaries(): SessionState[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
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
