import { IJupyterGISModel } from '@jupytergis/schema';

import {
  connect as openEOConnect,
  IOpenEOConnectionInfo,
  listOpenEOConnections,
} from './OpenEOTileLayer';
import { showAddOpenEOLayerDialog } from './addLayerDialog';

/**
 * Find the id of the OpenEO layer that references the given source.
 */
export function findOpenEOLayerIdForSource(
  model: IJupyterGISModel,
  sourceId: string,
): string | undefined {
  const layers = model.sharedModel.layers ?? {};
  for (const [id, layer] of Object.entries(layers)) {
    if (
      layer?.type === 'OpenEOTileLayer' &&
      (layer.parameters?.source as string | undefined) === sourceId
    ) {
      return id;
    }
  }
  return undefined;
}

/**
 * Open the process-graph editor for an existing OpenEO layer and persist
 * the result. Shared by the command and the Source Properties button.
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
    authBearer?: string;
    processGraph?: Record<string, any>;
  };
  // Reconnect to the layer's server before editing. `connect` reuses the
  // cached connection when the server is already authenticated, and the
  // persisted bearer lets it re-establish silently after a reload instead
  // of prompting the user again.
  const connectionInfo: IOpenEOConnectionInfo = {
    url: sourceParams.serverUrl,
    authBearer: sourceParams.authBearer,
  };
  try {
    await openEOConnect(connectionInfo);
  } catch {
    return;
  }
  const result = await showAddOpenEOLayerDialog({
    title: 'Edit OpenEO Layer',
    okLabel: 'Save',
    connectionInfo,
    knownServers: listOpenEOConnections(),
    initialGraph: sourceParams.processGraph,
    layerName: layer.name,
  });
  if (!result) {
    return;
  }
  if (source) {
    model.sharedModel.updateSource(sourceId, {
      ...source,
      parameters: {
        ...source.parameters,
        serverUrl: result.serverUrl,
        authBearer: result.authBearer,
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
