import { describe, it, expect } from 'vitest';
import { renderShipImageData } from './ship-icons';

describe('renderShipImageData', () => {
  it('returns valid buffer structure even in non-DOM or test environment', () => {
    const icon = renderShipImageData('ship-cargo', '#26C6DA', 28);
    expect(icon.width).toBe(28);
    expect(icon.height).toBe(28);
    expect(icon.data).toBeInstanceOf(Uint8Array);
    expect(icon.data.length).toBe(28 * 28 * 4);
  });

  it('handles military, tanker, passenger, cargo, and default icons', () => {
    const cargo = renderShipImageData('ship-cargo', '#26C6DA', 28);
    const tanker = renderShipImageData('ship-tanker', '#E65100', 28);
    const military = renderShipImageData('ship-military', '#D32F2F', 28);
    const passenger = renderShipImageData('ship-passenger', '#FFD700', 28);
    const defaultShip = renderShipImageData('ship-default', '#B0BEC5', 28);

    expect(cargo.width).toBe(28);
    expect(tanker.width).toBe(28);
    expect(military.width).toBe(28);
    expect(passenger.width).toBe(28);
    expect(defaultShip.width).toBe(28);

    expect(cargo.data.length).toBe(28 * 28 * 4);
    expect(tanker.data.length).toBe(28 * 28 * 4);
    expect(military.data.length).toBe(28 * 28 * 4);
    expect(passenger.data.length).toBe(28 * 28 * 4);
    expect(defaultShip.data.length).toBe(28 * 28 * 4);
  });

  it('handles shorthand type names', () => {
    const mil = renderShipImageData('military', '#D32F2F', 32);
    const tan = renderShipImageData('tanker', '#E65100', 32);
    const car = renderShipImageData('cargo', '#26C6DA', 32);
    const pas = renderShipImageData('passenger', '#FFD700', 32);

    expect(mil.width).toBe(32);
    expect(tan.width).toBe(32);
    expect(car.width).toBe(32);
    expect(pas.width).toBe(32);
  });

  it('supports custom dimensions', () => {
    const icon36 = renderShipImageData('ship-military', '#FF1744', 36);
    expect(icon36.width).toBe(36);
    expect(icon36.height).toBe(36);
    expect(icon36.data.length).toBe(36 * 36 * 4);
  });
});
