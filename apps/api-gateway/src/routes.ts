import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { PoseSource, type SessionDetail, type SessionSummary } from '@3d-avatar/collaboration-sdk';
import { poseClient, sessionService } from './services.js';

const poseSchema = z.object({
  prompt: z.string().min(3, 'prompt must be at least three characters'),
  sessionId: z.string().optional()
});

const sessionSchema = z.object({
  participants: z.array(z.string().min(1, 'participant name is required')).min(1)
});

const recordPoseSchema = z.object({
  pose: z.object({
    id: z.string().min(3),
    keyframeCount: z.number().int().min(1),
    source: z.union([z.literal('ai'), z.literal('manual'), z.literal('imported')]).optional(),
    prompt: z.string().optional(),
    previewUrl: z.string().url().optional(),
    createdAt: z.number().int().optional()
  })
});

function formatSession(session: SessionDetail): SessionDetail {
  return {
    ...session,
    poses: session.poses.slice(0, 50)
  };
}

export function registerRestRoutes(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/sessions', (_req: Request, res: Response) => {
    const summaries: SessionSummary[] = sessionService.listSessionSummaries();
    res.json({ sessions: summaries });
  });

  app.post('/sessions', (req: Request, res: Response) => {
    const parsed = sessionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ errors: parsed.error.issues });
      return;
    }

    const session = sessionService.createSession(parsed.data.participants);
    res.status(201).json({ session: formatSession(session) });
  });

  app.get('/sessions/:id', (req: Request, res: Response) => {
    const session = sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ session: formatSession(session) });
  });

  app.post('/sessions/:id/poses', (req: Request, res: Response) => {
    const parsed = recordPoseSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ errors: parsed.error.issues });
      return;
    }

    try {
      const updated = sessionService.recordPose(req.params.id, {
        ...parsed.data.pose,
        source: (parsed.data.pose.source ?? 'manual') as PoseSource
      });
      res.status(201).json({ session: formatSession(updated) });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Session not found' });
    }
  });

  app.post('/poses', async (req: Request, res: Response) => {
    const parseResult = poseSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ errors: parseResult.error.issues });
      return;
    }

    const pose = await poseClient.suggestPose(parseResult.data.prompt);

    let session: SessionDetail | null = null;
    if (parseResult.data.sessionId) {
      try {
        session = sessionService.recordPose(parseResult.data.sessionId, {
          id: pose.id,
          keyframeCount: pose.data.keyframes.length,
          prompt: parseResult.data.prompt,
          source: 'ai'
        });
      } catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : 'Session not found' });
        return;
      }
    }

    res.status(201).json({ pose, session: session ? formatSession(session) : null });
  });
}
