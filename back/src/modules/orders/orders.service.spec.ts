import { stableStringify } from './orders.service';

describe('stableStringify', () => {
  it('is independent of key order and ignores undefined', () => {
    expect(stableStringify({ b: 1, a: { d: [1, 2], c: undefined } })).toBe(
      stableStringify({ a: { d: [1, 2] }, b: 1 }),
    );
  });

  it('distinguishes different payloads', () => {
    expect(stableStringify({ items: [1] })).not.toBe(stableStringify({ items: [2] }));
  });
});
