import { invalidateBackendCatalog } from '@/src/tools';
import { openEOConnect, IOpenEOConnectionInfo } from './OpenEOTileLayer';

/**
 * A user-defined process as stored on the backend. `GET /process_graphs`
 * only has to return summaries, so the full graph and parameter declarations
 * are fetched per id before they can be edited.
 */
export interface IUserProcess {
  id: string;
  processGraph: Record<string, any>;
  parameters: any[];
  /**
   * Everything else the backend holds for this process (summary, description,
   * returns, categories…), kept verbatim so saving an edited graph back
   * doesn't drop metadata the graph editor never touches.
   */
  metadata: Record<string, any>;
}

/** Whether the backend lets the signed-in user store user-defined processes. */
export async function canSaveUserProcesses(
  connectionInfo: IOpenEOConnectionInfo,
): Promise<boolean> {
  try {
    const connection = await openEOConnect(connectionInfo);
    return Boolean(connection.capabilities()?.hasFeature('setUserProcess'));
  } catch {
    return false;
  }
}

export async function fetchUserProcess(
  connectionInfo: IOpenEOConnectionInfo,
  id: string,
): Promise<IUserProcess> {
  const connection = await openEOConnect(connectionInfo);
  const udp: any = await connection.getUserProcess(id);
  const graph = udp?.processGraph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new Error(
      `The backend returned no process graph for user-defined process '${id}'.`,
    );
  }
  const metadata: Record<string, any> =
    typeof udp.toJSON === 'function' ? udp.toJSON() : {};
  delete metadata.id;
  delete metadata.process_graph;
  delete metadata.parameters;
  return {
    id: udp.id ?? id,
    processGraph: graph,
    parameters: Array.isArray(udp.parameters) ? udp.parameters : [],
    metadata,
  };
}

/**
 * Store a process graph as a user-defined process. `PUT /process_graphs/{id}`
 * is create-or-replace, so this covers both saving a new UDP and saving
 * changes back to an existing one.
 */
export async function saveUserProcess(
  connectionInfo: IOpenEOConnectionInfo,
  udp: IUserProcess,
): Promise<void> {
  const connection = await openEOConnect(connectionInfo);
  // `id` belongs in the body as well as the path: the spec lets the path win,
  // but backends (titiler-openeo) reject a body without it.
  const process: Record<string, any> = {
    ...udp.metadata,
    id: udp.id,
    process_graph: udp.processGraph,
    parameters: udp.parameters,
  };
  await connection.setUserProcess(udp.id, process as any);
  invalidateBackendCatalog(connectionInfo.url);
}
