import {
  IJGISLayer,
  IJupyterGISModel,
  IVectorLayer,
  IGeoTiffLayer,
  IGeoZarrLayer,
} from '@jupytergis/schema';

/**
 * Payload when saving symbology. As of #698, only `symbologyState` is persisted
 * for vector layers — the OpenLayers FlatStyle is derived at render time from
 * `symbologyState` via `styleBuilder.buildVectorFlatStyle`. GeoTiff layers still
 * accept an optional `color` because their `color` field is used for band-math
 * expressions, not symbology duplication.
 */
export interface ISymbologyPayload {
  symbologyState:
    | IVectorLayer['symbologyState']
    | IGeoTiffLayer['symbologyState']
    | IGeoZarrLayer['symbologyState'];
  /**
   * Only used by GeoTiff band-math (`IGeoTiffLayer['color']`); never set for
   * vector layers. Typed as `unknown` because the GeoTiff schema's color type
   * is a nested numeric-array expression that doesn't round-trip cleanly
   * through the JSON-schema generator.
   */
  color?: unknown;
}

export interface ISaveSymbologyOptions {
  model: IJupyterGISModel;
  layerId: string;
  isStorySegmentOverride?: boolean;
  segmentId?: string;
  payload: ISymbologyPayload;
  mutateLayerBeforeSave?: (layer: any) => void;
}

export type VectorSymbologyParams = Pick<
  IVectorLayer,
  'symbologyState' | 'color'
>;

export type RasterSymbologyParams = Pick<
  IGeoTiffLayer | IGeoZarrLayer,
  'symbologyState'
>;

/** Params-shaped object used for reading symbology (layer.parameters or segment override). */
export type IEffectiveSymbologyParams =
  | VectorSymbologyParams
  | RasterSymbologyParams;

/**
 * Resolve the effective symbology params for this dialog: either the layer's
 * parameters or the matching segment override when editing a story-segment override.
 */
export function getEffectiveSymbologyParams(
  model: IJupyterGISModel,
  layerId: string,
  layer: IJGISLayer | null | undefined,
  isStorySegmentOverride?: boolean,
  segmentId?: string,
): IEffectiveSymbologyParams | null {
  if (!layer?.parameters) {
    return null;
  }
  if (!isStorySegmentOverride) {
    return layer.parameters as IEffectiveSymbologyParams;
  }
  if (!segmentId) {
    return null;
  }
  const segment = model.getLayer(segmentId);
  const override = segment?.parameters?.layerOverride?.find(
    (entry: { targetLayer?: string }) => entry.targetLayer === layerId,
  );

  if (!override) {
    return layer.parameters as IEffectiveSymbologyParams;
  }

  const layerParameters = layer.parameters as IEffectiveSymbologyParams;

  return {
    ...layerParameters,
    ...override,
    symbologyState:
      override.symbologyState ?? layerParameters.symbologyState ?? { layers: [] },
  } as IEffectiveSymbologyParams;
}

const GRAMMAR_SYMBOLOGY_METADATA_KEYS = new Set(['id']);

function isGrammarSymbologyState(
  value: unknown,
): value is IGrammarSymbologyState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as IGrammarSymbologyState).layers)
  );
}

/** True when a symbology value carries renderable content (not just ids/empties). */
function symbologyValueHasContent(value: unknown, key?: string): boolean {
  if (key && GRAMMAR_SYMBOLOGY_METADATA_KEYS.has(key)) {
    return false;
  }

  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(item => symbologyValueHasContent(item));
  }

  if (typeof value === 'object') {
    return Object.entries(value).some(([entryKey, entryValue]) =>
      symbologyValueHasContent(entryValue, entryKey),
    );
  }

  return true;
}

export function hasMeaningfulGrammarSymbologyState(
  symbologyState: unknown,
): boolean {
  if (!symbologyState || typeof symbologyState !== 'object') {
    return false;
  }

  if (!isGrammarSymbologyState(symbologyState)) {
    return symbologyValueHasContent(symbologyState);
  }

  if (symbologyState.layers.length === 0) {
    return false;
  }

  return symbologyState.layers.some(layer => symbologyValueHasContent(layer));
}

export function symbologyStatesEqual(
  baseSymbology: unknown,
  overrideSymbology: unknown,
): boolean {
  return JSON.stringify(baseSymbology) === JSON.stringify(overrideSymbology);
}

export function saveSymbology(options: ISaveSymbologyOptions): void {
  const {
    model,
    layerId,
    isStorySegmentOverride,
    segmentId,
    payload,
    mutateLayerBeforeSave,
  } = options;

  if (!isStorySegmentOverride) {
    const layer = model.getLayer(layerId);
    if (!layer?.parameters) {
      return;
    }

    layer.parameters.symbologyState = payload.symbologyState;
    if (payload.color !== undefined) {
      (layer.parameters as { color?: unknown }).color = payload.color;
    }

    mutateLayerBeforeSave?.(layer);
    model.sharedModel.updateLayer(layerId, layer);
    return;
  }

  if (!segmentId) {
    return;
  }

  const segment = model.getLayer(segmentId);
  if (!segment?.parameters) {
    return;
  }

  if (!segment.parameters.layerOverride) {
    segment.parameters.layerOverride = [];
  }

  // Persist override symbology for the explicit target layer.
  const targetLayerId = layerId;

  if (!targetLayerId) {
    return;
  }

  const overrides = segment.parameters.layerOverride;
  let override = overrides.find(
    (override: any) => override.targetLayer === targetLayerId,
  );

  if (!override) {
    // Create new override entry
    override = {
      targetLayer: targetLayerId,
      visible: true,
      opacity: 1,
      symbologyState: { layers: [] },
    };
    overrides.push(override);
  }

  override.symbologyState = payload.symbologyState;
  if (payload.color !== undefined) {
    override.color = payload.color;
  }

  model.sharedModel.updateLayer(segmentId, segment);
}
