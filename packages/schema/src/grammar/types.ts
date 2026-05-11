/**
 * Grammar Symbology types.
 *
 * Pipeline: fields → transform (optional) → scale → channels
 *
 * Multiple input fields are supported: a single field drives most scales;
 * multiple fields are assembled (e.g. band_r, band_g, band_b → pixel-color).
 *
 * Layers allow independent rendering pipelines on the same source (e.g. KDE
 * heatmap + raw points). Each layer has an optional preprocess transform that
 * signals the renderer to use a different layer type (HeatmapLayer, etc.).
 *
 * Inspired by the Grammar of Graphics (Wilkinson) and Vega-Lite's encoding model.
 */

// ---------------------------------------------------------------------------
// RGBA type
// ---------------------------------------------------------------------------

/** [R 0–255, G 0–255, B 0–255, A 0–1] */
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

export type ICompareOp = '>' | '<' | '>=' | '<=' | '!=';

export type IPredicate =
  | { type: 'geometryType'; value: 'Point' | 'LineString' | 'Polygon' }
  | { type: 'hasField'; field: string }
  | { type: 'fieldEquals'; field: string; value: string | number }
  | { type: 'fieldCompare'; field: string; op: ICompareOp; value: number };

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

/** Integer 0–255 sub-channels — compiler assembles these into a ['color', r, g, b, a] expression. */
export type UInt8Channel =
  | 'fill-red'
  | 'fill-green'
  | 'fill-blue'
  | 'pixel-red'
  | 'pixel-green'
  | 'pixel-blue';

/** Float 0–1 alpha sub-channels. */
export type UNormChannel = 'fill-alpha' | 'pixel-alpha';

/**
 * Virtual channels expanded at compile time.
 * pixel-rgb: colorRamp/constant → R+G+B components; pair with pixel-alpha for independent alpha.
 */
export type VirtualChannel = 'pixel-rgb';

/** Unbounded positive float channels (lengths, widths, radii). */
export type PosFloatChannel =
  | 'stroke-width'
  | 'circle-radius'
  | 'circle-stroke-width';

export type StyleChannel =
  | RGBAChannel
  | UInt8Channel
  | UNormChannel
  | PosFloatChannel
  | VirtualChannel;

// ---------------------------------------------------------------------------
// Transforms — render-side preprocessing applied before encoding rules.
// The compiler inspects these to instantiate a different renderer layer type.
// Vocabulary is renderer-agnostic; unsupported transforms are skipped with a warning.
// ---------------------------------------------------------------------------

/**
 * kde: Kernel Density Estimation.
 * Signals the renderer to produce a scalar density raster (HeatmapLayer in OL).
 * The density output is addressed as the pseudo-field '$density' in encoding rules.
 * weightField optionally scales per-point contribution before rasterization.
 */
export interface IKDETransform {
  type: 'kde';
  radius: number;
  blur: number;
  weightField?: string;
}

/**
 * cluster: Aggregate nearby points into cluster centroids.
 * Signals the renderer to use a cluster source (OL Cluster, Maplibre cluster).
 */
export interface IClusterTransform {
  type: 'cluster';
  radius: number;
}

export type ITransform = IKDETransform | IClusterTransform;

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
  params: {
    name: string;
    /** Explicit [min, max] range. When omitted, the compiler uses data min/max from featureValues. */
    domain?: [number, number];
    nShades: number;
    mode: ClassificationMode;
    reverse: boolean;
    fallback: RGBA;
    colorStops?: Array<{ stop: number; color: RGBA }>;
  };
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
  params: {
    colorRamp: string;
    nShades?: number;
    reverse?: boolean;
    fallback: RGBA;
    colorStops?: Array<{ stop: string | number; color: RGBA }>;
  };
}

/**
 * scalar: Quantitative → uint8 | unorm | posfloat
 * Maps a numeric field to a numeric output (radius, width, sub-channel value).
 * The output type is inferred from the target channel name at compile time.
 */
export interface IScalarScale {
  scheme: 'scalar';
  params: {
    domain: [number, number];
    range: [number, number];
    mode: ClassificationMode;
    nStops: number;
    fallback: number;
    scalarStops?: Array<{ stop: number; output: number }>;
  };
}

/**
 * constant_rgba: any → RGBA
 * Outputs a fixed color regardless of feature data. No field needed.
 */
export interface IConstantRGBAScale {
  scheme: 'constant_rgba';
  params: { value: RGBA };
}

/**
 * constant_num: any → posfloat
 * Outputs a fixed number regardless of feature data. No field needed.
 */
export interface IConstantNumScale {
  scheme: 'constant_num';
  params: { value: number };
}

/**
 * identity: a → a
 * Passes the field value through unchanged as the channel value.
 */
export interface IIdentityScale {
  scheme: 'identity';
}

/**
 * expression: expr → any   [NOT YET IMPLEMENTED — reserved for future PR]
 * Evaluates a Vega-Lite-style expression against one or more input fields.
 * Example: "datum.field1 + datum.field2", "log(datum.population)"
 * Compiled to OL/Maplibre expression syntax by the renderer compiler.
 */
export interface IExpressionScale {
  scheme: 'expression';
  params: {
    expr: string;
    fallback: number | RGBA;
  };
}

export type IScale =
  | IColorRampScale
  | ICategoricalScale
  | IScalarScale
  | IConstantRGBAScale
  | IConstantNumScale
  | IIdentityScale
  | IExpressionScale;

// ---------------------------------------------------------------------------
// Mapping — a (scale, channels) pair
// ---------------------------------------------------------------------------

/**
 * A mapping pairs a scale with one or more target channels.
 * The output type is derived from the channel names at compile time:
 *   fill-color / stroke-color / circle-* / pixel-color → rgba
 *   fill-red/green/blue / pixel-red/green/blue          → uint8
 *   fill-alpha / pixel-alpha                            → unorm
 *   stroke-width / circle-radius / circle-stroke-width  → posfloat
 */
export interface IMapping {
  scale: IScale;
  channels: [StyleChannel, ...StyleChannel[]];
}

// ---------------------------------------------------------------------------
// Encoding rule
// ---------------------------------------------------------------------------

export interface IEncodingRule {
  /**
   * Stable UUID — used as React key and for story-segment override merging.
   */
  id: string;

  /**
   * Input field name(s).
   * - Empty / absent: constant rules (no field needed).
   * - Single entry: standard field → scale mapping.
   * - Multiple entries: multi-field input (e.g. band_r, band_g, band_b assembled
   *   into pixel-color via sub-channel mappings, or summed via an expression scale).
   * For raster layers, field names refer to band names (compiled to ['band', N]).
   * The pseudo-field '$density' refers to the KDE density output of a kde transform.
   */
  fields?: string[];

  /**
   * One or more (scale, channels) pairs sharing these fields.
   * Fan-out: one field drives multiple channels via the same or different scales.
   */
  mappings: [IMapping, ...IMapping[]];

  /**
   * Guard conditions (AND-ed). If all pass for a feature the rule fires;
   * otherwise the channel falls through to the next unconditional rule for
   * that channel, or to channelZero if no such rule exists.
   */
  when?: IPredicate[];
}

// ---------------------------------------------------------------------------
// Grammar layer — one independent rendering pipeline on a source
// ---------------------------------------------------------------------------

export interface IGrammarLayer {
  /**
   * Stable UUID.
   */
  id: string;

  /**
   * Render-side transforms applied before encoding rules.
   * The compiler inspects these to instantiate the appropriate renderer layer type.
   * Unsupported transforms are skipped with a console warning.
   */
  preprocess?: ITransform[];

  /**
   * Encoding rules compiled into a flat-style object (or equivalent) for this layer.
   */
  rules: IEncodingRule[];

  /**
   * Guard conditions (AND-ed) applied to every rule in this layer.
   * If any predicate fails for a feature, the entire layer is skipped for that feature.
   */
  when?: IPredicate[];
}

// ---------------------------------------------------------------------------
// Grammar symbology state
// ---------------------------------------------------------------------------

export interface IGrammarSymbologyState {
  /**
   * Ordered list of independent rendering layers sharing the same source.
   * Each layer produces one renderer layer (VectorLayer, HeatmapLayer, etc.).
   * Layers are rendered in order (first = bottom).
   */
  layers: IGrammarLayer[];
}
