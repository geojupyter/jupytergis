import { IJupyterGISModel } from '@jupytergis/schema';

import {
  IOpenEOConnectionInfo,
  listOpenEOConnections,
} from './OpenEOTileLayer';
import { showAddOpenEOLayerDialog } from './addLayerDialog';

/**
 * Open the process-graph editor for an existing OpenEO layer and persist
 * the result.
 *
 * @param model - the active document model
 * @param layerId - the OpenEO layer to edit
 */
export async function editOpenEOLayer(
  model: IJupyterGISModel,
  layerId: string,
): Promise<void> {
  const layer = model.getLayer(layerId);
  if (!layer || layer.type !== 'OpenEOTileLayer') {
    return;
  }
  const sourceId = layer.parameters?.source as string | undefined;
  if (!sourceId) {
    return;
  }
  const source = model.getSource(sourceId);
  const sourceParams = (source?.parameters ?? {}) as {
    serverUrl?: string;
    processGraph?: Record<string, any>;
  };
  // The dialog connects to the layer's server itself, so it can open right
  // away and show that it is signing back in.
  const connectionInfo: IOpenEOConnectionInfo = {
    url: sourceParams.serverUrl,
  };
  const viewOptions = model.getOptions();
  const result = await showAddOpenEOLayerDialog({
    title: 'Edit OpenEO Layer',
    okLabel: 'Save',
    connectionInfo,
    knownServers: listOpenEOConnections(),
    initialGraph: sourceParams.processGraph,
    layerName: layer.name,
    mapView: {
      latitude: viewOptions.latitude,
      longitude: viewOptions.longitude,
      zoom: viewOptions.zoom,
    },
  });
  if (!result) {
    return;
  }
  if (source) {
    // Dropping the tileServiceURL, which needs to be recomputed
    model.sharedModel.updateSource(sourceId, {
      ...source,
      parameters: {
        serverUrl: result.serverUrl,
        processGraph: result.processGraph,
      },
    });
  }
  if (result.layerName !== layer.name) {
    model.sharedModel.updateLayer(layerId, {
      ...layer,
      name: result.layerName,
    });
  }
}
