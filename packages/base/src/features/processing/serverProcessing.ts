import { ServerConnection } from '@jupyterlab/services';

const PROCESSING_ENDPOINT = '/jupytergis_core/processing';

/**
 * Module-level state for server-side processing toggle.
 */
let _serverProcessingEnabled = false;
let _serverAvailable: boolean | null = null;

export function isServerProcessingEnabled(): boolean {
  return _serverProcessingEnabled && _serverAvailable === true;
}

export function getServerProcessingToggle(): boolean {
  return _serverProcessingEnabled;
}

export function setServerProcessingEnabled(enabled: boolean): void {
  _serverProcessingEnabled = enabled;
}

/**
 * Check if the server-side GDAL endpoint is available.
 * Caches the result after the first successful check.
 */
export async function checkServerAvailability(): Promise<boolean> {
  if (_serverAvailable !== null) {
    return _serverAvailable;
  }

  try {
    const settings = ServerConnection.makeSettings();
    const url = `${settings.baseUrl}${PROCESSING_ENDPOINT.slice(1)}`;
    const response = await ServerConnection.makeRequest(url, {}, settings);

    if (response.ok) {
      const data = await response.json();
      _serverAvailable = data.available === true;
    } else {
      _serverAvailable = false;
    }
  } catch {
    _serverAvailable = false;
  }

  return _serverAvailable;
}

/**
 * Reset the cached availability (e.g. after environment change).
 */
export function resetServerAvailabilityCache(): void {
  _serverAvailable = null;
}

export interface IServerProcessingRequest {
  operation: string;
  options: string[];
  geojson: string;
  outputName: string;
}

export interface IServerProcessingUrlRequest {
  operation: string;
  options: string[];
  url: string;
  outputName: string;
}

export interface IServerProcessingResponse {
  result: string;
  format: 'text' | 'base64';
}

/**
 * Send a processing request to the server-side GDAL handler.
 */
export async function runServerProcessing(
  request: IServerProcessingRequest,
): Promise<IServerProcessingResponse> {
  const settings = ServerConnection.makeSettings();
  const url = `${settings.baseUrl}${PROCESSING_ENDPOINT.slice(1)}`;

  const response = await ServerConnection.makeRequest(
    url,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    settings,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || `Server processing failed: ${response.status}`,
    );
  }

  return await response.json();
}

/**
 * Send a URL-based processing request — the server uses /vsicurl/ so GDAL
 * issues HTTP range requests instead of downloading the full file.
 * Ideal for Cloud-Optimized GeoTIFFs (COGs).
 */
export async function runServerProcessingUrl(
  request: IServerProcessingUrlRequest,
): Promise<IServerProcessingResponse> {
  const settings = ServerConnection.makeSettings();
  const endpoint = `${settings.baseUrl}${PROCESSING_ENDPOINT.slice(1)}`;

  const response = await ServerConnection.makeRequest(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    settings,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || `Server processing failed: ${response.status}`,
    );
  }

  return await response.json();
}
