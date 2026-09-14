import { describe, it, expect } from 'vitest';
import { renderAircraftImageData } from './aircraft-icons';

describe('renderAircraftImageData', () => {
  it('returns valid buffer structure even in non-DOM or test environment', () => {
    const icon = renderAircraftImageData('plane-cyan', '#00E5FF', 28);
    expect(icon.width).toBe(28);
    expect(icon.height).toBe(28);
    expect(icon.data).toBeInstanceOf(Uint8Array);
  });

  it('handles military, private, and civil icons', () => {
    const mil = renderAircraftImageData('plane-red', '#D32F2F', 28);
    const priv = renderAircraftImageData('plane-pink', '#F48FB1', 28);
    const civil = renderAircraftImageData('plane-cyan', '#00E5FF', 28);

    expect(mil.width).toBe(28);
    expect(priv.width).toBe(28);
    expect(civil.width).toBe(28);
  });
});
