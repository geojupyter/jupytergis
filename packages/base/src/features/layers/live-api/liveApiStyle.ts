import type { ILiveApiSource, IJGISSource } from '@jupytergis/schema';
import { FlatStyle, Rule } from 'ol/style/flat';

import { DEFAULT_FLAT_STYLE } from '../symbology/styleBuilder';

export const LIVE_API_ROLE_PROP = 'jgisLiveApiRole';

/**
 * Icon pixel size ≈ circle diameter from symbology (10 × radius).
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

export function liveApiIconUrlFromSource(
  source: IJGISSource | undefined,
): string | undefined {
  if (source?.type !== 'LiveApiSource') {
    return undefined;
  }
  const iconUrl = (source.parameters as ILiveApiSource).iconUrl?.trim();

  return iconUrl || undefined;
}

/** Normalize getStyle() output into flat style rules. */
export function normalizeFlatStyleRules(
  style: FlatStyle | Rule[] | FlatStyle[] | null | undefined,
): Rule[] {
  if (!style) {
    return [{ style: DEFAULT_FLAT_STYLE }];
  }

  if (Array.isArray(style)) {
    if (style.length === 0) {
      return [{ style: DEFAULT_FLAT_STYLE }];
    }

    const first = style[0] as Rule | FlatStyle;
    if (first && typeof first === 'object' && 'style' in first) {
      return style as Rule[];
    }
    return (style as FlatStyle[]).map(flat => ({ style: flat }));
  }

  return [{ style }];
}

/** Drop previously injected Live API icon overlay rules (by role filter). */
export function stripLiveApiStyleRules(rules: Rule[]): Rule[] {
  const stripped = rules.filter(rule => {
    const filter = rule.filter;
    if (!Array.isArray(filter)) {
      return true;
    }

    return !JSON.stringify(filter).includes(LIVE_API_ROLE_PROP);
  });

  return stripped;
}
