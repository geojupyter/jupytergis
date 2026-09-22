import { IScale, RGBA } from '@jupytergis/schema';

import {
  COLOR_RAMP_DEFAULTS,
  ColorRampName,
} from '@/src/features/layers/symbology/colorRampUtils';
import { computeGraduatedColorStops } from '@/src/features/layers/symbology/styleBuilder';

/**
 * Fitting a scale to the data it reads.
 *
 * colorMap and scalar scales are created with a placeholder domain ([0, 1] and
 * [0, 100]). Left alone, every value above it clamps to the top of the ramp,
 * which renders as one colour or one size across the whole layer. These
 * helpers put the domain, and the stops that are compiled in preference to it,
 * back on the range the field actually covers.
 */

export function numericValuesFor(
  field: string | undefined,
  featureValues: Record<string, Set<any>>,
): number[] {
  if (!field) {
    return [];
  }
  return Array.from(featureValues[field] ?? []).filter((v): v is number =>
    Number.isFinite(v),
  );
}

/** True while the scale still carries the domain it was created with. */
export function hasPlaceholderDomain(scale: IScale): boolean {
  if (scale.scheme === 'colorMap') {
    const d = scale.params.domain;
    return !d || (d[0] === 0 && d[1] === 1);
  }
  if (scale.scheme === 'scalar') {
    const d = scale.params.domain;
    return !d || (d[0] === 0 && d[1] === 100);
  }
  return false;
}

/**
 * Refit a scale to `values`, or return it unchanged when it has no domain or
 * the values cannot define one.
 */
export function withDataDomain(scale: IScale, values: number[]): IScale {
  if (values.length === 0) {
    return scale;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return scale;
  }

  if (scale.scheme === 'colorMap') {
    const { params } = scale;
    const minRequired = COLOR_RAMP_DEFAULTS[params.name as ColorRampName];
    const nClasses = minRequired
      ? Math.max(params.nShades ?? minRequired, minRequired)
      : params.nShades;
    const computed = computeGraduatedColorStops(
      {
        renderType: 'Graduated',
        nClasses,
        mode: params.mode as any,
        colorRamp: params.name,
        reverseRamp: params.reverse,
        vmin: min,
        vmax: max,
      } as any,
      values,
    );
    return {
      ...scale,
      params: {
        ...params,
        domain: [min, max],
        colorStops: computed.map(s => ({
          stop: s.value as number,
          color: s.color as RGBA,
        })),
      },
    };
  }

  if (scale.scheme === 'scalar') {
    const { params } = scale;
    const [outMin, outMax] = params.range;
    return {
      ...scale,
      params: {
        ...params,
        domain: [min, max],
        scalarStops: [
          { stop: min, output: outMin },
          { stop: max, output: outMax },
        ],
      },
    };
  }

  return scale;
}
