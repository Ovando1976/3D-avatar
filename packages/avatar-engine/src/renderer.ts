import { Viewport } from './viewport.js';

export interface PoseData {
  keyframes: Array<{
    bone: string;
    rotation: [number, number, number];
  }>;
}

export interface RenderSummary {
  assetName: string;
  renderTimeMs: number;
  poseKeyframes: number;
  completedAt: number;
  viewport: ReturnType<Viewport['snapshot']>;
}

const MIN_RENDER_TIME_MS = 420;
const MAX_RENDER_TIME_MS = 760;

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class AvatarRenderer {
  createViewport(width: number, height: number, backgroundColor?: string): Viewport {
    return new Viewport({ width, height, backgroundColor });
  }

  async applyPose(viewport: Viewport, pose: PoseData): Promise<void> {
    viewport.updatePose(pose);
    await new Promise(resolve => setTimeout(resolve, 16));
  }

  async render(viewport: Viewport, assetName: string): Promise<RenderSummary> {
    const pose = viewport.getPose();
    const renderTime = randomBetween(MIN_RENDER_TIME_MS, MAX_RENDER_TIME_MS);

    await new Promise(resolve => setTimeout(resolve, renderTime));

    viewport.setRenderedAsset(assetName);

    return {
      assetName,
      renderTimeMs: Math.round(renderTime),
      poseKeyframes: pose?.keyframes.length ?? 0,
      completedAt: Date.now(),
      viewport: viewport.snapshot()
    };
  }
}
