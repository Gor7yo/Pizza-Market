import { describe, expect, it } from 'vitest';
import { canTransition, getAllowedTransitions, getTrackingSteps } from './order-status';

describe('order status transitions', () => {
  it('follows the happy path for delivery', () => {
    const path = getTrackingSteps('DELIVERY');
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!, 'DELIVERY')).toBe(true);
    }
  });

  it('skips OUT_FOR_DELIVERY for pickup', () => {
    expect(canTransition('READY', 'OUT_FOR_DELIVERY', 'PICKUP')).toBe(false);
    expect(canTransition('READY', 'DELIVERED', 'PICKUP')).toBe(true);
    expect(canTransition('READY', 'DELIVERED', 'DELIVERY')).toBe(false);
  });

  it('rejects skipping steps and leaving final states', () => {
    expect(canTransition('PENDING', 'PREPARING', 'DELIVERY')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED', 'DELIVERY')).toBe(false);
    expect(getAllowedTransitions('CANCELLED', 'DELIVERY')).toEqual([]);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'DELIVERY')).toBe(false);
  });
});
