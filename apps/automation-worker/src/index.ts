import { createRenderJob, RenderJob, simulateRender } from './jobs/render.js';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 2 });
const poseClient = new PoseGenerationClient();

async function scheduleRender(job: RenderJob): Promise<void> {
  console.log(`[worker] scheduling render ${job.id}`);
  await queue.add(async () => {
    console.log(`[worker] starting render ${job.id}`);
    const pose = await poseClient.suggestPose(job.prompt ?? 'neutral pose');
    const result = await simulateRender(job, pose);
    console.log(
      `[worker] finished render ${job.id} -> ${result.assetUrl} (${result.renderTimeMs}ms, ${result.poseKeyframes} keyframes)`
    );
  });
}

async function bootstrap(): Promise<void> {
  const jobs = [
    createRenderJob('avatar_walk_cycle'),
    createRenderJob('avatar_wave'),
    createRenderJob('avatar_idle')
  ];

  await Promise.all(jobs.map(scheduleRender));

  await queue.onIdle();
  console.log('[worker] all jobs complete');
}

void bootstrap();
