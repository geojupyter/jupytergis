/**
 * Format a number for display, choosing a precision that suits its magnitude.
 *
 * Degrees need several decimals to be meaningful; projected coordinates in
 * metres do not, and showing six of them just adds noise.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  const decimals = Math.abs(value) < 400 ? 6 : 2;

  return Number(value.toFixed(decimals)).toString();
}

/**
 * Format an extent as `minX, minY, maxX, maxY`.
 */
export function formatExtent(extent?: number[]): string | undefined {
  if (!extent || extent.length < 4) {
    return undefined;
  }

  return extent.slice(0, 4).map(formatNumber).join(', ');
}

/**
 * Format a value range, tolerating a missing half.
 */
export function formatRange(
  minimum?: number,
  maximum?: number,
): string | undefined {
  if (minimum === undefined && maximum === undefined) {
    return undefined;
  }

  const low = minimum === undefined ? '—' : formatNumber(minimum);
  const high = maximum === undefined ? '—' : formatNumber(maximum);

  return `${low} – ${high}`;
}
