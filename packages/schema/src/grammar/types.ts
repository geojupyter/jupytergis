/**
 * Grammar Symbology types.
 *
 * A rule maps one optional input field to one or more (scale, channels) pairs,
 * optionally guarded by predicates. This models the typed functional composition:
 *
 *   Field(input) → Scale(input → output) → [Channel(output)]
 *
 * Multiple (scale, channels) pairs share one field to avoid repetition (fan-out).
 * Branch-in (multiple fields → one output) is not supported by design.
 *
 * Inspired by the Grammar of Graphics (Wilkinson) and Vega-Lite's encoding model.
 */

// ---------------------------------------------------------------------------
// RGBA type
// ---------------------------------------------------------------------------

/** [R 0–255, G 0–255, B 0–255, A 0–1] — matches OL expression array convention. */
export type RGBA = [number, number, number, number];

// ---------------------------------------------------------------------------
// Classification modes
// ---------------------------------------------------------------------------

export type ClassificationMode =
  | 'equal interval'
  | 'quantile'
  | 'jenks'
  | 'pretty'
  | 'logarithmic';

// ---------------------------------------------------------------------------
// Predicates — composable guards on rules
// ---------------------------------------------------------------------------

export type IPredicate =
  | { type: 'geometryType'; value: 'Point' | 'LineString' | 'Polygon' }
  | { type: 'hasField'; field: string }
  | { type: 'fieldEquals'; field: string; value: string | number };

// ---------------------------------------------------------------------------
// Output types — what a scale produces
// ---------------------------------------------------------------------------

/**
 * rgba:     full RGBA color [R 0–255, G 0–255, B 0–255, A 0–1]
 * uint8:    integer 0–255 (RGB sub-channels, composited into a color by compiler)
 * unorm:    float 0–1     (alpha sub-channel)
 * posfloat: float 0–∞    (stroke-width, radius — unbounded positive)
 */
export type OutputType = 'rgba' | 'uint8' | 'unorm' | 'posfloat';

// ---------------------------------------------------------------------------
// Channels — named output slots, grouped by accepted output type
// ---------------------------------------------------------------------------

/** Full RGBA color channels. Vector layers use fill/stroke/circle channels; pixel channels for raster/KDE. */
export type RGBAChannel =
  | 'fill-color'
  | 'stroke-color'
  | 'circle-fill-color'
  | 'circle-stroke-color'
  | 'pixel-color';

/** Integer 0–255 sub-channels — compiler assembles these into a ['array', r, g, b, a] expression. */
export type UInt8Channel =
  | 'fill-red'
  | 'fill-green'
  | 'fill-blue'
  | 'pixel-red'
  | 'pixel-green'
  | 'pixel-blue';

/** Float 0–1 alpha sub-channels. */
export type UNormChannel = 'fill-alpha' | 'pixel-alpha';

/** Unbounded positive float channels (lengths, widths, radii). */
export type PosFloatChannel =
  | 'stroke-width'
  | 'circle-radius'
  | 'circle-stroke-width';

export type OLStyleChannel =
  | RGBAChannel
  | UInt8Channel
  | UNormChannel
  | PosFloatChannel;

// ---------------------------------------------------------------------------
// Scale constructors — each is a constructor applied to a params record.
// The scale's scheme determines both the input field type and output type.
// ---------------------------------------------------------------------------

/**
 * colorRamp: Quantitative → RGBA
 * Maps a numeric field through a named color palette.
 */
export interface IColorRampScale {
  scheme: 'colorRamp';
  name: string;
  /** Explicit [min, max] range. When omitted, the compiler uses data min/max from featureValues. */
  domain?: [number, number];
  nShades: number;
  mode: ClassificationMode;
  reverse: boolean;
  fallback: RGBA;
  colorStops?: Array<{ stop: number; color: RGBA }>;
}

/**
 * categorical: Nominal → RGBA
 * Maps discrete field values to colors sampled from a named palette.
 * The compiler enumerates unique values from featureValues at render time —
 * same algorithm as the Categorized render type.
 * Explicit colorStops (user overrides) take precedence over computed stops.
 */
export interface ICategoricalScale {
  scheme: 'categorical';
  colorRamp: string;
  nShades?: number;
  reverse?: boolean;
  fallback: RGBA;
  colorStops?: Array<{ stop: string | number; color: RGBA }>;
}

/**
 * scalar: Quantitative → uint8 | unorm | posfloat
 * Maps a numeric field to a numeric output (radius, width, sub-channel value).
 * The target outputType on IMapping determines how the output is interpreted.
 */
export interface IScalarScale {
  scheme: 'scalar';
  domain: [number, number];
  range: [number, number];
  mode: ClassificationMode;
  nStops: number;
  fallback: number;
  scalarStops?: Array<{ stop: number; output: number }>;
}

/**
 * kde: Quantitative → RGBA  (Kernel Density Estimation)
 * Maps a per-feature weight field through a density surface to a pixel color.
 * Compiler routes this to an OL HeatmapLayer; field is the optional weight attribute.
 * Must target pixel-color channel.
 */
export interface IKDEScale {
  scheme: 'kde';
  radius: number;
  blur: number;
  colorRamp: string;
  fallback: RGBA;
}

/**
 * constant: any → any
 * Outputs a fixed value regardless of feature data. No field needed.
 */
export interface IConstantScale {
  scheme: 'constant';
  value: RGBA | number;
}

/**
 * identity: a → a
 * Passes the field value through unchanged as the channel value.
 */
export interface IIdentityScale {
  scheme: 'identity';
}

export type IScale =
  | IColorRampScale
  | ICategoricalScale
  | IScalarScale
  | IKDEScale
  | IConstantScale
  | IIdentityScale;

// ---------------------------------------------------------------------------
// Mapping — a (scale, channels) pair with consistent output type
// ---------------------------------------------------------------------------

/**
 * A mapping pairs a scale with one or more target channels of matching output type.
 * The outputType discriminant lets the compiler route correctly without inspecting
 * the scale's value type at runtime.
 *
 * Type invariant (enforced by discriminated union):
 *   outputType 'rgba'     → scale produces RGBA   → channels accept RGBA
 *   outputType 'uint8'    → scale produces 0–255  → channels accept UInt8
 *   outputType 'unorm'    → scale produces 0–1    → channels accept UNorm
 *   outputType 'posfloat' → scale produces 0–∞   → channels accept PosFloat
 */
export type IMapping =
  | {
      outputType: 'rgba';
      scale: IColorRampScale | ICategoricalScale | IKDEScale | IConstantScale;
      channels: [RGBAChannel, ...RGBAChannel[]];
    }
  | {
      outputType: 'uint8';
      scale: IScalarScale | IConstantScale | IIdentityScale;
      channels: [UInt8Channel, ...UInt8Channel[]];
    }
  | {
      outputType: 'unorm';
      scale: IScalarScale | IConstantScale | IIdentityScale;
      channels: [UNormChannel, ...UNormChannel[]];
    }
  | {
      outputType: 'posfloat';
      scale: IScalarScale | IConstantScale | IIdentityScale;
      channels: [PosFloatChannel, ...PosFloatChannel[]];
    };

// ---------------------------------------------------------------------------
// Encoding rule
// ---------------------------------------------------------------------------

export interface IEncodingRule {
  /**
   * Stable UUID — used as React key and for story-segment override merging.
   */
  id: string;

  /**
   * Input: feature attribute name.
   * Optional for constant rules (no field needed).
   * For raster layers, refers to a band name (compiled to ['band', N]).
   */
  field?: string;

  /**
   * One or more (scale, channels) pairs sharing this field.
   * Fan-out: one field drives multiple channels via the same or different scales.
   * Branch-in (multiple fields → one channel) is not supported.
   */
  mappings: [IMapping, ...IMapping[]];

  /**
   * Guard conditions (AND-ed). If all pass for a feature the rule fires;
   * otherwise each channel falls back to its scale's fallback value.
   */
  when?: IPredicate[];
}

// ---------------------------------------------------------------------------
// Grammar symbology state
// ---------------------------------------------------------------------------

export interface IGrammarSymbologyState {
  renderType: 'Grammar';
  /**
   * Ordered list of encoding rules. Rules are compiled in order;
   * conditional rules form branches in a case expression per channel.
   */
  rules: IEncodingRule[];
}
