import { describe, expect, it } from 'vitest';
import { TelemetryDashboard } from '../src/beta/TelemetryDashboard.js';

describe('TelemetryDashboard', () => {
  it('computes insights from samples', () => {
    const dashboard = new TelemetryDashboard();
    for (let i = 0; i < 10; i += 1) {
      dashboard.record({
        timestamp: i,
        frameTimeMs: 10 + i,
        memoryMb: 4096 + i * 10,
        networkRttMs: 50 + (i % 3) * 5
      });
    }
    const insights = dashboard.insights();
    expect(insights.averageFrameTime).toBeGreaterThan(10);
    expect(insights.memoryPeak).toBeGreaterThan(4096);
    expect(insights.networkStabilityIndex).toBeLessThanOrEqual(1);
    expect(insights.framesPerSecond).toBeGreaterThan(0);
    expect(insights.outlierCount).toBeGreaterThanOrEqual(0);
    const trend = dashboard.trend();
    expect(trend).toHaveProperty('frameTimeSlope');
  });
});
