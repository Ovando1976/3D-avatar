import EventEmitter from 'eventemitter3';
import {
  ConflictResolution,
  JsonTransformContext,
  OperationalTransformEngine,
  TransformOperation,
  TransformResult
} from './OperationalTransform.js';
import { deepClone } from '../../utils/deepClone.js';

export type Role = 'owner' | 'editor' | 'reviewer';

export interface Participant {
  id: string;
  role: Role;
}

export interface CollaborationEventMap {
  operationApplied: [TransformResult, TransformOperation];
  permissionDenied: [Participant, TransformOperation];
  participantJoined: [Participant];
  participantLeft: [Participant];
  participantPruned: [Participant];
}

interface Presence {
  participant: Participant;
  lastHeartbeat: number;
}

export interface ApplyOperationOptions {
  resolution?: ConflictResolution;
}

export class CollaborativeSession extends EventEmitter<CollaborationEventMap> {
  private readonly transform = new OperationalTransformEngine(new JsonTransformContext());
  private state: unknown;
  private readonly participants = new Map<string, Presence>();
  private readonly auditLog: TransformOperation[] = [];
  private readonly inactivityTimeoutMs: number;

  constructor(initialState: unknown, inactivityTimeoutMs = 30_000) {
    super();
    this.state = deepClone(initialState);
    this.inactivityTimeoutMs = inactivityTimeoutMs;
  }

  addParticipant(participant: Participant): void {
    this.participants.set(participant.id, { participant, lastHeartbeat: Date.now() });
    this.emit('participantJoined', participant);
  }

  removeParticipant(participantId: string): void {
    const presence = this.participants.get(participantId);
    if (!presence) {
      return;
    }
    this.participants.delete(participantId);
    this.emit('participantLeft', presence.participant);
  }

  heartbeat(participantId: string): void {
    const presence = this.participants.get(participantId);
    if (presence) {
      presence.lastHeartbeat = Date.now();
    }
  }

  pruneInactiveParticipants(now = Date.now()): Participant[] {
    const removed: Participant[] = [];
    for (const [id, presence] of this.participants.entries()) {
      if (now - presence.lastHeartbeat > this.inactivityTimeoutMs) {
        this.participants.delete(id);
        removed.push(presence.participant);
        this.emit('participantPruned', presence.participant);
      }
    }
    return removed;
  }

  applyOperation(
    participantId: string,
    operation: TransformOperation,
    options: ApplyOperationOptions = {}
  ): TransformResult | null {
    const presence = this.participants.get(participantId);
    if (!presence || !this.canApply(presence.participant.role, operation.type)) {
      if (presence) {
        this.emit('permissionDenied', presence.participant, operation);
      }
      return null;
    }
    const result = this.transform.apply(this.state, operation, options.resolution);
    this.state = result.state;
    this.auditLog.push({ ...operation, version: result.version });
    this.emit('operationApplied', result, operation);
    presence.lastHeartbeat = Date.now();
    return result;
  }

  currentState<T>(): T {
    return deepClone(this.state) as T;
  }

  operationsSince(version: number): TransformOperation[] {
    return this.transform.historySince(version).map((operation) => deepClone(operation));
  }

  private canApply(role: Role, type: TransformOperation['type']): boolean {
    switch (role) {
      case 'owner':
        return true;
      case 'editor':
        return type !== 'remove';
      case 'reviewer':
        return type === 'insert';
      default:
        return false;
    }
  }
}
