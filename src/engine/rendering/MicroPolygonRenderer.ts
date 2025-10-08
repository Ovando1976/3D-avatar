export type Vec3 = [number, number, number];

export interface Triangle {
  id: string;
  vertices: [Vec3, Vec3, Vec3];
  materialId: string;
}

export interface Scene {
  id: string;
  triangles: Triangle[];
}

export interface CameraState {
  position: Vec3;
  fov: number;
}

export type QualityPreset = 'cinematic' | 'high' | 'medium' | 'low';

export interface RendererWarning {
  code: 'CACHE_PRESSURE' | 'QUALITY_CLAMPED' | 'MICRO_POLYGON_LIMIT' | 'INVALID_GEOMETRY';
  message: string;
}

export interface RendererFrameStats {
  sceneId: string;
  targetFrameMs: number;
  estimatedFrameMs: number;
  trianglesRendered: number;
  microPolygons: number;
  cacheThrashRate: number;
  shadingCost: number;
  subdivisionLevels: Record<number, number>;
  qualityTier: QualityPreset;
  adaptiveScale: number;
  warnings: RendererWarning[];
  budgetMet: boolean;
}

export interface MicroPolygonRendererConfig {
  targetFrameMs: number;
  maxSubdivisions: number;
  pixelErrorThreshold: number;
  cacheSizeMb: number;
  qualityPreset?: QualityPreset;
  adaptiveErrorScaling?: boolean;
  maxMicroPolygons?: number;
  enableProfiling?: boolean;
}

const QUALITY_PRESETS: Record<QualityPreset, Omit<MicroPolygonRendererConfig, 'qualityPreset'>> = {
  cinematic: { targetFrameMs: 16.6, maxSubdivisions: 7, pixelErrorThreshold: 0.25, cacheSizeMb: 1024 },
  high: { targetFrameMs: 13.8, maxSubdivisions: 6, pixelErrorThreshold: 0.35, cacheSizeMb: 768 },
  medium: { targetFrameMs: 11, maxSubdivisions: 5, pixelErrorThreshold: 0.4, cacheSizeMb: 512 },
  low: { targetFrameMs: 8.3, maxSubdivisions: 4, pixelErrorThreshold: 0.55, cacheSizeMb: 256 }
};

const DEFAULT_CONFIG: MicroPolygonRendererConfig = {
  ...QUALITY_PRESETS.medium,
  qualityPreset: 'medium',
  adaptiveErrorScaling: true,
  maxMicroPolygons: 250_000,
  enableProfiling: true
};

function triangleArea(triangle: Triangle): number {
  const [a, b, c] = triangle.vertices;
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  const magnitude = Math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2);
  return magnitude / 2;
}

function projectPixelError(triangle: Triangle, camera: CameraState): number {
  const area = triangleArea(triangle);
  const distance = Math.max(
    0.0001,
    Math.sqrt(
      (triangle.vertices[0][0] - camera.position[0]) ** 2 +
        (triangle.vertices[0][1] - camera.position[1]) ** 2 +
        (triangle.vertices[0][2] - camera.position[2]) ** 2
    )
  );
  const fovFactor = (camera.fov / 90) * 1.5;
  return (area / distance) * fovFactor;
}

function subdivideTriangle(triangle: Triangle): Triangle[] {
  const [a, b, c] = triangle.vertices;
  const abMid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const bcMid: Vec3 = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2];
  const caMid: Vec3 = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2];

  const baseId = triangle.id;
  return [
    { id: `${baseId}:0`, vertices: [a, abMid, caMid], materialId: triangle.materialId },
    { id: `${baseId}:1`, vertices: [abMid, b, bcMid], materialId: triangle.materialId },
    { id: `${baseId}:2`, vertices: [caMid, bcMid, c], materialId: triangle.materialId },
    { id: `${baseId}:3`, vertices: [abMid, bcMid, caMid], materialId: triangle.materialId }
  ];
}

export class MicroPolygonRenderer {
  private config: MicroPolygonRendererConfig;

  constructor(config: Partial<MicroPolygonRendererConfig> = {}) {
    this.config = this.normaliseConfig({ ...DEFAULT_CONFIG, ...config });
  }

  configureQuality(preset: QualityPreset, overrides: Partial<MicroPolygonRendererConfig> = {}): void {
    this.config = this.normaliseConfig({ ...DEFAULT_CONFIG, ...QUALITY_PRESETS[preset], qualityPreset: preset, ...overrides });
  }

  render(scene: Scene, camera: CameraState): RendererFrameStats {
    this.validateScene(scene);
    const qualityTier = this.config.qualityPreset ?? 'medium';
    const warnings: RendererWarning[] = [];
    let adaptiveScale = 1;
    if (this.config.adaptiveErrorScaling) {
      adaptiveScale = this.computeAdaptiveScale(camera);
    }
    const pixelThreshold = this.config.pixelErrorThreshold * adaptiveScale;

    let queue: Triangle[] = [...scene.triangles];
    const subdivisionLevels: Record<number, number> = {};
    const microPolygons: Triangle[] = [];

    for (let level = 0; level < this.config.maxSubdivisions; level += 1) {
      subdivisionLevels[level] = queue.length;
      const nextLevel: Triangle[] = [];
      for (const triangle of queue) {
        const error = projectPixelError(triangle, camera);
        if (Number.isNaN(error)) {
          warnings.push({ code: 'INVALID_GEOMETRY', message: `Triangle ${triangle.id} produced NaN error` });
          continue;
        }
        if (error > pixelThreshold) {
          nextLevel.push(...subdivideTriangle(triangle));
        } else {
          microPolygons.push(triangle);
        }
        if (this.config.maxMicroPolygons && microPolygons.length > this.config.maxMicroPolygons) {
          warnings.push({ code: 'MICRO_POLYGON_LIMIT', message: 'Micro polygon limit reached, clamping quality.' });
          microPolygons.splice(this.config.maxMicroPolygons);
          break;
        }
      }
      if (this.config.maxMicroPolygons && microPolygons.length >= this.config.maxMicroPolygons) {
        break;
      }
      queue = nextLevel;
      if (queue.length === 0) {
        break;
      }
    }
    microPolygons.push(...queue);

    const microPolygonCount = this.config.maxMicroPolygons
      ? Math.min(microPolygons.length, this.config.maxMicroPolygons)
      : microPolygons.length;
    const shadingCost = this.estimateShadingCost(microPolygonCount, camera.fov);
    const estimatedFrameMs = this.estimateFrameCost(microPolygonCount, scene.triangles.length, shadingCost);
    const cacheThrashRate = this.estimateCacheThrash(microPolygonCount);

    if (cacheThrashRate > 0.1) {
      warnings.push({ code: 'CACHE_PRESSURE', message: 'Geometry cache under pressure, consider increasing cache size.' });
    }

    if (this.config.adaptiveErrorScaling && Math.abs(adaptiveScale - 1) > 0.01) {
      warnings.push({ code: 'QUALITY_CLAMPED', message: `Adaptive scale (${adaptiveScale.toFixed(2)}) adjusted pixel threshold.` });
    }

    const budgetMet = estimatedFrameMs <= this.config.targetFrameMs && cacheThrashRate < 0.05;

    return {
      sceneId: scene.id,
      targetFrameMs: this.config.targetFrameMs,
      estimatedFrameMs,
      trianglesRendered: scene.triangles.length,
      microPolygons: microPolygonCount,
      cacheThrashRate,
      shadingCost,
      subdivisionLevels,
      qualityTier,
      adaptiveScale,
      warnings,
      budgetMet
    };
  }

  private normaliseConfig(config: MicroPolygonRendererConfig): MicroPolygonRendererConfig {
    if (config.targetFrameMs <= 0) {
      throw new Error('targetFrameMs must be positive.');
    }
    if (config.maxSubdivisions <= 0) {
      throw new Error('maxSubdivisions must be positive.');
    }
    if (config.pixelErrorThreshold <= 0) {
      throw new Error('pixelErrorThreshold must be positive.');
    }
    if (config.cacheSizeMb <= 0) {
      throw new Error('cacheSizeMb must be positive.');
    }
    if (config.maxMicroPolygons !== undefined && config.maxMicroPolygons <= 0) {
      throw new Error('maxMicroPolygons must be positive when provided.');
    }
    return config;
  }

  private validateScene(scene: Scene): void {
    for (const triangle of scene.triangles) {
      const [a, b, c] = triangle.vertices;
      if (!this.isFiniteVec3(a) || !this.isFiniteVec3(b) || !this.isFiniteVec3(c)) {
        throw new Error(`Triangle ${triangle.id} has non-finite vertices.`);
      }
    }
  }

  private isFiniteVec3(vec: Vec3): boolean {
    return vec.every((component) => Number.isFinite(component));
  }

  private computeAdaptiveScale(camera: CameraState): number {
    const distance = Math.sqrt(camera.position[0] ** 2 + camera.position[1] ** 2 + camera.position[2] ** 2);
    const distanceScale = Math.min(2, Math.max(0.5, distance / 50));
    const fovScale = Math.min(1.5, Math.max(0.6, camera.fov / 90));
    return Number((distanceScale * fovScale).toFixed(3));
  }

  private estimateFrameCost(microPolygonCount: number, baseTriangles: number, shadingCost: number): number {
    const tessellationCost = microPolygonCount * 0.00045;
    const baseCost = baseTriangles * 0.00025;
    const total = tessellationCost + baseCost + shadingCost;
    return Number(total * 1.08);
  }

  private estimateShadingCost(microPolygonCount: number, fov: number): number {
    const shadingBudget = microPolygonCount * (fov / 120) * 0.0002;
    return Number(shadingBudget);
  }

  private estimateCacheThrash(microPolygonCount: number): number {
    const bytesPerPolygon = 192; // rough budget for vertex + attribute payload
    const workingSetMb = (microPolygonCount * bytesPerPolygon) / (1024 * 1024);
    if (workingSetMb <= this.config.cacheSizeMb) {
      return 0.01;
    }
    const overage = workingSetMb - this.config.cacheSizeMb;
    return Number(Math.min(0.3, 0.01 + overage / this.config.cacheSizeMb));
  }
}
