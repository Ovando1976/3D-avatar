export interface MotionSample {
  id: string;
  style: string;
  duration: number;
  keyframes: number;
}

export interface BlendRequest {
  from: string;
  to: string;
  energy: number;
}

export interface BlendDiagnostics {
  stylePenalty: number;
  energyBias: number;
  continuityScore: number;
}

export interface BlendResult {
  blendCurve: number[];
  duration: number;
  confidence: number;
  diagnostics: BlendDiagnostics;
}

export class AnimationCopilot {
  private readonly samples = new Map<string, MotionSample>();

  constructor(samples: MotionSample[] = []) {
    for (const sample of samples) {
      this.registerSample(sample);
    }
  }

  registerSample(sample: MotionSample): void {
    if (sample.duration <= 0) {
      throw new Error('Sample duration must be positive.');
    }
    if (sample.keyframes <= 0) {
      throw new Error('Sample keyframes must be positive.');
    }
    this.samples.set(sample.id, sample);
  }

  removeSample(id: string): boolean {
    return this.samples.delete(id);
  }

  listSamples(): MotionSample[] {
    return [...this.samples.values()];
  }

  blend(request: BlendRequest): BlendResult {
    const source = this.samples.get(request.from);
    const target = this.samples.get(request.to);
    if (!source || !target) {
      throw new Error('Unknown motion samples');
    }
    const stylePenalty = source.style === target.style ? 0 : 0.2;
    const keyframeCount = Math.max(source.keyframes, target.keyframes);
    const blendCurve = this.generateCurve(keyframeCount, request.energy, stylePenalty);
    const duration = this.interpolateDuration(source.duration, target.duration, request.energy);
    const continuityScoreRaw = (1 - stylePenalty) * (keyframeCount / (keyframeCount + 5));
    const diagnostics: BlendDiagnostics = {
      stylePenalty: Number(stylePenalty.toFixed(3)),
      energyBias: Number(Math.min(1, Math.max(0, request.energy)).toFixed(3)),
      continuityScore: Number(continuityScoreRaw.toFixed(3))
    };
    const confidence = this.estimateConfidence(stylePenalty, request.energy, keyframeCount);
    return { blendCurve, duration, confidence, diagnostics };
  }

  private generateCurve(steps: number, energy: number, stylePenalty: number): number[] {
    const result: number[] = [];
    const clampedEnergy = Math.min(1, Math.max(0, energy));
    for (let i = 0; i < steps; i += 1) {
      const t = i / Math.max(1, steps - 1);
      const ease = t * t * (3 - 2 * t);
      const energyFactor = 1 - stylePenalty + clampedEnergy * 0.15;
      const rawValue = Math.min(1, ease * energyFactor);
      const smoothed = i === 0 ? rawValue : (result[i - 1] * 2 + rawValue) / 3;
      result.push(Number(smoothed.toFixed(4)));
    }
    return result;
  }

  private interpolateDuration(sourceDuration: number, targetDuration: number, energy: number): number {
    const blend = Math.min(1, Math.max(0, energy));
    const weighted = sourceDuration * (1 - blend) + targetDuration * blend;
    return Number(weighted.toFixed(3));
  }

  private estimateConfidence(stylePenalty: number, energy: number, keyframes: number): number {
    const base = 1 - stylePenalty;
    const energyFactor = 1 - Math.abs(energy - 0.5) * 0.4;
    const continuity = Math.min(1, keyframes / 120);
    return Number(Math.max(0, base * energyFactor * continuity).toFixed(3));
  }
}
