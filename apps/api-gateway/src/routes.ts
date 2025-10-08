import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { CollaborationSessionService } from '@3d-avatar/collaboration-sdk';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';

const sessionService = new CollaborationSessionService();
const poseClient = new PoseGenerationClient();

const poseSchema = z.object({
  prompt: z.string().min(3, 'prompt must be at least three characters')
});

const sessionSchema = z.object({
  participants: z.array(z.string().min(1, 'participant name is required')).min(1)
});

export function registerRestRoutes(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/sessions', (_req: Request, res: Response) => {
    res.json({ sessions: sessionService.listSessionSummaries() });
  });

  app.post('/sessions', (req: Request, res: Response) => {
    const parsed = sessionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ errors: parsed.error.issues });
      return;
    }

    const session = sessionService.createSession(parsed.data.participants);
    res.status(201).json({ session });
  });

  app.post('/poses', async (req: Request, res: Response) => {
    const parseResult = poseSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ errors: parseResult.error.issues });
      return;
    }

    const pose = await poseClient.suggestPose(parseResult.data.prompt);
    res.status(201).json({ pose });
  });
}
