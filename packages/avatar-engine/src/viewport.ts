import type { PoseData } from './renderer.js';

export interface ViewportConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export interface ViewportState {
  width: number;
  height: number;
  backgroundColor: string;
  createdAt: number;
  updatedAt: number;
  lastPose?: PoseData;
  lastRenderedAsset?: string;
}

export class Viewport {
  private pose: PoseData | null = null;
  private renderedAsset: string | null = null;
  private readonly createdAt = Date.now();
  private updatedAt = this.createdAt;

  constructor(private readonly config: ViewportConfig = {}) {}

  get width(): number {
    return this.config.width ?? 1280;
  }

  get height(): number {
    return this.config.height ?? 720;
  }

  get backgroundColor(): string {
    return this.config.backgroundColor ?? '#020617';
  }

  getPose(): PoseData | null {
    return this.pose;
  }

  updatePose(pose: PoseData): void {
    this.pose = pose;
    this.touch();
  }

  setRenderedAsset(assetName: string): void {
    this.renderedAsset = assetName;
    this.touch();
  }

  snapshot(): ViewportState {
    return {
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastPose: this.pose ?? undefined,
      lastRenderedAsset: this.renderedAsset ?? undefined
    };
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }
}
