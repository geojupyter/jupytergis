import {
  IGeoJSONSource,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  IVectorLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';

import {
  fetchIssPosition,
  ISS_TRACKER_NAME,
  issPositionToGeoJson,
} from './issApi';

/**
 * Find an existing ISS tracker GeoJSON source by stable name.
 */
export function findIssTrackerSourceId(
  model: IJupyterGISModel,
): string | undefined {
  const sources = model.getSources() ?? {};
  for (const [id, source] of Object.entries(sources)) {
    if (source.type === 'GeoJSONSource' && source.name === ISS_TRACKER_NAME) {
      return id;
    }
  }
  return undefined;
}

/**
 * Create GeoJSONSource + VectorLayer for the ISS, seeded with a live position.
 * @returns The new source id.
 */
export async function createIssLayer(model: IJupyterGISModel): Promise<string> {
  const position = await fetchIssPosition();
  const data = issPositionToGeoJson(position);

  const sourceId = UUID.uuid4();
  const layerId = UUID.uuid4();

  const sourceParameters: IGeoJSONSource = {
    data: data as IGeoJSONSource['data'],
    path: null,
  };

  const sourceModel: IJGISSource = {
    type: 'GeoJSONSource',
    name: ISS_TRACKER_NAME,
    parameters: sourceParameters,
  };

  const layerParams: IVectorLayer = {
    opacity: 1,
    source: sourceId,
    symbologyState: { layers: [] },
  };

  const layerModel: IJGISLayer = {
    type: 'VectorLayer',
    visible: true,
    name: ISS_TRACKER_NAME,
    parameters: layerParams,
  };

  model.sharedModel.addSource(sourceId, sourceModel);
  model.addLayer(layerId, layerModel);

  return sourceId;
}
