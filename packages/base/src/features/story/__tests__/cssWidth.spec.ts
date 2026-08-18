import {
  isCssWidthFull,
  resolveCssWidth,
} from '@/src/features/story/utils/cssWidth';

describe('resolveCssWidth', () => {
  it('returns undefined when unset or invalid', () => {
    expect(resolveCssWidth(undefined)).toBeUndefined();
    expect(resolveCssWidth('')).toBeUndefined();
    expect(resolveCssWidth('0%')).toBeUndefined();
    expect(resolveCssWidth('150%')).toBeUndefined();
    expect(resolveCssWidth('0px')).toBeUndefined();
  });

  it('normalizes supported units', () => {
    expect(resolveCssWidth('25%')).toBe('25%');
    expect(resolveCssWidth(' 50% ')).toBe('50%');
    expect(resolveCssWidth('24rem')).toBe('24rem');
    expect(resolveCssWidth('320px')).toBe('320px');
    expect(resolveCssWidth('50ch')).toBe('50ch');
  });
});

describe('isCssWidthFull', () => {
  it('treats unset as the overlay default of 100%', () => {
    expect(isCssWidthFull(undefined)).toBe(true);
    expect(isCssWidthFull('100%')).toBe(true);
    expect(isCssWidthFull('50ch')).toBe(false);
  });
});
