/**
 * Shared classification resolvers.
 *
 * A scale's stops come from one of two places: persisted overrides, written to
 * the document only when the user edits a stop by hand, or a derivation from
 * whatever feature values are available at the time of use.
 *
 * Three consumers need that derivation — the OL style compiler, the symbology
 * editor preview and the legend — and they must agree, or the map, the stop
 * table and the legend show three different classifications. So the derivation
 * lives here once; each caller supplies the feature values it has.
 *
 * `derive*` ignores overrides and always classifies from the data (what the
 * editor previews). `resolve*` prefers overrides and falls back to `derive*`
 * (what the renderer and the legend draw).
 */

import {
  ICategoricalScaleParams,
  IColorMapScaleParams,
  IGrammarSymbologyState,
  IScalarScaleParams,
  RGBA,
} from '@jupytergis/schema';

import { COLOR_RAMP_DEFAULTS, ColorRampName } from './colorRampUtils';
import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  SymbologyState,
} from './styleBuilder';

export interface IResolvedColorStop {
  stop: number;
  color: RGBA;
}

export interface IResolvedCategoricalStop {
  stop: string | number;
  color: RGBA;
}

export interface IResolvedScalarStop {
  stop: number;
  output: number;
}

/**
 * Number of classes to classify a colorMap into.
 *
 * Some ramps (hsv, picnic, cubehelix, rainbow-soft) only read correctly above a
 * minimum class count, so `nShades` is clamped to it. The Classes input is not
 * clamped, so this has to be applied everywhere the stops are derived — not
 * just in the editor — or the preview and the map disagree on the stop count.
 */
export function colorMapClassCount(params: IColorMapScaleParams): number {
  const minRequired = COLOR_RAMP_DEFAULTS[params.name as ColorRampName];
  return minRequired
    ? Math.max(params.nShades ?? minRequired, minRequired)
    : params.nShades;
}

/**
 * Classify a colorMap from the data, ignoring any persisted stops.
 *
 * With no values in range this still returns stops when the domain is fully
 * specified — `computeGraduatedColorStops` falls back to `[vmin, vmax]`. That
 * is the vector-tile case: the full feature population is never loaded, so an
 * explicit domain is the only stable way to classify.
 */
export function deriveColorMapStops(
  params: IColorMapScaleParams,
  featureValues: unknown[],
): IResolvedColorStop[] {
  const numericValues = featureValues.filter(v =>
    Number.isFinite(v),
  ) as number[];

  const syntheticState = {
    nClasses: colorMapClassCount(params),
    mode: params.mode,
    colorRamp: params.name,
    reverseRamp: params.reverse,
    vmin: params.domain?.[0],
    vmax: params.domain?.[1],
  } as unknown as SymbologyState;

  return computeGraduatedColorStops(syntheticState, numericValues).map(s => ({
    stop: s.value as number,
    color: s.color as RGBA,
  }));
}

/** Persisted stops win; otherwise classify from the data. */
export function resolveColorMapStops(
  params: IColorMapScaleParams,
  featureValues: unknown[],
): IResolvedColorStop[] {
  if (params.colorStops && params.colorStops.length >= 2) {
    return params.colorStops;
  }
  return deriveColorMapStops(params, featureValues);
}

/**
 * Enumerate categories from the data, ignoring any persisted stops.
 *
 * Unlike colorMap there is no domain to fall back on: the set of categories is
 * unknowable without scanning the data, so with no values this returns [].
 */
export function deriveCategoricalStops(
  params: ICategoricalScaleParams,
  featureValues: unknown[],
): IResolvedCategoricalStop[] {
  const syntheticState = {
    colorRamp: params.colorRamp,
    reverseRamp: params.reverse ?? false,
  } as unknown as SymbologyState;

  return computeCategorizedColorStops(syntheticState, featureValues).map(s => ({
    stop: s.value as string | number,
    color: s.color as RGBA,
  }));
}

/** Persisted stops win; otherwise enumerate categories from the data. */
export function resolveCategoricalStops(
  params: ICategoricalScaleParams,
  featureValues: unknown[],
): IResolvedCategoricalStop[] {
  if (params.colorStops && params.colorStops.length > 0) {
    return params.colorStops;
  }
  return deriveCategoricalStops(params, featureValues);
}

/**
 * Endpoints of a scalar mapping. No data dependency: domain and range are both
 * set explicitly by the user, so this is just the two ends of the interpolation.
 */
export function deriveScalarStops(
  params: IScalarScaleParams,
): IResolvedScalarStop[] {
  return [
    { stop: params.domain[0], output: params.range[0] },
    { stop: params.domain[1], output: params.range[1] },
  ];
}

/** Persisted stops win; otherwise interpolate between domain and range. */
export function resolveScalarStops(
  params: IScalarScaleParams,
): IResolvedScalarStop[] {
  if (params.scalarStops && params.scalarStops.length >= 2) {
    return params.scalarStops;
  }
  return deriveScalarStops(params);
}

/**
 * Whether any scale in the state has to look at the data to know its stops.
 *
 * Reading feature values costs a source load (or, for tile sources, a restyle
 * on every tile), so callers use this to skip that work for states that are
 * fully described by their params — scalar and constant scales always are, and
 * so are colorMap/categorical scales the user has pinned by editing a stop.
 */
export function grammarNeedsFeatureValues(
  state: IGrammarSymbologyState | undefined,
): boolean {
  return (state?.layers ?? []).some(layer =>
    layer.rules?.some(rule =>
      rule.mappings?.some(({ scale }) => {
        if (scale.scheme === 'colorMap') {
          return (scale.params.colorStops?.length ?? 0) < 2;
        }
        if (scale.scheme === 'categorical') {
          return (scale.params.colorStops?.length ?? 0) === 0;
        }
        return false;
      }),
    ),
  );
}
