/**
 * Grammar Symbology types.
 *
 * An IEncodingRule maps one feature attribute (field) to one OL style channel
 * via a scale, optionally guarded by a list of predicates (when).
 *
 * Composition model (inspired by functional programming):
 *
 *   rule  = encode(field, scale) | constant(value)
 *   guard = when(predicates[], rule)          -- predicates are AND-ed
 *
 * The compiler emits:
 *   no conditions  → scale expression directly
 *   with conditions → ['case', ['all', ...conditions], scaleExpr, channelFallback]
 */

export type ClassificationMode =
  | 'quantile'
  | 'equal interval'
  | 'jenks'
  | 'pretty'
  | 'logarithmic';

// ---------------------------------------------------------------------------
// Predicates — composable guards on rules
// ---------------------------------------------------------------------------

export type IPredicate =
  | { type: 'geometryType'; value: 'point' | 'line' | 'polygon' }
  | { type: 'hasField'; field: string }
  | { type: 'fieldEquals'; field: string; value: string | number };

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** OL FlatStyle properties that Grammar rules may target. */
export type OLStyleChannel =
  | 'fill-color'
  | 'stroke-color'
  | 'stroke-width'
  | 'circle-fill-color'
  | 'circle-stroke-color'
  | 'circle-stroke-width'
  | 'circle-radius';

/**
 * The semantic type of the input field.
 * Optional: if absent, the compiler infers it from the scale scheme
 * (colorRamp/scalar → quantitative; categorical → nominal).
 * Can be set explicitly to treat e.g. a numeric ID as nominal.
 */
export type FieldType = 'quantitative' | 'ordinal' | 'nominal';

// ---------------------------------------------------------------------------
// Scales — explicit defaults, no implicit fallbacks in the compiler
// ---------------------------------------------------------------------------

/**
 * colorRamp: number → RGBA color via a named palette.
 * All fields have explicit defaults; nothing is left implicit.
 */
export interface IColorRampScale {
  scheme: 'colorRamp';
  name: string;            // default: 'viridis'
  domain: [number, number]; // always explicit; set from data on rule creation
  nShades: number;         // default: 9
  mode: ClassificationMode; // default: 'equal interval'
  reverse: boolean;        // default: false
  fallback: [number, number, number, number]; // default: [0,0,0,0]
  colorStops?: Array<{ stop: number; color: [number, number, number, number] }>;
}

/**
 * categorical: any field value → explicit color or number mapping.
 */
export interface ICategoricalScale {
  scheme: 'categorical';
  mapping: Record<string, string>; // value → hex/rgba color string
  fallback: string;                // default: 'rgba(0,0,0,0)'
}

/**
 * scalar: number → number (e.g. circle-radius, stroke-width).
 * Supports the same classification modes as colorRamp.
 */
export interface IScalarScale {
  scheme: 'scalar';
  domain: [number, number]; // always explicit; set from data on rule creation
  range: [number, number];  // output range in channel units (e.g. px)
  mode: ClassificationMode; // default: 'equal interval'
  fallback: number;         // default: 0
  scalarStops?: Array<{ stop: number; output: number }>;
}

/**
 * constant: always outputs the same value regardless of feature data.
 * No field input needed.
 */
export interface IConstantScale {
  scheme: 'constant';
  value: any; // literal channel value (color array, hex string, or number)
}

/**
 * identity: field value used directly as the channel value.
 */
export interface IIdentityScale {
  scheme: 'identity';
}

export type IScale =
  | IColorRampScale
  | ICategoricalScale
  | IScalarScale
  | IConstantScale
  | IIdentityScale;

// ---------------------------------------------------------------------------
// Encoding rule
// ---------------------------------------------------------------------------

export interface IEncodingRule {
  /**
   * Stable UUID (UUID.uuid4() from @lumino/coreutils).
   * Used as React key and for story-segment override merging.
   */
  id: string;

  /**
   * Input: feature attribute name.
   * Optional for constant rules (which need no field input).
   */
  field?: string;

  /** Output: which OL style property this rule drives. */
  channel: OLStyleChannel;

  /** Optional explicit field type. Inferred from scale scheme if absent. */
  type?: FieldType;

  /**
   * Guard conditions (AND-ed). If all pass for a feature, the rule applies;
   * otherwise the channel falls back to its baseStyle value.
   * Replaces the old single geometryFilter field.
   */
  when?: IPredicate[];

  scale: IScale;
}

// ---------------------------------------------------------------------------
// Grammar symbology state
// ---------------------------------------------------------------------------

export interface IGrammarSymbologyState {
  renderType: 'Grammar';
  /** Ordered list of encoding rules. Compiled in order; last rule wins on channel conflicts. */
  rules: IEncodingRule[];
  /**
   * Fallback OL FlatStyle for channels not covered by any rule.
   * Optional: defaults to {} at runtime. Not persisted to avoid schema conflicts.
   */
  baseStyle?: Record<string, any>;
}
