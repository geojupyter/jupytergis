/**
 * Grammar → Vega-Lite spec compiler.
 *
 * grammarToPlotSpec(state) compiles an IGrammarSymbologyState into a
 * Vega-Lite top-level spec object suitable for rendering with vega-embed.
 *
 * Only plot-* channels are consumed; map channels (fill-color, stroke-width,
 * etc.) are silently ignored.  The plot- prefix is stripped to produce the
 * corresponding Vega-Lite encoding channel name.
 *
 * If no grammar layer contains any plot-* channel the function returns null.
 */

import { IGrammarSymbologyState, IScale } from '@jupytergis/schema';

// ---------------------------------------------------------------------------
// Minimal Vega-Lite spec types
// ---------------------------------------------------------------------------

export interface IVegaLiteFieldEncoding {
  field?: string;
  type: string;
  scale?: Record<string, unknown>;
  legend?: boolean;
  bin?: boolean;
  aggregate?: string;
}

export interface IVegaLiteValueEncoding {
  value: string | number;
}

export interface IVegaLiteSpec {
  mark: string;
  encoding: Record<string, IVegaLiteFieldEncoding | IVegaLiteValueEncoding>;
}

export interface IVegaLiteValueEncoding {
  value: string | number;
}

export type VegaLiteEncoding = IVegaLiteFieldEncoding | IVegaLiteValueEncoding;

export interface IVegaLiteSpec {
  mark: string;
  encoding: Record<string, VegaLiteEncoding>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plot channels returned in prefix-stripped form for Vega-Lite encoding keys. */
const PLOT_CHANNEL_MAP: Record<string, string> = {
  'plot-x': 'x',
  'plot-y': 'y',
  'plot-color': 'color',
};

function isPlotChannel(ch: string): ch is keyof typeof PLOT_CHANNEL_MAP {
  return ch in PLOT_CHANNEL_MAP;
}

/**
 * Convert a grammar scale to a Vega-Lite encoding entry.
 * Returns null when the scale scheme is not meaningful for the target channel.
 */
function scaleToEncoding(
  scale: IScale,
  field: string,
): IVegaLiteFieldEncoding | IVegaLiteValueEncoding | null {
  switch (scale.scheme) {
    case 'colorRamp':
      return {
        field,
        type: 'quantitative',
        scale: { scheme: scale.params.name },
        legend: true,
      };

    case 'categorical':
      return {
        field,
        type: 'nominal',
        legend: true,
      };

    case 'scalar':
      return {
        field,
        type: 'quantitative',
        scale: {
          domain: scale.params.domain,
          range: scale.params.range,
        },
      };

    case 'constant_rgba': {
      const [r, g, b, a] = scale.params.value;
      return { value: `rgba(${r},${g},${b},${a})` };
    }

    case 'constant_num':
      return { value: scale.params.value };

    case 'identity':
      return { field, type: 'quantitative' };

    default:
      return null;
  }
}

/**
 * Resolve a pseudo-field ($binned, $count) back to a Vega-Lite encoding
 * parameter that uses the original bin transform field.
 */
function resolveBinEncoding(
  binField: string,
  pseudoField: string,
  encoding: IVegaLiteFieldEncoding | IVegaLiteValueEncoding | null,
): IVegaLiteFieldEncoding | IVegaLiteValueEncoding | null {
  if (!encoding || !('field' in encoding)) {
    return encoding;
  }
  if (pseudoField === '$binned') {
    const result = { ...encoding, field: binField, bin: true };
    return result;
  }
  if (pseudoField === '$count') {
    const { field: _, ...rest } = encoding;
    return { ...rest, aggregate: 'count', type: 'quantitative' };
  }
  return encoding;
}

/**
 * Find the first bin transform in the layer's preprocess, if any.
 * Returns the original data field name.
 */
function findBinTransform(
  layer: NonNullable<IGrammarSymbologyState['layers']>[number],
): string | null {
  for (const xf of layer.preprocess ?? []) {
    if ((xf as any).type === 'bin') {
      return (xf as any).field;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a grammar symbology state into a Vega-Lite top-level spec.
 *
 * @param state  Grammar symbology state from layer parameters.
 * @param mark   Vega-Lite mark type (defaults to 'point').
 * @returns Vega-Lite spec, or null when no plot-* channels are present.
 */
export function grammarToPlotSpec(
  state: IGrammarSymbologyState | undefined,
  mark?: string,
): IVegaLiteSpec | null {
  if (!state?.layers?.length) {
    return null;
  }

  const targetEncoding: Record<
    string,
    IVegaLiteFieldEncoding | IVegaLiteValueEncoding
  > = {};
  let effectiveMark = mark ?? 'point';

  for (const layer of state.layers) {
    const binField = findBinTransform(layer);
    if (binField) {
      effectiveMark = mark ?? 'bar';
    }

    for (const rule of layer.rules) {
      for (const mapping of rule.mappings) {
        const field = rule.fields?.[0];
        if (
          !field &&
          mapping.scale.scheme !== 'constant_rgba' &&
          mapping.scale.scheme !== 'constant_num'
        ) {
          continue;
        }

        let encoded = scaleToEncoding(mapping.scale, field ?? '');

        // Resolve $binned / $count pseudo-fields from bin transform.
        if (binField && field && encoded) {
          encoded = resolveBinEncoding(binField, field, encoded);
        }

        for (const ch of mapping.channels) {
          if (!isPlotChannel(ch)) {
            continue;
          }
          const vlChannel = PLOT_CHANNEL_MAP[ch];
          if (vlChannel === 'color' && encoded) {
            targetEncoding.color = encoded;
          } else if (vlChannel !== 'color' && encoded) {
            targetEncoding[vlChannel] = encoded;
          }
        }
      }
    }
  }

  if (Object.keys(targetEncoding).length === 0) {
    return null;
  }

  return {
    mark: effectiveMark,
    encoding: targetEncoding,
  };
}

// ---------------------------------------------------------------------------
// Convenience entry point
// ---------------------------------------------------------------------------

/**
 * Convenience entry point that compiles the spec and delegates data
 * transformation (e.g. binning) to Vega-Lite natively via encoding.
 */
export interface IPlotCompileResult {
  spec: IVegaLiteSpec;
  data: Record<string, unknown>[];
}

export function compilePlot(
  state: IGrammarSymbologyState | undefined,
  data: Record<string, unknown>[],
  mark?: string,
): IPlotCompileResult | null {
  const spec = grammarToPlotSpec(state, mark);
  if (!spec) {
    return null;
  }
  return { spec, data };
}
