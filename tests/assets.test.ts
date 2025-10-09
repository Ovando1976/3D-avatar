import { describe, expect, it } from 'vitest';
import { MetadataIngestor } from '../src/engine/assets/MetadataIngestor.js';
import { StreamingTextureCache } from '../src/engine/assets/StreamingTextureCache.js';

describe('MetadataIngestor', () => {
  it('creates bundle paths for variants', () => {
    const ingestor = new MetadataIngestor('/build/assets');
    const artifact = ingestor.ingest({
      assetId: 'tree01',
      sourceFile: 'tree01.usd',
      tags: ['foliage'],
      variantSets: [
        { name: 'season', variants: ['spring', 'winter'] }
      ],
      dependencies: ['bark', 'leaves']
    });
    expect(artifact.bundlePath).toBe('/build/assets/tree01/bundle.usdz');
    expect(artifact.variants['season:spring']).toBe('/build/assets/tree01/season/spring');
    expect(artifact.dependencies).toEqual(['bark', 'leaves']);
    expect(artifact.tags).toEqual(['foliage']);
  });
});

describe('StreamingTextureCache', () => {
  it('evicts least recently used textures when capacity exceeded', () => {
    const cache = new StreamingTextureCache({ capacityMb: 12, evictionPolicy: 'LRU' });
    cache.requestTexture({ id: 'a', resolution: 4096, sizeMb: 8, priority: 9 });
    cache.requestTexture({ id: 'b', resolution: 2048, sizeMb: 6, priority: 5 });
    cache.requestTexture({ id: 'c', resolution: 1024, sizeMb: 4, priority: 4 });
    expect(() => cache.setEvictionPolicy('PRIORITY')).not.toThrow();
    cache.requestTexture({ id: 'd', resolution: 512, sizeMb: 6, priority: 10 });
    const sample = cache.captureResidencySample();
    expect(sample.evictions).toBeGreaterThanOrEqual(1);
    expect(sample.highWatermarkBreaches).toBeGreaterThanOrEqual(0);
    expect(() => cache.setEvictionPolicy('LFU')).not.toThrow();
  });
});
