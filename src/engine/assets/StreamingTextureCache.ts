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
  clock?: () => number;
}

interface CacheEntry {
  request: TextureRequest;
  lastAccess: number;
  residency: number;
  hits: number;
  pinnedUntil?: number;
}

export class StreamingTextureCache {
  private config: Required<Omit<StreamingTextureCacheConfig, 'clock'>> & { clock?: () => number };
  private readonly cache = new Map<string, CacheEntry>();
  private residencySamples: ResidencySample[] = [];
  private logicalClock = 0;
  private evictionCounter = 0;
  private highWatermarkBreaches = 0;

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
      pinnedUntil: options.pinForMs ? timestamp + options.pinForMs : undefined
    });
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
