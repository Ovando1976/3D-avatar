import { describe, expect, it } from 'vitest';
import {
  AnimationCopilot,
  MaterialCopilot
} from '../src/index.js';

describe('MaterialCopilot', () => {
  it('creates metallic materials for gold prompt', () => {
    const copilot = new MaterialCopilot();
    const graph = copilot.generateGraph('gold metal pattern', { seed: 42 });
    const surface = graph.nodes.find((node) => node.id === 'surface');
    expect(surface?.params.metallic).toBeGreaterThan(0.5);
    expect(graph.nodes.some((node) => node.id === 'patternNoise')).toBe(true);
    const edited = copilot.suggestEdits('make it shinier', graph);
    const editedSurface = edited.nodes.find((node) => node.id === 'surface');
    expect(Number(editedSurface?.params.roughness)).toBeLessThan(Number(surface?.params.roughness));
  });

  it('supports registering custom styles and emphasis', () => {
    const copilot = new MaterialCopilot({ styleLibrary: {} });
    copilot.registerStyle('holographic', { transmission: 0.9, roughness: 0.05 });
    const graph = copilot.generateGraph('holographic glass', { emphasis: 'transmission' });
    const surface = graph.nodes.find((node) => node.id === 'surface');
    expect(Number(surface?.params.transmission)).toBeGreaterThan(0.8);
  });
});

describe('AnimationCopilot', () => {
  it('blends animations with confidence score', () => {
    const copilot = new AnimationCopilot([
      { id: 'idle', style: 'calm', duration: 2, keyframes: 10 },
      { id: 'run', style: 'energetic', duration: 1.5, keyframes: 12 }
    ]);
    const blend = copilot.blend({ from: 'idle', to: 'run', energy: 0.8 });
    expect(blend.blendCurve.length).toBeGreaterThan(0);
    expect(blend.confidence).toBeLessThanOrEqual(1);
    expect(blend.diagnostics.energyBias).toBeCloseTo(0.8, 1);
    expect(copilot.listSamples().length).toBe(2);
  });

  it('allows registering and removing samples', () => {
    const copilot = new AnimationCopilot();
    copilot.registerSample({ id: 'jump', style: 'energetic', duration: 1, keyframes: 8 });
    expect(copilot.listSamples()).toHaveLength(1);
    expect(copilot.removeSample('jump')).toBe(true);
  });
});
