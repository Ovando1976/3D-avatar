export interface TelemetrySample {
  timestamp: number;
  frameTimeMs: number;
  memoryMb: number;
  networkRttMs: number;
}

export interface TelemetryInsights {
  averageFrameTime: number;
  percentile95FrameTime: number;
  memoryPeak: number;
  networkStabilityIndex: number;
  framesPerSecond: number;
  outlierCount: number;
}

export interface TelemetryTrend {
  frameTimeSlope: number;
  memorySlope: number;
  networkSlope: number;
}

export class TelemetryDashboard {
  private readonly samples: TelemetrySample[] = [];
  private readonly maxSamples = 2048;

  record(sample: TelemetrySample): void {
    this.validateSample(sample);
    this.samples.push(sample);
    this.samples.sort((a, b) => a.timestamp - b.timestamp);
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  reset(): void {
    this.samples.splice(0, this.samples.length);
  }

  insights(): TelemetryInsights {
    if (this.samples.length === 0) {
      return {
        averageFrameTime: 0,
        percentile95FrameTime: 0,
        memoryPeak: 0,
        networkStabilityIndex: 1,
        framesPerSecond: 0,
        outlierCount: 0
      };
    }
    const frameTimes = this.samples.map((sample) => sample.frameTimeMs);
    const memory = this.samples.map((sample) => sample.memoryMb);
    const rtts = this.samples.map((sample) => sample.networkRttMs);
    const averageFrameTime = this.average(frameTimes);
    const percentile95FrameTime = this.percentile(frameTimes, 0.95);
    const memoryPeak = Math.max(...memory);
    const networkStabilityIndex = this.computeNetworkStability(rtts);
    const framesPerSecond = averageFrameTime === 0 ? 0 : Number((1000 / averageFrameTime).toFixed(3));
    const outlierThreshold = percentile95FrameTime * 1.2;
    const outlierCount = frameTimes.filter((time) => time > outlierThreshold).length;
    return {
      averageFrameTime: Number(averageFrameTime.toFixed(3)),
      percentile95FrameTime: Number(percentile95FrameTime.toFixed(3)),
      memoryPeak: Number(memoryPeak.toFixed(3)),
      networkStabilityIndex: Number(networkStabilityIndex.toFixed(3)),
      framesPerSecond,
      outlierCount
    };
  }

  trend(windowSize = 120): TelemetryTrend {
    const window = this.samples.slice(-windowSize);
    if (window.length < 2) {
      return { frameTimeSlope: 0, memorySlope: 0, networkSlope: 0 };
    }
    const timestamps = window.map((sample) => sample.timestamp);
    return {
      frameTimeSlope: Number(this.linearRegression(timestamps, window.map((sample) => sample.frameTimeMs)).toFixed(4)),
      memorySlope: Number(this.linearRegression(timestamps, window.map((sample) => sample.memoryMb)).toFixed(4)),
      networkSlope: Number(this.linearRegression(timestamps, window.map((sample) => sample.networkRttMs)).toFixed(4))
    };
  }

  private validateSample(sample: TelemetrySample): void {
    if (sample.frameTimeMs < 0 || sample.memoryMb < 0 || sample.networkRttMs < 0) {
      throw new Error('Telemetry samples must be non-negative.');
    }
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private percentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(percentile * sorted.length));
    return sorted[index];
  }

  private computeNetworkStability(rtts: number[]): number {
    if (rtts.length === 0) {
      return 1;
    }
    const average = this.average(rtts);
    const variance = rtts.reduce((sum, value) => sum + (value - average) ** 2, 0) / rtts.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, 1 - stdDev / Math.max(1, average));
  }

  private linearRegression(xs: number[], ys: number[]): number {
    const count = xs.length;
    const avgX = this.average(xs);
    const avgY = this.average(ys);
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < count; i += 1) {
      const dx = xs[i] - avgX;
      numerator += dx * (ys[i] - avgY);
      denominator += dx ** 2;
    }
    if (denominator === 0) {
      return 0;
    }
    return numerator / denominator;
  }
}
