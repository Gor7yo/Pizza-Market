import { diffChanges, sanitizeAuditMetadata } from './audit.service';

describe('audit helpers', () => {
  it('redacts credential-like keys at any depth', () => {
    expect(
      sanitizeAuditMetadata({
        email: 'a@b.c',
        password: 'x',
        nested: { refreshToken: 'y', ok: 1 },
      }),
    ).toEqual({
      email: 'a@b.c',
      password: '[redacted]',
      nested: { refreshToken: '[redacted]', ok: 1 },
    });
  });

  it('diffs changed fields only', () => {
    expect(diffChanges({ basePrice: 4500, slug: 'a' }, { basePrice: 5000, slug: 'a' })).toEqual({
      basePrice: { from: 4500, to: 5000 },
    });
  });
});
