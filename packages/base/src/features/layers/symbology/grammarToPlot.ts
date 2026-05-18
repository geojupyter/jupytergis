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
  field: string;
  type: string;
  scale?: Record<string, unknown>;
  legend?: boolean;
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
  mark = 'point',
): IVegaLiteSpec | null {
  if (!state?.layers?.length) {
    return null;
  }

  // Collect all plot-channel encodings across all layers and rules.
  // Last rule wins when the same Vega-Lite channel is targeted multiple times.
  const targetEncoding: Record<string, VegaLiteEncoding> = {};

  for (const layer of state.layers) {
    for (const rule of layer.rules) {
      for (const mapping of rule.mappings) {
        // Only process the first field for single-field rules.
        const field = rule.fields?.[0];
        if (
          !field &&
          mapping.scale.scheme !== 'constant_rgba' &&
          mapping.scale.scheme !== 'constant_num'
        ) {
          continue;
        }

        const encoded = scaleToEncoding(mapping.scale, field ?? '');

        for (const ch of mapping.channels) {
          if (!isPlotChannel(ch)) {
            continue;
          }
          const vlChannel = PLOT_CHANNEL_MAP[ch];
          // Only set color encoding for color-producing scales.
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
    mark,
    encoding: targetEncoding,
  };
}
