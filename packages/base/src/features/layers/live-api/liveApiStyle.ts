import { Rule } from 'ol/style/flat';

import { DEFAULT_FLAT_STYLE } from '../symbology/styleBuilder';

export const LIVE_API_ROLE_PROP = 'jgisLiveApiRole';

/**
 * Icon pixel size = 10 × radius from symbology
 * Falls back to the default flat-style circle radius when symbology
 * uses an expression or omits circle-radius.
 */
export function iconSizeFromRules(rules: Rule[]): number {
  const defaultRadius = DEFAULT_FLAT_STYLE['circle-radius'];
  const fallback =
    typeof defaultRadius === 'number' && defaultRadius > 0 ? defaultRadius : 5;

  for (const rule of rules) {
    const style = rule.style;
    if (!style || Array.isArray(style)) {
      continue;
    }

    const radius = style['circle-radius'];
    if (typeof radius === 'number' && radius > 0) {
      return radius * 10;
    }
  }

  return fallback * 10;
}

/**
 * Load an icon image and return the scale that fits it in `targetPx`.
 */
export function loadLiveApiIconScale(
  iconUrl: string,
  targetPx: number,
): Promise<number> {
  const scalePromise = new Promise<number>(resolve => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width || 1;
      const height = image.naturalHeight || image.height || 1;
      const scale = targetPx / Math.max(width, height);

      resolve(scale > 0 ? scale : 1);
    };

    image.onerror = () => {
      resolve(1);
    };

    image.src = iconUrl;
  });

  return scalePromise;
}
