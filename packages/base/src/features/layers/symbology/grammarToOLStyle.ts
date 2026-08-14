/**
 * Grammar → OL FlatStyle compiler.
 *
 * grammarToOLStyle(state) compiles an IGrammarSymbologyState into an OL
 * FlatStyle object ready to be applied to a VectorLayer or VectorTileLayer.
 *
 * Compilation steps:
 *   1. Expand rules into per-encoding entries (guard + expression).
 *   2. Build a case expression per encoding (conditional entries first,
 *      last unconditional entry as the else branch).
 *   3. Assemble sub-encodings (fill-red/green/blue/alpha) into a composite
 *      fill-color ['array', r, g, b, a] expression.
 */

import {
  ICategoricalScale,
  IColorMapScale,
  IMapping,
  IScalarScale,
  IGrammarSymbologyState,
  IPredicate,
  Encoding,
  UInt8Encoding,
  UNormEncoding,
} from '@jupytergis/schema';
import { ExpressionValue } from 'ol/expr/expression';
import { py2vega } from 'py2vega-ts';
import { vega2ol } from 'vega2ol';

import {
  resolveCategoricalStops,
  resolveColorMapStops,
  resolveScalarStops,
} from './resolveStops';
import { STOP_NULL, STOP_UNDEFINED } from './styleBuilder';

// '$density' is the pseudo-field produced by a kde transform (KDE density raster).
// Encoding rules referencing it are compiled only when a kde transform is present;
// the actual OL HeatmapLayer instantiation happens outside this compiler.
export const DENSITY_FIELD = '$density';

// ---------------------------------------------------------------------------
// Field expression helpers
// ---------------------------------------------------------------------------

/**
 * Convert a field name to an OL expression.
 * $band-N (raster pseudo-fields) → ['band', N]
 * everything else → ['get', field]
 */
function fieldExpr(field: string): ExpressionValue {
  const m = field.match(/^\$band-(\d+)$/);
  if (m) {
    return ['band', parseInt(m[1], 10)] as ExpressionValue;
  }
  return ['get', field];
}

/** Band pseudo-fields always exist; vector feature properties may not. */
function fieldAlwaysPresent(field: string): boolean {
  return /^\$band-\d+$/.test(field) || field === DENSITY_FIELD;
}

// ---------------------------------------------------------------------------
// Types used internally during compilation
// ---------------------------------------------------------------------------

interface IEncodingEntry {
  guard?: ExpressionValue; // undefined = unconditional
  expr: ExpressionValue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Values available to classify a rule against, either as one column per field
 * or as a single column applied to every field.
 *
 * The flat form is a convenience for states that classify on one field; a state
 * with rules on different fields must pass the keyed form, or every rule is
 * classified against the same column.
 */
export type FeatureValues = unknown[] | Record<string, unknown[]>;

/** Pick the column a rule classifies against. */
function columnFor(featureValues: FeatureValues, field?: string): unknown[] {
  if (Array.isArray(featureValues)) {
    return featureValues;
  }
  return (field && featureValues[field]) || [];
}

/**
 * Compile a Grammar symbology state to an OL FlatStyle object.
 * Sub-encodings (fill-red/green/blue/alpha) are assembled into fill-color.
 *
 * @param featureValues  Feature attribute values for the rule field(s).
 *   Required for categorical and colorRamp scales so the compiler can
 *   enumerate unique values / compute classification breaks at render time,
 *   mirroring how buildVectorFlatStyle works.
 */
export function grammarToOLStyle(
  state: IGrammarSymbologyState,
  featureValues: FeatureValues = [],
): Record<string, ExpressionValue> {
  // Accumulate per-encoding entries from all layers and their rules.
  // Layers with a kde/cluster preprocess are handled at the renderer level;
  // this compiler only produces the flat-style for the vector portion.
  const accumulator = new Map<Encoding, IEncodingEntry[]>();

  // Guard: state.layers may be absent on legacy Grammar states that predate
  // the layers nesting (e.g. stored as { rules: [...] } without a layers wrapper).
  for (const layer of state.layers ?? []) {
    if (layer.preprocess?.some(t => t.type === 'kde')) {
      // KDE layers are compiled separately by the renderer (HeatmapLayer).
      // Skip flat-style compilation for this layer.
      continue;
    }

    // Layer-level guard: compiled separately then AND-ed with the rule guard.
    const layerGuard =
      layer.when && layer.when.length > 0
        ? compileGuard(layer.when, layer.whenOp ?? 'all')
        : undefined;

    for (const rule of layer.rules) {
      // For now use the first field; multi-field assembly is handled via
      // sub-encoding mappings (pixel-red/green/blue) or expression scales.
      const field = rule.fields?.[0];
      // Each rule classifies against its own field's column.
      const ruleValues = columnFor(featureValues, field);
      const ruleGuard =
        rule.when && rule.when.length > 0
          ? compileGuard(rule.when, rule.whenOp ?? 'all')
          : undefined;
      const guard =
        layerGuard && ruleGuard
          ? ['all', layerGuard, ruleGuard]
          : (layerGuard ?? ruleGuard);

      for (const mapping of rule.mappings) {
        for (const encoding of mapping.encodings) {
          if (encoding === 'pixel-rgb') {
            // Virtual encoding: fan out to pixel-red/green/blue so assembleStyle
            // can compose them into ['color', r, g, b, a] with a separate alpha.
            for (const sub of [
              'pixel-red',
              'pixel-green',
              'pixel-blue',
            ] as Encoding[]) {
              const expr = compileMapping(field, mapping, ruleValues, sub);
              const entries = accumulator.get(sub) ?? [];
              entries.push({ guard, expr });
              accumulator.set(sub, entries);
            }
          } else {
            // Compile per-encoding so sub-encodings (pixel-red/green/blue) can each
            // extract the correct component from a colorRamp or other color scale.
            const expr = compileMapping(field, mapping, ruleValues, encoding);
            const entries = accumulator.get(encoding) ?? [];
            entries.push({ guard, expr });
            accumulator.set(encoding, entries);
          }
        }
      }
    }
  }

  // Build per-encoding OL expressions.
  const encodingExprs = new Map<Encoding, ExpressionValue>();
  for (const [encoding, entries] of accumulator) {
    encodingExprs.set(encoding, buildEncodingExpr(entries, encoding));
  }

  // Assemble into the final style object, handling sub-encoding composition.
  return assembleStyle(encodingExprs);
}

// ---------------------------------------------------------------------------
// Feature-value extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract the encoding field column from feature property rows.
 * colorMap and categorical scales take a single input field; this returns
 * all values for that field so the compiler can compute classification breaks.
 */
export function extractEncodingFieldValues(
  state: IGrammarSymbologyState,
  rows: Record<string, unknown>[],
): unknown[] {
  let field: string | undefined;
  for (const gl of state.layers ?? []) {
    for (const rule of gl.rules ?? []) {
      const f = rule.fields?.[0];
      if (f && !f.startsWith('$')) {
        field = f;
        break;
      }
    }
    if (field) {
      break;
    }
  }

  if (!field) {
    console.debug(
      'extractEncodingFieldValues: no encoding field found in Grammar state',
    );
    return [];
  }
  return rows.map(r => r[field]).filter(v => v !== null && v !== undefined);
}

/**
 * Extract one column per field the state classifies on.
 *
 * Prefer this over `extractEncodingFieldValues`: a state with rules on
 * different fields needs each rule classified against its own column, and a
 * single flat array silently classifies them all against the first field's.
 */
export function extractFieldColumns(
  state: IGrammarSymbologyState,
  rows: Record<string, unknown>[],
): Record<string, unknown[]> {
  const fields = new Set<string>();
  for (const gl of state.layers ?? []) {
    for (const rule of gl.rules ?? []) {
      const f = rule.fields?.[0];
      // $-prefixed fields are raster/transform pseudo-fields with no column.
      if (f && !f.startsWith('$')) {
        fields.add(f);
      }
    }
  }

  const columns: Record<string, unknown[]> = {};
  for (const field of fields) {
    columns[field] = rows
      .map(r => r[field])
      .filter(v => v !== null && v !== undefined);
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Encoding expression builder
// ---------------------------------------------------------------------------

/**
 * Merge a list of EncodingEntries into a single OL expression.
 * Conditional entries form case branches; the last unconditional entry wins
 * as the else branch (transparent/zero if none).
 */
function buildEncodingExpr(
  entries: IEncodingEntry[],
  encoding: Encoding,
): ExpressionValue {
  const conditional = entries.filter(e => e.guard !== undefined);
  const unconditional = entries.filter(e => e.guard === undefined);

  const elseExpr: ExpressionValue =
    unconditional.length > 0
      ? unconditional[unconditional.length - 1].expr
      : encodingZero(encoding);

  if (conditional.length === 0) {
    return elseExpr;
  }

  const caseExpr: ExpressionValue[] = ['case'];
  for (const { guard, expr } of conditional) {
    caseExpr.push(guard as ExpressionValue, expr);
  }
  caseExpr.push(elseExpr);
  return caseExpr;
}

/** Typed zero for encodings with no unconditional rule. */
function encodingZero(encoding: Encoding): ExpressionValue {
  const rgbaEncodings = new Set<Encoding>([
    'fill-color',
    'stroke-color',
    'circle-fill-color',
    'circle-stroke-color',
    'pixel-color',
  ]);
  return rgbaEncodings.has(encoding) ? 'rgba(0,0,0,0)' : 0;
}

// ---------------------------------------------------------------------------
// Sub-encoding assembly
// ---------------------------------------------------------------------------

const FILL_SUB: UInt8Encoding[] = ['fill-red', 'fill-green', 'fill-blue'];
const FILL_ALPHA_SUB: UNormEncoding[] = ['fill-alpha'];
const PIXEL_SUB: UInt8Encoding[] = ['pixel-red', 'pixel-green', 'pixel-blue'];
const PIXEL_ALPHA_SUB: UNormEncoding[] = ['pixel-alpha'];

/**
 * Assemble the final style object.
 * Sub-encodings (fill-red/green/blue/alpha, pixel-red/green/blue/alpha) are
 * combined into a ['color', r, g, b, a] expression on the parent encoding.
 * Virtual encodings (pixel-rgb) are already fanned out before this runs.
 */
function assembleStyle(
  encodingExprs: Map<Encoding, ExpressionValue>,
): Record<string, ExpressionValue> {
  const style: Record<string, ExpressionValue> = {};

  // Collect named encodings directly.
  const skip = new Set<Encoding>([
    ...FILL_SUB,
    ...FILL_ALPHA_SUB,
    ...PIXEL_SUB,
    ...PIXEL_ALPHA_SUB,
  ]);

  for (const [encoding, expr] of encodingExprs) {
    if (!skip.has(encoding)) {
      style[encoding] = expr;
    }
  }

  // Assemble fill-color from sub-encodings if any fill-* sub-encoding is present.
  // ['color', r, g, b, a] is the OL operator that produces ColorType (r/g/b 0-255, a 0-1).
  if (
    FILL_SUB.some(c => encodingExprs.has(c)) ||
    FILL_ALPHA_SUB.some(c => encodingExprs.has(c))
  ) {
    const r = encodingExprs.get('fill-red') ?? 0;
    const g = encodingExprs.get('fill-green') ?? 0;
    const b = encodingExprs.get('fill-blue') ?? 0;
    const a = encodingExprs.get('fill-alpha') ?? 1;
    style['fill-color'] = ['color', r, g, b, a] as ExpressionValue;
  }

  // Assemble pixel-color from sub-encodings when pixel-R/G/B are present.
  // pixel-alpha alone does NOT overwrite a direct pixel-color mapping.
  if (PIXEL_SUB.some(c => encodingExprs.has(c))) {
    const r = encodingExprs.get('pixel-red') ?? 0;
    const g = encodingExprs.get('pixel-green') ?? 0;
    const b = encodingExprs.get('pixel-blue') ?? 0;
    const a = encodingExprs.get('pixel-alpha') ?? 1;
    style['pixel-color'] = ['color', r, g, b, a] as ExpressionValue;
  } else if (
    PIXEL_ALPHA_SUB.some(c => encodingExprs.has(c)) &&
    !encodingExprs.has('pixel-color')
  ) {
    // Alpha-only with no direct pixel-color: compose with black.
    const a = encodingExprs.get('pixel-alpha') ?? 1;
    style['pixel-color'] = ['color', 0, 0, 0, a] as ExpressionValue;
  }

  return style;
}

// ---------------------------------------------------------------------------
// Guard compilation
// ---------------------------------------------------------------------------

function compileGuard(
  predicates: IPredicate[],
  op: 'all' | 'any' = 'all',
): ExpressionValue {
  const conditions = predicates.map(compilePredicate);
  return conditions.length === 1 ? conditions[0] : [op, ...conditions];
}

function compilePredicate(predicate: IPredicate): ExpressionValue {
  switch (predicate.type) {
    case 'geometryType':
      return ['==', ['geometry-type'], predicate.value];
    case 'hasField':
      // Band pseudo-fields always exist; for vector features use ['has'].
      return fieldAlwaysPresent(predicate.field)
        ? true
        : ['has', predicate.field];
    case 'fieldEquals':
      return ['==', fieldExpr(predicate.field), predicate.value];
    case 'fieldCompare':
      return [predicate.op, fieldExpr(predicate.field), predicate.value];
    case 'between':
      return [
        'all',
        ['>=', fieldExpr(predicate.field), predicate.min],
        ['<=', fieldExpr(predicate.field), predicate.max],
      ];
    default:
      throw new Error(`Invalid predicate type ${predicate}`);
  }
}

// ---------------------------------------------------------------------------
// Mapping compilation — dispatches by scale scheme
// ---------------------------------------------------------------------------

/**
 * Return the RGBA array index for a sub-encoding, or undefined for full-color
 * encodings.  Used to decompose a colorRamp into a single numeric component.
 */
function colorComponentIndex(encoding: Encoding): number | undefined {
  switch (encoding) {
    case 'fill-red':
    case 'pixel-red':
      return 0;
    case 'fill-green':
    case 'pixel-green':
      return 1;
    case 'fill-blue':
    case 'pixel-blue':
      return 2;
    case 'fill-alpha':
    case 'pixel-alpha':
      return 3;
    default:
      return undefined;
  }
}

function compileMapping(
  field: string | undefined,
  mapping: IMapping,
  featureValues: unknown[],
  encoding: Encoding,
): ExpressionValue {
  const { scale } = mapping;
  switch (scale.scheme) {
    case 'colorMap':
      return field
        ? compileColorMap(field, scale, featureValues, encoding)
        : scale.params.fallback;
    case 'categorical':
      return field
        ? compileCategorical(field, scale, featureValues)
        : scale.params.fallback;
    case 'expression':
      if (!scale.params.expr) {
        return scale.params.fallback;
      }
      try {
        const vegaExpr =
          scale.params.language === 'python'
            ? py2vega(scale.params.expr)
            : scale.params.expr;
        const olExpr = vega2ol(vegaExpr as string);
        return olExpr ?? scale.params.fallback;
      } catch (err) {
        console.debug(
          `grammarToOLStyle: failed to compile ${scale.params.language ?? 'vega'} expression`,
          err,
        );
        return scale.params.fallback;
      }
    case 'constant_rgba':
    case 'constant_num':
      return scale.params.value as ExpressionValue;
    case 'scalar':
      return field ? compileScalar(field, scale) : scale.params.fallback;
    case 'identity': {
      if (!field) {
        return encodingZero(mapping.encodings[0]);
      }
      // Wrap with coalesce so OL's expression type system infers the correct
      // output type (color vs number). Bare ['get', field] has type 'any'
      // which OL rejects for typed encodings like fill-color.
      const isColorEncoding = (mapping.encodings as string[]).some(ch =>
        [
          'fill-color',
          'stroke-color',
          'circle-fill-color',
          'circle-stroke-color',
          'pixel-color',
        ].includes(ch),
      );
      const typedFallback: ExpressionValue = isColorEncoding
        ? ([0, 0, 0, 0] as ExpressionValue)
        : 0;
      if (fieldAlwaysPresent(field)) {
        return fieldExpr(field);
      }
      return ['coalesce', fieldExpr(field), typedFallback] as ExpressionValue;
    }
    default:
      throw new Error(`Invalid scale scheme ${scale}`);
  }
}

// ---------------------------------------------------------------------------
// Scale compilers
// ---------------------------------------------------------------------------

/**
 * colorMap: numeric field → RGBA color via a named palette + classification.
 *
 * Output:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, color0, ...],
 *     fallback]
 */
function compileColorMap(
  field: string,
  scale: IColorMapScale,
  featureValues: unknown[],
  encoding?: Encoding,
): ExpressionValue {
  const stops = resolveColorMapStops(scale.params, featureValues);

  // Guard: interpolate requires at least 2 stop pairs. Return fallback when
  // the source is not yet loaded and no explicit domain/colorStops are set.
  if (stops.length < 2) {
    const componentIdx =
      encoding !== undefined ? colorComponentIndex(encoding) : undefined;
    return componentIdx !== undefined ? 0 : scale.params.fallback;
  }

  const componentIdx =
    encoding !== undefined ? colorComponentIndex(encoding) : undefined;

  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    fieldExpr(field),
  ];

  if (componentIdx !== undefined) {
    // Sub-encoding scalar interpolation for one color component (R=0,G=1,B=2,A=3).
    // colormap stops carry [r, g, b, a] with r/g/b in 0-255 and a in 0-1.
    // Values are passed as-is since assembleStyle uses ['color', r, g, b, a]
    // which takes r/g/b in 0-255.
    for (const { stop, color } of stops) {
      interpolateExpr.push(stop, (color as number[])[componentIdx]);
    }
    if (fieldAlwaysPresent(field)) {
      return interpolateExpr;
    }
    return ['case', ['has', field], interpolateExpr, 0];
  }

  // Full color encoding: emit the usual RGBA interpolation.
  for (const { stop, color } of stops) {
    interpolateExpr.push(stop, color as ExpressionValue);
  }
  if (fieldAlwaysPresent(field)) {
    return interpolateExpr;
  }
  return ['case', ['has', field], interpolateExpr, scale.params.fallback];
}

/**
 * categorical: nominal field → RGBA color via a named palette.
 * Unique field values are enumerated from featureValues at render time,
 * mirroring buildCategorized.
 *
 * Output:
 *   ['case',
 *     ['==', ['get', field], val0], color0,
 *     ...,
 *     fallback]
 */
function compileCategorical(
  field: string,
  scale: ICategoricalScale,
  featureValues: unknown[],
): ExpressionValue {
  const stops = resolveCategoricalStops(scale.params, featureValues);

  // Guard: a OL case expression requires at least one condition+value pair
  // before the else branch. Return fallback directly when stops is empty.
  if (stops.length === 0) {
    return scale.params.fallback;
  }

  const caseExpr: ExpressionValue[] = ['case'];
  for (const stop of stops) {
    let condition: ExpressionValue;
    if (stop.stop === STOP_UNDEFINED) {
      // Property missing entirely
      condition = ['!', ['has', field]] as ExpressionValue;
    } else if (stop.stop === STOP_NULL) {
      // Property exists but value is null
      condition = [
        'all',
        ['has', field],
        ['==', ['coalesce', fieldExpr(field), '__jgis_ns__'], '__jgis_ns__'],
      ] as ExpressionValue;
    } else {
      condition = [
        '==',
        fieldExpr(field),
        stop.stop as ExpressionValue,
      ] as ExpressionValue;
    }
    caseExpr.push(condition, stop.color as ExpressionValue);
  }
  caseExpr.push(scale.params.fallback);
  return caseExpr;
}

/**
 * scalar: numeric field → numeric output (radius, width, sub-encoding value).
 *
 * Output:
 *   ['case', ['has', field],
 *     ['interpolate', ['linear'], ['get', field], stop0, out0, ...],
 *     fallback]
 */
function compileScalar(field: string, scale: IScalarScale): ExpressionValue {
  const interpolateExpr: ExpressionValue[] = [
    'interpolate',
    ['linear'],
    fieldExpr(field),
  ];

  for (const { stop, output } of resolveScalarStops(scale.params)) {
    interpolateExpr.push(stop, output);
  }

  if (fieldAlwaysPresent(field)) {
    return interpolateExpr;
  }
  return ['case', ['has', field], interpolateExpr, scale.params.fallback];
}
