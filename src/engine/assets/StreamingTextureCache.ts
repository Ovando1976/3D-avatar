export interface TextureRequest {
  id: string;
  resolution: number;
  sizeMb: number;
  priority: number;
}

export interface ResidencySample {
  timestamp: number;
  residencyPercent: number;
  thrashEvents: number;
  evictions: number;
  highWatermarkBreaches: number;
}

export type EvictionPolicy = 'LRU' | 'LFU' | 'PRIORITY';

export interface StreamingTextureCacheConfig {
  capacityMb: number;
  evictionPolicy?: EvictionPolicy;
  highWatermarkPercent?: number;
  lowWatermarkPercent?: number;
  pageSizeKb?: number;
  maxConcurrentIo?: number;
  ioPipeline?: TextureIoPipeline;
  clock?: () => number;
}

export interface GpuPageFeedback {
  textureId: string;
  missingPages: number[];
  residentPages?: number[];
  frameId: number;
}

export interface VirtualTexturePage {
  textureId: string;
  pageId: number;
  mipLevel: number;
  byteLength: number;
  loadedAt: number;
}

export interface IoLoadRequest {
  textureId: string;
  pageId: number;
  mipLevel: number;
  byteLengthHint: number;
}

export interface IoLoadResult {
  encodedByteLength: number;
  decodedByteLength: number;
  checksum: string;
}

export interface TextureIoPipeline {
  fetchPage(request: IoLoadRequest): Promise<IoLoadResult>;
}

export interface VirtualTextureStreamingReport {
  textureId: string;
  requestedPages: number;
  loadedPages: number;
  failedPages: number;
}

interface CacheEntry {
  request: TextureRequest;
  lastAccess: number;
  residency: number;
  hits: number;
  pinnedUntil?: number;
  virtualPages: Map<number, VirtualTexturePage>;
  recentlyMissingPages: number[];
}

interface IoQueueTask {
  textureId: string;
  pageId: number;
  mipLevel: number;
}

export class StreamingTextureCache {
  private config: Required<Omit<StreamingTextureCacheConfig, 'clock' | 'ioPipeline'>> & {
    clock?: () => number;
    ioPipeline?: TextureIoPipeline;
  };
  private readonly cache = new Map<string, CacheEntry>();
  private residencySamples: ResidencySample[] = [];
  private logicalClock = 0;
  private evictionCounter = 0;
  private highWatermarkBreaches = 0;
  private readonly ioQueue: IoQueueTask[] = [];
  private ioInFlight = 0;

  constructor(config: StreamingTextureCacheConfig) {
    if (config.capacityMb <= 0) {
      throw new Error('StreamingTextureCache capacity must be positive.');
    }
    const highWatermarkPercent = config.highWatermarkPercent ?? 0.9;
    const lowWatermarkPercent = config.lowWatermarkPercent ?? 0.7;
    if (highWatermarkPercent <= lowWatermarkPercent) {
      throw new Error('highWatermarkPercent must be greater than lowWatermarkPercent.');
    }
    this.config = {
      capacityMb: config.capacityMb,
      evictionPolicy: config.evictionPolicy ?? 'LRU',
      highWatermarkPercent,
      lowWatermarkPercent,
      pageSizeKb: config.pageSizeKb ?? 64,
      maxConcurrentIo: config.maxConcurrentIo ?? 4,
      ioPipeline: config.ioPipeline,
      clock: config.clock
    };
  }

  requestTexture(request: TextureRequest, options: { pinForMs?: number } = {}): void {
    const timestamp = this.nextTimestamp();
    const entry = this.cache.get(request.id);
    if (entry) {
      entry.lastAccess = timestamp;
      entry.hits += 1;
      entry.residency = Math.min(1, entry.residency + 0.15);
      if (options.pinForMs) {
        entry.pinnedUntil = timestamp + options.pinForMs;
      }
      return;
    }

    this.ensureCapacity(request.sizeMb, timestamp);
    this.cache.set(request.id, {
      request,
      lastAccess: timestamp,
      hits: 1,
      residency: Math.min(1, request.priority / 10),
      pinnedUntil: options.pinForMs ? timestamp + options.pinForMs : undefined,
      virtualPages: new Map(),
      recentlyMissingPages: []
    });
  }

  async submitGpuPageFeedback(feedback: GpuPageFeedback): Promise<VirtualTextureStreamingReport> {
    const entry = this.cache.get(feedback.textureId);
    if (!entry) {
      throw new Error(`Texture ${feedback.textureId} is not resident in cache.`);
    }

    for (const pageId of feedback.residentPages ?? []) {
      if (!entry.virtualPages.has(pageId)) {
        entry.virtualPages.set(pageId, {
          textureId: feedback.textureId,
          pageId,
          mipLevel: 0,
          byteLength: this.estimatePageByteLength(entry.request.resolution, 0),
          loadedAt: this.getTimestamp()
        });
      }
    }

    entry.recentlyMissingPages = [...feedback.missingPages];

    if (feedback.missingPages.length === 0) {
      entry.residency = Math.min(1, entry.residency + 0.1);
      return {
        textureId: feedback.textureId,
        requestedPages: 0,
        loadedPages: 0,
        failedPages: 0
      };
    }

    const report = await this.streamVirtualTexture(
      feedback.textureId,
      feedback.missingPages.map((pageId) => ({ pageId, mipLevel: 0 }))
    );

    const totalKnownPages = Math.max(1, entry.virtualPages.size + feedback.missingPages.length);
    entry.residency = Math.min(1, entry.virtualPages.size / totalKnownPages);
    return report;
  }

  async streamVirtualTexture(
    textureId: string,
    pageRequests: Array<{ pageId: number; mipLevel: number }>
  ): Promise<VirtualTextureStreamingReport> {
    const entry = this.cache.get(textureId);
    if (!entry) {
      throw new Error(`Texture ${textureId} is not resident in cache.`);
    }
    if (!this.config.ioPipeline) {
      throw new Error('Texture IO pipeline is not configured.');
    }

    let loadedPages = 0;
    let failedPages = 0;

    const queue = pageRequests.filter((request) => !entry.virtualPages.has(request.pageId));
    for (const request of queue) {
      this.ioQueue.push({ textureId, pageId: request.pageId, mipLevel: request.mipLevel });
    }

    while (this.ioQueue.length || this.ioInFlight > 0) {
      while (this.ioInFlight < this.config.maxConcurrentIo && this.ioQueue.length) {
        const task = this.ioQueue.shift();
        if (!task) {
          break;
        }
        this.ioInFlight += 1;
        this.executeIoTask(task)
          .then((page) => {
            entry.virtualPages.set(page.pageId, page);
            loadedPages += 1;
          })
          .catch(() => {
            failedPages += 1;
          })
          .finally(() => {
            this.ioInFlight -= 1;
          });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return {
      textureId,
      requestedPages: pageRequests.length,
      loadedPages,
      failedPages
    };
  }

  getVirtualTextureState(textureId: string): { loadedPages: number; missingPages: number[] } {
    const entry = this.cache.get(textureId);
    if (!entry) {
      return { loadedPages: 0, missingPages: [] };
    }
    return {
      loadedPages: entry.virtualPages.size,
      missingPages: [...entry.recentlyMissingPages]
    };
  }

  releaseTexture(id: string): void {
    if (this.cache.delete(id)) {
      this.evictionCounter += 1;
    }
  }

  captureResidencySample(): ResidencySample {
    const timestamp = this.getTimestamp();
    const totalSize = this.currentUsage();
    const residencyPercent = totalSize === 0 ? 1 : Math.min(1, this.residentSize() / totalSize);
    const thrashEvents = [...this.cache.values()].filter((entry) => entry.residency < 0.3).length;
    const sample: ResidencySample = {
      timestamp,
      residencyPercent,
      thrashEvents,
      evictions: this.evictionCounter,
      highWatermarkBreaches: this.highWatermarkBreaches
    };
    this.evictionCounter = 0;
    this.highWatermarkBreaches = 0;
    this.residencySamples.push(sample);
    if (this.residencySamples.length > 512) {
      this.residencySamples = this.residencySamples.slice(-256);
    }
    return sample;
  }

  residencyTimeline(): ResidencySample[] {
    return [...this.residencySamples];
  }

  setEvictionPolicy(policy: EvictionPolicy): void {
    this.config.evictionPolicy = policy;
  }

  private async executeIoTask(task: IoQueueTask): Promise<VirtualTexturePage> {
    if (!this.config.ioPipeline) {
      throw new Error('Texture IO pipeline is not configured.');
    }
    const byteLengthHint = this.estimatePageByteLength(this.cache.get(task.textureId)?.request.resolution ?? 1024, task.mipLevel);
    const result = await this.config.ioPipeline.fetchPage({
      textureId: task.textureId,
      pageId: task.pageId,
      mipLevel: task.mipLevel,
      byteLengthHint
    });

    if (!result.checksum || result.decodedByteLength <= 0 || result.encodedByteLength <= 0) {
      throw new Error(`Invalid IO payload for texture ${task.textureId} page ${task.pageId}.`);
    }

    return {
      textureId: task.textureId,
      pageId: task.pageId,
      mipLevel: task.mipLevel,
      byteLength: result.decodedByteLength,
      loadedAt: this.getTimestamp()
    };
  }

  private estimatePageByteLength(resolution: number, mipLevel: number): number {
    const mipResolution = Math.max(4, Math.floor(resolution / Math.pow(2, mipLevel)));
    const bytesPerPixel = 4;
    const texelCount = Math.max(16, mipResolution * mipResolution);
    const pageBytes = Math.max(1024, Math.floor((this.config.pageSizeKb * 1024 * texelCount) / (resolution * resolution)));
    return pageBytes * bytesPerPixel;
  }

  private ensureCapacity(incomingSize: number, timestamp: number): void {
    const highWatermark = this.config.capacityMb * this.config.highWatermarkPercent;
    const lowWatermark = this.config.capacityMb * this.config.lowWatermarkPercent;

    if (this.currentUsage() + incomingSize > highWatermark) {
      this.highWatermarkBreaches += 1;
    }

    while (this.currentUsage() + incomingSize > lowWatermark) {
      const candidate = this.selectEvictionCandidate(timestamp);
      if (!candidate) {
        break;
      }
      this.cache.delete(candidate.request.id);
      this.evictionCounter += 1;
    }
  }

  private selectEvictionCandidate(timestamp: number): CacheEntry | undefined {
    let selected: CacheEntry | undefined;
    for (const entry of this.cache.values()) {
      if (entry.pinnedUntil && entry.pinnedUntil > timestamp) {
        continue;
      }
      if (!selected) {
        selected = entry;
        continue;
      }
      switch (this.config.evictionPolicy) {
        case 'LRU':
          if (entry.lastAccess < selected.lastAccess) {
            selected = entry;
          }
          break;
        case 'LFU':
          if (entry.hits < selected.hits) {
            selected = entry;
          }
          break;
        case 'PRIORITY':
          if (entry.request.priority < selected.request.priority) {
            selected = entry;
          }
          break;
        default:
          break;
      }
    }
    return selected;
  }

  private currentUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.request.sizeMb;
    }
    return total;
  }

  private residentSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.request.sizeMb * entry.residency;
    }
    return total;
  }

  private nextTimestamp(): number {
    if (this.config.clock) {
      return this.config.clock();
    }
    this.logicalClock += 1;
    return this.logicalClock;
  }

  private getTimestamp(): number {
    return this.config.clock ? this.config.clock() : this.logicalClock;
  }
}
