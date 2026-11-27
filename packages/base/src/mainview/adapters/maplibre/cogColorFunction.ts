/**
 * Grammar -> COG protocol color function.
 *
 * The COG protocol (@geomatico/maplibre-cog-protocol) paints a COG with a
 * per-pixel callback registered through `setColorFunction(url, fn)`. This
 * module builds that callback from a symbology state.
 *
 * It reuses grammarToOLStyle (the single source of truth for what a symbology
 * state means) and evaluates the resulting OpenLayers `pixel-color` expression
 * in JS. OL runs that expression in a WebGL shader; here it is compiled once
 * into a tree of closures, so the per-pixel work is just function calls.
 *
 * Supported expression operators are the ones grammarToOLStyle emits for
 * raster symbology (band, case, interpolate, color, comparisons, logic and
 * math). An unsupported operator throws at compile time.
 */

import type { IGrammarSymbologyState } from '@jupytergis/schema';

import { grammarToOLStyle } from '../openlayers/grammarToOLStyle';

/** Subset of the protocol's CogMetadata that the color function uses. */
export interface ICogPixelMetadata {
  noData?: number;
}

export type CogColorFunction = (
  pixel: ArrayLike<number>,
  color: Uint8ClampedArray,
  metadata: ICogPixelMetadata,
) => void;

export interface ICogColorOptions {
  /**
   * Same meaning as the OL GeoTIFF source option: scale band values to
   * [0, 1] before the style sees them. Defaults to true, like OL.
   */
  normalize?: boolean;
  /** Source min/max used for normalization; data-type range when absent. */
  min?: number;
  max?: number;
  /** Overrides the COG's own noData value. */
  nodata?: number;
  onWarn?: (message: string) => void;
}

type RGBA = [number, number, number, number];

/** Mutable per-pixel state shared by every compiled closure. */
interface IPixelContext {
  band: (n: number) => number;
}

type Evaluator = (ctx: IPixelContext) => any;

// ---------------------------------------------------------------------------
// Expression compiler
// ---------------------------------------------------------------------------

const MATH_UNARY: Record<string, (x: number) => number> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  exp: Math.exp,
};

const COMPARE: Record<string, (a: any, b: any) => boolean> = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
};

const constant =
  (value: any): Evaluator =>
  () =>
    value;

/** Compile an OL expression into a closure. Throws on unsupported input. */
export function compileExpression(expr: unknown): Evaluator {
  if (!Array.isArray(expr)) {
    return constant(expr);
  }
  const [op, ...args] = expr;

  // A plain array literal such as [255, 0, 0, 1].
  if (typeof op !== 'string') {
    return constant(expr);
  }

  const compiled = () => args.map(compileExpression);

  switch (op) {
    case 'literal':
      return constant(args[0]);

    case 'band': {
      const n = args[0] as number;
      return ctx => ctx.band(n);
    }

    case 'array':
    case 'color':
    case 'rgba': {
      const parts = compiled();
      return ctx => {
        const out = parts.map(p => p(ctx));
        if (out.length === 3) {
          out.push(1);
        }
        return out;
      };
    }

    case 'number':
    case 'to-number':
    case 'string':
    case 'boolean': {
      const [inner] = compiled();
      return op === 'string' || op === 'boolean'
        ? inner
        : ctx => Number(inner(ctx));
    }

    case 'case': {
      const parts = compiled();
      return ctx => {
        for (let i = 0; i + 1 < parts.length; i += 2) {
          if (parts[i](ctx)) {
            return parts[i + 1](ctx);
          }
        }
        return parts[parts.length - 1](ctx);
      };
    }

    case 'match': {
      const [input, ...rest] = args;
      const inputFn = compileExpression(input);
      const branches: { labels: unknown[]; out: Evaluator }[] = [];
      for (let i = 0; i + 1 < rest.length; i += 2) {
        const label = rest[i];
        branches.push({
          labels: Array.isArray(label) ? label : [label],
          out: compileExpression(rest[i + 1]),
        });
      }
      const fallback = compileExpression(rest[rest.length - 1]);
      return ctx => {
        const v = inputFn(ctx);
        const hit = branches.find(b => b.labels.includes(v));
        return hit ? hit.out(ctx) : fallback(ctx);
      };
    }

    case 'all': {
      const parts = compiled();
      return ctx => parts.every(p => p(ctx));
    }
    case 'any': {
      const parts = compiled();
      return ctx => parts.some(p => p(ctx));
    }
    case '!': {
      const [inner] = compiled();
      return ctx => !inner(ctx);
    }

    case 'between': {
      const [v, lo, hi] = compiled();
      return ctx => {
        const x = v(ctx);
        return x >= lo(ctx) && x <= hi(ctx);
      };
    }

    case '+': {
      const parts = compiled();
      return ctx => parts.reduce((sum, p) => sum + p(ctx), 0);
    }
    case '*': {
      const parts = compiled();
      return ctx => parts.reduce((prod, p) => prod * p(ctx), 1);
    }
    case '-': {
      const [a, b] = compiled();
      return b ? ctx => a(ctx) - b(ctx) : ctx => -a(ctx);
    }
    case '/': {
      const [a, b] = compiled();
      return ctx => a(ctx) / b(ctx);
    }
    case '%': {
      const [a, b] = compiled();
      return ctx => a(ctx) % b(ctx);
    }
    case '^': {
      const [a, b] = compiled();
      return ctx => Math.pow(a(ctx), b(ctx));
    }
    case 'min': {
      const parts = compiled();
      return ctx => Math.min(...parts.map(p => p(ctx)));
    }
    case 'max': {
      const parts = compiled();
      return ctx => Math.max(...parts.map(p => p(ctx)));
    }
    case 'atan2': {
      const [a, b] = compiled();
      return ctx => Math.atan2(a(ctx), b(ctx));
    }
    case 'clamp': {
      const [v, lo, hi] = compiled();
      return ctx => Math.min(Math.max(v(ctx), lo(ctx)), hi(ctx));
    }

    case 'coalesce': {
      const parts = compiled();
      return ctx => {
        for (const p of parts) {
          const v = p(ctx);
          if (v !== null && v !== undefined) {
            return v;
          }
        }
        return null;
      };
    }

    case 'interpolate':
      return compileInterpolate(args);

    default: {
      if (op in COMPARE) {
        const [a, b] = compiled();
        const cmp = COMPARE[op];
        return ctx => cmp(a(ctx), b(ctx));
      }
      if (op in MATH_UNARY) {
        const [a] = compiled();
        const fn = MATH_UNARY[op];
        return ctx => fn(a(ctx));
      }
      throw new Error(`unsupported expression operator "${op}"`);
    }
  }
}

function compileInterpolate(args: unknown[]): Evaluator {
  const [interpolation, input, ...stopArgs] = args;
  const kind = Array.isArray(interpolation) ? interpolation[0] : 'linear';
  const base =
    kind === 'exponential' && Array.isArray(interpolation)
      ? Number(interpolation[1])
      : 1;
  if (kind !== 'linear' && kind !== 'exponential') {
    throw new Error(`unsupported interpolation "${String(kind)}"`);
  }

  const inputFn = compileExpression(input);
  const stops: number[] = [];
  const outputs: Evaluator[] = [];
  for (let i = 0; i + 1 < stopArgs.length; i += 2) {
    stops.push(stopArgs[i] as number);
    outputs.push(compileExpression(stopArgs[i + 1]));
  }
  if (stops.length < 2) {
    throw new Error('interpolate needs at least two stops');
  }

  const factor = (x: number, lo: number, hi: number): number => {
    const range = hi - lo;
    if (range === 0) {
      return 0;
    }
    if (base === 1) {
      return (x - lo) / range;
    }
    return (Math.pow(base, x - lo) - 1) / (Math.pow(base, range) - 1);
  };

  const mix = (a: any, b: any, t: number): any => {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.map((av, i) => av + (b[i] - av) * t);
    }
    return a + (b - a) * t;
  };

  return ctx => {
    const x = inputFn(ctx);
    if (Number.isNaN(x)) {
      return outputs[0](ctx);
    }
    if (x <= stops[0]) {
      return outputs[0](ctx);
    }
    const last = stops.length - 1;
    if (x >= stops[last]) {
      return outputs[last](ctx);
    }
    let i = 1;
    while (x > stops[i]) {
      i++;
    }
    const t = factor(x, stops[i - 1], stops[i]);
    return mix(outputs[i - 1](ctx), outputs[i](ctx), t);
  };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const TRANSPARENT: RGBA = [0, 0, 0, 0];

/** Coerce an expression result (array or CSS string) to [r, g, b, a 0-1]. */
export function toRGBA(value: unknown): RGBA {
  if (Array.isArray(value) && value.length >= 3) {
    return [value[0], value[1], value[2], value[3] ?? 1];
  }
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    const fn = s.match(/^rgba?\(([^)]+)\)$/);
    if (fn) {
      const [r, g, b, a = '1'] = fn[1].split(',').map(p => p.trim());
      return [Number(r), Number(g), Number(b), Number(a)];
    }
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
      const h =
        hex[1].length === 3
          ? hex[1]
              .split('')
              .map(c => c + c)
              .join('')
          : hex[1];
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        1,
      ];
    }
  }
  return TRANSPARENT;
}

// ---------------------------------------------------------------------------
// Band values
// ---------------------------------------------------------------------------

/**
 * Default min/max OL assumes for a data type when the source does not give
 * any. Mirrors ol/source/GeoTIFF so normalized values line up with OL.
 */
function dataTypeRange(pixel: ArrayLike<number>): [number, number] {
  if (pixel instanceof Int8Array) {
    return [-128, 127];
  }
  if (pixel instanceof Int16Array) {
    return [-32768, 32767];
  }
  if (pixel instanceof Int32Array) {
    return [-2147483648, 2147483647];
  }
  if (pixel instanceof Uint16Array) {
    return [0, 65535];
  }
  if (pixel instanceof Uint32Array) {
    return [0, 4294967295];
  }
  if (pixel instanceof Float32Array) {
    return [1.401298464324817e-45, 3.4028234663852886e38];
  }
  return [0, 255];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a COG protocol color function from a symbology state, or undefined
 * when nothing in it can be compiled (the layer then renders with the
 * protocol's default).
 *
 * Grammar layers are alpha-composited the way OL stacks its per-layer
 * WebGLTile layers. The UI lists them top-first, so they are drawn in
 * reverse.
 */
export function compileCogColorFunction(
  state: IGrammarSymbologyState,
  options: ICogColorOptions = {},
): CogColorFunction | undefined {
  const evaluators: Evaluator[] = [];

  for (const grammarLayer of state.layers ?? []) {
    try {
      // [0, 1] is the same fallback OL's raster path passes when it has no
      // feature values, so colorMap stops span the normalized band range.
      const flat = grammarToOLStyle({ layers: [grammarLayer] }, [0, 1]);
      const expr = flat['pixel-color'];
      if (expr !== undefined) {
        evaluators.push(compileExpression(expr));
      }
    } catch (error) {
      options.onWarn?.(
        `Skipping a symbology layer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (evaluators.length === 0) {
    return undefined;
  }
  return buildColorFunction([...evaluators].reverse(), options);
}

/**
 * Same as compileCogColorFunction for a single raw OL `color` expression
 * (the legacy `color` parameter of a GeoTiffLayer).
 */
export function compileCogColorExpression(
  expression: unknown,
  options: ICogColorOptions = {},
): CogColorFunction | undefined {
  try {
    return buildColorFunction([compileExpression(expression)], options);
  } catch (error) {
    options.onWarn?.(
      `Ignoring layer color: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

function buildColorFunction(
  bottomToTop: Evaluator[],
  options: ICogColorOptions,
): CogColorFunction {
  const normalize = options.normalize !== false;

  // One context reused for every pixel; `band` reads the current pixel.
  let currentPixel: ArrayLike<number> = [];
  let lo = 0;
  let hi = 1;
  const ctx: IPixelContext = {
    band: n => {
      const raw = currentPixel[n - 1];
      if (raw === undefined) {
        return NaN;
      }
      return normalize ? (raw - lo) / (hi - lo) : raw;
    },
  };

  return (pixel, color, metadata) => {
    currentPixel = pixel;

    const nodata = options.nodata ?? metadata?.noData;
    let allNoData = nodata !== undefined;
    for (let i = 0; i < pixel.length; i++) {
      const v = pixel[i];
      if (Number.isNaN(v)) {
        color[3] = 0;
        return;
      }
      if (v !== nodata) {
        allNoData = false;
      }
    }
    if (allNoData) {
      color[3] = 0;
      return;
    }

    if (normalize) {
      const [defaultLo, defaultHi] = dataTypeRange(pixel);
      lo = options.min ?? defaultLo;
      hi = options.max ?? defaultHi;
    }

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (const evaluate of bottomToTop) {
      const [sr, sg, sb, sa] = toRGBA(evaluate(ctx));
      if (sa <= 0) {
        continue;
      }
      const outA = sa + a * (1 - sa);
      r = (sr * sa + r * a * (1 - sa)) / outA;
      g = (sg * sa + g * a * (1 - sa)) / outA;
      b = (sb * sa + b * a * (1 - sa)) / outA;
      a = outA;
    }

    color[0] = r;
    color[1] = g;
    color[2] = b;
    color[3] = a * 255;
  };
}
