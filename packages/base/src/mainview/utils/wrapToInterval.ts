/**
 * Wrap `value` into (`min`, `max`], matching MapLibre's longitude wrap.
 *
 * Used so geographic longitudes stay in (-180, 180] after the view pans
 * past the antimeridian.
 */
export function wrapToInterval(
  value: number,
  min: number,
  max: number,
): number {
  const range = max - min;
  const wrapped = ((((value - min) % range) + range) % range) + min;
  return wrapped === min ? max : wrapped;
}
