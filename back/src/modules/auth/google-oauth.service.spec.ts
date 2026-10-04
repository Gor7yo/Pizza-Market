import { sanitizeReturnTo } from './google-oauth.service';

describe('sanitizeReturnTo', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/orders/1?x=2', '/orders/1?x=2'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    [undefined, '/'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });
});
