import { describe, expect, it } from 'vitest';
import type { QualityPreset, RendererWarning, Scene } from "../src/engine/rendering/MicroPolygonRenderer.js";
import { MicroPolygonRenderer } from "../src/engine/rendering/MicroPolygonRenderer.js";


const makeScene = (triangleCount: number): Scene => ({
  id: 'testScene',
  triangles: Array.from({ length: triangleCount }, (_, index) => ({
    id: `tri-${index}`,
    materialId: 'mat',
    vertices: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0]
    ]
  }))
});

describe('MicroPolygonRenderer', () => {
  it('subdivides triangles until error threshold is met', () => {
    const renderer = new MicroPolygonRenderer({ pixelErrorThreshold: 0.0001, maxSubdivisions: 2 });
    const stats = renderer.render(makeScene(4), { position: [0, 0, 5], fov: 90 });
    expect(stats.microPolygons).toBeGreaterThan(4);
    expect(stats.trianglesRendered).toBe(4);
    expect(stats.warnings.every((warning: RendererWarning) => warning.code !== 'INVALID_GEOMETRY')).toBe(true);
  });

  it.each<QualityPreset>(['low', 'medium', 'high', 'cinematic'])(
    'honors quality preset %s and produces adaptive diagnostics',
    (preset) => {
      const renderer = new MicroPolygonRenderer();
      renderer.configureQuality(preset);
      const stats = renderer.render(makeScene(1), { position: [0, 0, 15], fov: 80 });
      expect(stats.qualityTier).toBe(preset);
      expect(stats.subdivisionLevels).toBeTypeOf('object');
      expect(stats.microPolygons).toBeGreaterThan(0);
    }
  );

  it('reports budget metrics and warnings when cache pressure occurs', () => {
    const renderer = new MicroPolygonRenderer({ cacheSizeMb: 1, maxMicroPolygons: 50 });
    const stats = renderer.render(makeScene(20), { position: [0, 0, 2], fov: 120 });
    expect(stats.warnings.some((warning: RendererWarning) => warning.code === 'CACHE_PRESSURE')).toBe(true);
    expect(typeof stats.shadingCost).toBe('number');
  });
});
