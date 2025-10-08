import { nanoid } from '../utils/nanoid.js';
import { AvatarRenderer, type PoseData } from '@3d-avatar/avatar-engine';
import type { PoseSuggestion } from '@3d-avatar/ai-clients';

export interface RenderJob {
  id: string;
  assetName: string;
  prompt?: string;
}

const renderer = new AvatarRenderer();

export function createRenderJob(assetName: string, prompt?: string): RenderJob {
  return {
    id: nanoid(),
    assetName,
    prompt
  };
}

export async function simulateRender(
  job: RenderJob,
  pose: PoseSuggestion
): Promise<{
  assetUrl: string;
  poseKeyframes: number;
  renderTimeMs: number;
}> {
  const viewport = renderer.createViewport(1920, 1080);
  await renderer.applyPose(viewport, pose.data as PoseData);
  const summary = await renderer.render(viewport, job.assetName);

  return {
    assetUrl: `https://cdn.3d-avatar.local/${job.assetName}.glb`,
    poseKeyframes: summary.poseKeyframes,
    renderTimeMs: summary.renderTimeMs
  };
}
