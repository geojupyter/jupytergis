import { DEFAULT_PROJECTION } from '@jupytergis/schema';

import { ILayerMetadata, IMetadataContext, IMetadataField } from '../types';
import { transformExtent } from '../utils/crs';
import { getSourceLocationField, humanizeTypeName } from '../utils/source';

/**
 * The metadata every layer and source has, read straight from the document.
 *
 * This always runs, and format-specific providers are layered on top of it, so
 * an unsupported source type still shows something useful instead of an empty
 * panel.
 */
export async function documentProvider(
  context: IMetadataContext,
): Promise<ILayerMetadata> {
  const { model, layer, layerId, sourceId, source } = context;

  const general: IMetadataField[] = [];

  if (layer) {
    general.push({ label: 'Layer', value: layer.name });
    general.push({ label: 'Layer type', value: humanizeTypeName(layer.type) });
  }

  if (source) {
    general.push({ label: 'Source', value: source.name });
    general.push({
      label: 'Source type',
      value: humanizeTypeName(source.type),
    });

    const location = getSourceLocationField(source);
    if (location) {
      general.push(location);
    }
  }

  return {
    general,
    ...documentExtent(model, layerId, sourceId),
  };
}

/**
 * Fall back to the extent JupyterGIS computed when it drew the layer.
 *
 * `viewState` is populated from the OpenLayers source as layers load, so it is
 * available for most layers regardless of format — but it is expressed in the
 * map's projection, not the data's native CRS. Providers that can read the
 * real native extent from the file override this.
 */
function documentExtent(
  model: IMetadataContext['model'],
  layerId?: string,
  sourceId?: string,
): Pick<ILayerMetadata, 'extent'> {
  const extent =
    (layerId ? model.getExtent(layerId) : undefined) ??
    (sourceId ? model.getExtent(sourceId) : undefined);

  if (!extent?.length) {
    return {};
  }

  const mapProjection = model.getOptions()?.projection ?? DEFAULT_PROJECTION;

  return {
    extent: {
      native: extent,
      nativeCrs: mapProjection,
      wgs84: transformExtent(extent, mapProjection),
      approximate: true,
    },
  };
}
