import { parsePositiveInt } from './parsePositiveInt';

describe('parsePositiveInt', () => {
  it('returns the default when value is undefined, null or empty', () => {
    expect(parsePositiveInt(undefined, 42)).toBe(42);
    expect(parsePositiveInt('', 42)).toBe(42);
    expect(parsePositiveInt('   ', 42)).toBe(42);
  });

  it('returns the default for non-numeric values', () => {
    expect(parsePositiveInt('not-a-number', 42)).toBe(42);
  });

  it('returns the default for zero or negative values', () => {
    expect(parsePositiveInt('0', 42)).toBe(42);
    expect(parsePositiveInt('-5', 42)).toBe(42);
  });

  it('parses valid positive integers', () => {
    expect(parsePositiveInt('10', 42)).toBe(10);
    expect(parsePositiveInt('1', 42)).toBe(1);
  });
});
