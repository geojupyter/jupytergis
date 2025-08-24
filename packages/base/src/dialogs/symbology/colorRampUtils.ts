/**
 * Convert an [r,g,b] array to hex string.
 */
export function rgbToHex(rgb: number[]): string {
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Convert hex to rgba string.
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Ensure we always get a valid hex string from either an array or string.
 */
export const ensureHexColorCode = (color: number[] | string): string => {
  if (typeof color === 'string') {
    return color;
  }

  if (!Array.isArray(color)) {
    return '#000000'; // Default to black
  }

  // color must be an RGBA array
  const hex = color
    .slice(0, -1) // Color input doesn't support hex alpha values so cut that out
    .map((val: { toString: (arg0: number) => string }) => {
      return val.toString(16).padStart(2, '0');
    })
    .join('');

  return '#' + hex;
};

/**
 * Convert hex to [r,g,b,a] array.
 */
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result) {
    console.warn('Unable to parse hex value, defaulting to black');
    return [parseInt('0', 16), parseInt('0', 16), parseInt('0', 16)];
  }
  const rgbValues = [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    1, // TODO: Make alpha customizable?
  ];

  return rgbValues;
}
