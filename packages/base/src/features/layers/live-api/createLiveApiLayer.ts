import {
  ILiveApiSource,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  IVectorLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';

import { DEFAULT_LIVE_API_POLL_MS } from './liveApiTypes';

export interface ICreateLiveApiLayerOptions {
  name: string;
  parameters: ILiveApiSource;
}

/**
 * Find a LiveApiSource by display name.
 */
export function findLiveApiSourceIdByName(
  model: IJupyterGISModel,
  name: string,
): string | undefined {
  const sources = model.getSources() ?? {};
  for (const [id, source] of Object.entries(sources)) {
    if (source.type === 'LiveApiSource' && source.name === name) {
      return id;
    }
  }
  return undefined;
}

/**
 * List all LiveApiSource ids in the document.
 */
export function listLiveApiSourceIds(model: IJupyterGISModel): string[] {
  const sources = model.getSources() ?? {};
  return Object.entries(sources)
    .filter(([, source]) => source.type === 'LiveApiSource')
    .map(([id]) => id);
}

/**
 * Create a LiveApiSource + VectorLayer. Geometry is filled by the poller.
 */
export function createLiveApiLayer(
  model: IJupyterGISModel,
  options: ICreateLiveApiLayerOptions,
): string {
  const sourceId = UUID.uuid4();
  const layerId = UUID.uuid4();

  const parameters: ILiveApiSource = {
    url: options.parameters.url,
    pollIntervalMs:
      options.parameters.pollIntervalMs ?? DEFAULT_LIVE_API_POLL_MS,
    autoTrack: options.parameters.autoTrack ?? false,
    showTrail: options.parameters.showTrail ?? false,
    trailLength: options.parameters.trailLength ?? 50,
    useProxy: options.parameters.useProxy ?? false,
    httpHeaders: options.parameters.httpHeaders,
  };

  const sourceModel: IJGISSource = {
    type: 'LiveApiSource',
    name: options.name,
    parameters,
  };

  const layerParams: IVectorLayer = {
    opacity: 1,
    source: sourceId,
    symbologyState: { layers: [] },
  };

  const layerModel: IJGISLayer = {
    type: 'VectorLayer',
    visible: true,
    name: options.name,
    parameters: layerParams,
  };

  model.sharedModel.addSource(sourceId, sourceModel);
  model.addLayer(layerId, layerModel);

  return sourceId;
}
