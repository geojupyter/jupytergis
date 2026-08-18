export const CSS_WIDTH_UNITS = ['ch', '%', 'rem', 'px', 'em', 'vw'] as const;

export type CssWidthUnit = (typeof CSS_WIDTH_UNITS)[number];

export const DEFAULT_OVERLAY_CONTENT_WIDTH = '100%';
export const DEFAULT_MAP_PANEL_WIDTH = '25%';

export const CSS_WIDTH_PRESETS = [
  { id: 'narrow', label: 'Narrow', value: '50ch' },
  { id: 'comfort', label: 'Comfort', value: '75ch' },
  { id: 'wide', label: 'Wide', value: '100ch' },
  { id: 'full', label: 'Full', value: '100%' },
] as const;

export const MAP_PANEL_WIDTH_PRESETS = [
  { id: 'quarter', label: '25%', value: '25%' },
  { id: 'half', label: '50%', value: '50%' },
  { id: 'three-quarters', label: '75%', value: '75%' },
  { id: 'full', label: '100%', value: '100%' },
] as const;

const CSS_WIDTH_PATTERN = /^(\d*\.?\d+)\s*(ch|%|rem|px|em|vw)$/i;

export function parseCssWidth(
  width: string | undefined,
): { amount: string; unit: CssWidthUnit } | null {
  const match = width ? CSS_WIDTH_PATTERN.exec(width.trim()) : null;
  if (!match) {
    return null;
  }

  return {
    amount: match[1],
    unit: match[2].toLowerCase() as CssWidthUnit,
  };
}

function isValidCssWidthAmount(amount: number, unit: CssWidthUnit): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  return unit !== '%' || amount <= 100;
}

/** Normalize a stored width, or undefined when unset/invalid. */
export function resolveCssWidth(width: string | undefined): string | undefined {
  const parsed = parseCssWidth(width);
  if (!parsed || !isValidCssWidthAmount(Number(parsed.amount), parsed.unit)) {
    return undefined;
  }

  return `${parsed.amount}${parsed.unit}`;
}

export function validateCssWidth(amount: string, unit: string): string | null {
  if (!CSS_WIDTH_UNITS.includes(unit as CssWidthUnit)) {
    return 'Unsupported unit';
  }

  if (!isValidCssWidthAmount(Number(amount), unit as CssWidthUnit)) {
    return unit === '%'
      ? 'Enter a value between 1 and 100'
      : 'Enter a value greater than 0';
  }

  return null;
}

/** Markdown overlay is full when stored width is 100%. */
export function isMarkdownOverlayWidthFull(
  width: string | undefined,
): boolean {
  return resolveCssWidth(width) === '100%';
}
