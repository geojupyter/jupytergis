import type {
  Encoding,
  IEncodingRule,
  IGrammarLayer,
  IGrammarSymbologyState,
} from '@jupytergis/schema';

/**
 * Constant deck.gl paint props compiled from grammar symbology.
 * Colors are RGBA with alpha in 0–255. Width and radius are pixels.
 */
export interface IDeckSymbologyAccessors {
  getFillColor?: [number, number, number, number];
  getLineColor?: [number, number, number, number];
  getLineWidth?: number;
  getPointRadius?: number;
}

const FILL_ENCODINGS = new Set<Encoding>(['fill-color', 'circle-fill-color']);
const LINE_ENCODINGS = new Set<Encoding>([
  'stroke-color',
  'circle-stroke-color',
]);
const WIDTH_ENCODINGS = new Set<Encoding>([
  'stroke-width',
  'circle-stroke-width',
]);

/**
 * Compile constant grammar scales into deck.gl accessor values.
 *
 * Walks grammar layers and rules in document order. The first constant for
 * each prop wins. Data-driven scales, guarded rules, and preprocessed layers
 * are skipped: a single array cannot vary per feature.
 */
export function grammarToDeckAccessors(
  state: IGrammarSymbologyState | undefined,
): IDeckSymbologyAccessors {
  if (!state?.layers?.length) {
    return {};
  }

  const accessors: IDeckSymbologyAccessors = {};
  for (const layer of state.layers) {
    if (!canPaintAsConstant(layer)) {
      continue;
    }

    for (const rule of layer.rules) {
      if (rule.when?.length) {
        continue;
      }
      applyRule(rule, accessors);
    }
  }

  return accessors;
}

function canPaintAsConstant(layer: IGrammarLayer): boolean {
  return !layer.when?.length && !layer.preprocess?.length;
}

function applyRule(
  rule: IEncodingRule,
  accessors: IDeckSymbologyAccessors,
): void {
  for (const mapping of rule.mappings) {
    const { scale } = mapping;

    if (scale.scheme === 'constant_rgba') {
      const color = toDeckColor(scale.params.value);
      for (const encoding of mapping.encodings) {
        assignColor(accessors, encoding, color);
      }
    } else if (scale.scheme === 'constant_num') {
      const value = scale.params.value;
      if (!Number.isFinite(value)) {
        continue;
      }

      for (const encoding of mapping.encodings) {
        assignNumber(accessors, encoding, value);
      }
    }
  }
}

function assignColor(
  accessors: IDeckSymbologyAccessors,
  encoding: Encoding,
  color: [number, number, number, number],
): void {
  if (accessors.getFillColor == null && FILL_ENCODINGS.has(encoding)) {
    accessors.getFillColor = color;
  }
  if (accessors.getLineColor == null && LINE_ENCODINGS.has(encoding)) {
    accessors.getLineColor = color;
  }
}

function assignNumber(
  accessors: IDeckSymbologyAccessors,
  encoding: Encoding,
  value: number,
): void {
  if (accessors.getLineWidth == null && WIDTH_ENCODINGS.has(encoding)) {
    accessors.getLineWidth = value;
  }
  if (accessors.getPointRadius == null && encoding === 'circle-radius') {
    accessors.getPointRadius = value;
  }
}

/** Grammar alpha is 0–1. Deck.gl alpha is 0–255. */
function toDeckColor(
  rgba: readonly [number, number, number, number],
): [number, number, number, number] {
  const alpha = Math.round(rgba[3] * 255);
  return [rgba[0], rgba[1], rgba[2], Math.min(255, Math.max(0, alpha))];
}
