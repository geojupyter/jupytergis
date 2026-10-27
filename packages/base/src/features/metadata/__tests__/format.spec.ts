import { formatNumber, formatRange } from '../utils/format';

describe('formatNumber', () => {
  it('leaves integers alone', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-12)).toBe('-12');
  });

  it('keeps enough precision for degrees', () => {
    expect(formatNumber(-73.987654321)).toBe('-73.987654');
  });

  it('does not clutter large projected coordinates with decimals', () => {
    expect(formatNumber(500123.456789)).toBe('500123.46');
  });

  it('drops trailing zeros', () => {
    expect(formatNumber(1.5)).toBe('1.5');
  });

  it('handles values that are not numbers', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
  });
});

describe('formatRange', () => {
  it('renders both ends', () => {
    expect(formatRange(0, 255)).toBe('0 – 255');
  });

  it('tolerates a missing end', () => {
    expect(formatRange(0, undefined)).toBe('0 – —');
    expect(formatRange(undefined, 255)).toBe('— – 255');
  });

  it('returns undefined when there is no range at all', () => {
    expect(formatRange(undefined, undefined)).toBeUndefined();
  });
});
