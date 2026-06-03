import { IJupyterGISModel } from '@jupytergis/schema';

import { showAddOpenEOLayerDialog } from './addLayerDialog';
import {
  connect as openEOConnect,
  IOpenEOConnectionInfo,
  listOpenEOConnections,
} from '../mainview/OpenEOTileLayer';

/**
 * All distinct OpenEO server URLs referenced by layers already in the
 * document, used to pre-populate the server picker in the edit dialog.
 */
function listExistingOpenEOServers(model: IJupyterGISModel): string[] {
  const layers = model.sharedModel.layers ?? {};
  const seen = new Set<string>();
  const out: string[] = [];
  for (const layer of Object.values(layers)) {
    if (layer?.type !== 'OpenEOTileLayer') {
      continue;
    }
    const sourceId = layer.parameters?.source as string | undefined;
    const source = sourceId ? model.getSource(sourceId) : undefined;
    const params = (source?.parameters ?? {}) as { serverUrl?: string };
    if (params.serverUrl && !seen.has(params.serverUrl)) {
      seen.add(params.serverUrl);
      out.push(params.serverUrl);
    }
  }
  return out;
}

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
 * @param options.onConnected - called once the layer's server connection is
 *   (re)established, so callers can cache it for subsequent layer creation.
 */
export async function editOpenEOLayer(
  model: IJupyterGISModel,
  layerId: string,
  options?: {
    onConnected?: (info: IOpenEOConnectionInfo) => void;
  },
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
  // Reconnect to the layer's server before editing. `connect` reuses the
  // cached connection when the server is already authenticated; otherwise
  // it prompts the user — the token is never stored.
  const connectionInfo: IOpenEOConnectionInfo = {
    url: sourceParams.serverUrl,
  };
  try {
    await openEOConnect(connectionInfo);
    options?.onConnected?.(connectionInfo);
  } catch {
    return;
  }
  const knownServers = Array.from(
    new Set(
      [...listOpenEOConnections(), ...listExistingOpenEOServers(model)].filter(
        Boolean,
      ),
    ),
  );
  const result = await showAddOpenEOLayerDialog({
    title: 'Edit OpenEO Layer',
    okLabel: 'Save',
    connectionInfo,
    knownServers,
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
