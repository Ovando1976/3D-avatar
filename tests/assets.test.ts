import { describe, expect, it } from 'vitest';
import { MetadataIngestor } from '../src/engine/assets/MetadataIngestor.js';
import { StreamingTextureCache } from '../src/engine/assets/StreamingTextureCache.js';

describe('MetadataIngestor', () => {
  it('creates bundle paths for variants and evolves schema', () => {
    const ingestor = new MetadataIngestor('/build/assets');
    const artifact = ingestor.ingest({
      assetId: 'tree01',
      sourceFile: 'tree01.usd',
      tags: [' foliage '],
      variantSets: [{ name: 'season', variants: ['spring', 'winter'] }],
      dependencies: ['bark', 'leaves'],
      usdIntegrity: {
        defaultPrim: '/TreeRoot',
        metersPerUnit: 1,
        variantSets: ['season']
      }
    });
    expect(artifact.bundlePath).toBe('/build/assets/tree01/bundle.usdz');
    expect(artifact.variants['season:spring']).toBe('/build/assets/tree01/season/spring');
    expect(artifact.dependencies).toEqual(['bark', 'leaves']);
    expect(artifact.tags).toEqual(['foliage']);
    expect(artifact.schemaVersion).toBe(2);
  });

  it('validates KTX2 payload integrity', () => {
    const ingestor = new MetadataIngestor('/build/assets');
    expect(() =>
      ingestor.ingest({
        assetId: 'terrain_tex',
        sourceFile: 'terrain.ktx2',
        tags: ['terrain'],
        variantSets: [],
        dependencies: [],
        ktx2Integrity: {
          identifier: 'invalid',
          vkFormat: 37,
          pixelWidth: 4096,
          pixelHeight: 4096,
          levelCount: 8
        }
      })
    ).toThrow(/Invalid KTX2 identifier magic/);
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

  it('streams missing pages from GPU feedback using the IO pipeline', async () => {
    const cache = new StreamingTextureCache({
      capacityMb: 64,
      ioPipeline: {
        fetchPage: async ({ pageId, textureId, byteLengthHint }) => ({
          encodedByteLength: Math.floor(byteLengthHint * 0.5),
          decodedByteLength: byteLengthHint,
          checksum: `${textureId}-${pageId}`
        })
      }
    });

    cache.requestTexture({ id: 'terrain', resolution: 8192, sizeMb: 24, priority: 10 });

    const report = await cache.submitGpuPageFeedback({
      textureId: 'terrain',
      missingPages: [1, 2, 3],
      residentPages: [0],
      frameId: 100
    });

    expect(report.loadedPages).toBe(3);
    expect(report.failedPages).toBe(0);
    const state = cache.getVirtualTextureState('terrain');
    expect(state.loadedPages).toBeGreaterThanOrEqual(4);
    expect(state.missingPages).toEqual([1, 2, 3]);
  });
});
