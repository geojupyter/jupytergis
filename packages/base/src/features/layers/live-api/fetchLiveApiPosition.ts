import type { IJupyterGISModel, ILiveApiSource } from '@jupytergis/schema';

import { fetchWithProxies } from '@/src/tools';
import { parseLiveApiPosition, type ILiveApiPosition } from './liveApiTypes';

export async function fetchLiveApiPosition(
  model: IJupyterGISModel,
  parameters: ILiveApiSource,
  signal?: AbortSignal,
): Promise<ILiveApiPosition> {
  const strategy = parameters.useProxy ? 'internal' : undefined;
  const json = await fetchWithProxies<unknown>(
    parameters.url,
    model,
    response => response.json(),
    { signal },
    strategy,
  );

  if (json === null) {
    throw new Error(`Failed to fetch live API: ${parameters.url}`);
  }

  return parseLiveApiPosition(json);
}
