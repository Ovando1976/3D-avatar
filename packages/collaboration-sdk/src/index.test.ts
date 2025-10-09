import { describe, expect, it } from 'vitest';
import { CollaborationSessionService } from './index.js';

describe('CollaborationSessionService', () => {
  it('creates sessions with pose history', () => {
    const service = new CollaborationSessionService({
      seedSessions: [
        {
          participants: ['maya'],
          poses: [
            {
              id: 'pose_seed',
              keyframeCount: 12,
              createdAt: 1700000000000,
              source: 'ai'
            }
          ]
        }
      ]
    });

    const summaries = service.listSessionSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.poseCount).toBe(1);
  });

  it('records new poses and returns updated session detail', () => {
    const service = new CollaborationSessionService({ seedSessions: [{ participants: ['maya', 'devon'] }] });
    const [sessionId] = service.listActiveSessions();

    expect(sessionId).toBeDefined();

    const updated = service.recordPose(sessionId!, {
      id: 'pose_new',
      keyframeCount: 24,
      source: 'manual',
      prompt: 'test'
    });

    expect(updated.poseCount).toBe(1);
    expect(updated.poses[0]?.id).toBe('pose_new');
  });

  it('notifies listeners when sessions change', () => {
    const events: number[] = [];
    const service = new CollaborationSessionService({
      seedSessions: [{ participants: ['maya'] }],
      onChange: sessions => {
        events.push(sessions[0]?.poseCount ?? 0);
      }
    });

    const [sessionId] = service.listActiveSessions();
    expect(events.at(-1)).toBe(0);

    service.recordPose(sessionId!, {
      id: 'pose_notified',
      keyframeCount: 10
    });

    expect(events.at(-1)).toBe(1);
  });
});
