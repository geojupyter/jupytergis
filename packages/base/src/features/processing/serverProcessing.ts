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

export interface IServerProcessingUrlWithCutlineRequest {
  operation: string;
  options: string[];
  url: string;
  cutlineGeojson: string;
  outputName: string;
}

export interface IServerProcessingResponse {
  result: string;
  format: 'text' | 'base64';
}

/**
 * Invoked with the GDAL operation's completion as an integer percentage
 * (0–100) while the operation runs server-side.
 */
export type ProgressCallback = (percent: number) => void;

/**
 * Per-request options shared by all server processing calls.
 */
export interface IServerProcessingOptions {
  /** Called with integer progress (0–100) as the server streams it. */
  onProgress?: ProgressCallback;
  /** Abort signal; aborting cancels the request (and the server subprocess). */
  signal?: AbortSignal;
}

/**
 * Thrown when a server processing request is cancelled via its abort signal,
 * so callers can distinguish a user cancellation from a genuine failure.
 */
export class ProcessingCancelledError extends Error {
  constructor() {
    super('Processing cancelled');
    this.name = 'ProcessingCancelledError';
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * POST a processing request to the server-side GDAL handler.
 *
 * When `onProgress` is supplied, the request opts into a Server-Sent Events
 * stream (`Accept: text/event-stream`) so the server can report incremental
 * progress; each `data:` frame carries a JSON payload of either
 * `{ progress }`, `{ result, format }`, or `{ error }`. Without `onProgress`
 * it falls back to a plain JSON round-trip. Aborting `signal` rejects with
 * `ProcessingCancelledError`.
 */
async function postProcessing(
  body: Record<string, unknown>,
  options: IServerProcessingOptions = {},
): Promise<IServerProcessingResponse> {
  const { onProgress, signal } = options;
  const settings = ServerConnection.makeSettings();
  const endpoint = `${settings.baseUrl}${PROCESSING_ENDPOINT.slice(1)}`;

  try {
    if (!onProgress) {
      const response = await ServerConnection.makeRequest(
        endpoint,
        { method: 'POST', body: JSON.stringify(body), signal },
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

    const response = await ServerConnection.makeRequest(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { Accept: 'text/event-stream' },
        signal,
      },
      settings,
    );

    if (!response.ok) {
      let message = `Server processing failed: ${response.status}`;
      try {
        const error = await response.json();
        message = error.error || message;
      } catch {
        // Response body was not JSON; keep the status-based message.
      }
      throw new Error(message);
    }

    // Some environments may not expose a readable stream; fall back to JSON.
    if (!response.body) {
      return await response.json();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: IServerProcessingResponse | null = null;

    // SSE frames are separated by a blank line; each carries one JSON payload
    // on a `data:` line.
    const handleFrame = (frame: string): void => {
      const dataLine = frame.split('\n').find(line => line.startsWith('data:'));
      if (!dataLine) {
        return;
      }
      const payload = JSON.parse(dataLine.slice('data:'.length).trim());
      if (typeof payload.progress === 'number') {
        onProgress(payload.progress);
      } else if (payload.error) {
        throw new Error(payload.error);
      } else if (payload.result !== undefined) {
        result = { result: payload.result, format: payload.format };
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        handleFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf('\n\n');
      }
    }

    // Flush a trailing frame that wasn't terminated by a blank line.
    if (buffer.trim()) {
      handleFrame(buffer);
    }

    if (!result) {
      throw new Error('Server processing stream ended without a result');
    }
    return result;
  } catch (err) {
    // A user cancellation surfaces as an AbortError from fetch/the reader;
    // normalise it so callers can treat it distinctly from a failure.
    if (isAbortError(err) || signal?.aborted) {
      throw new ProcessingCancelledError();
    }
    throw err;
  }
}

/**
 * Send a processing request to the server-side GDAL handler.
 */
export async function runServerProcessing(
  request: IServerProcessingRequest,
  options?: IServerProcessingOptions,
): Promise<IServerProcessingResponse> {
  return postProcessing({ ...request }, options);
}

/**
 * Send a URL-based processing request — the server uses /vsicurl/ so GDAL
 * issues HTTP range requests instead of downloading the full file.
 * Ideal for Cloud-Optimized GeoTIFFs (COGs).
 */
export async function runServerProcessingUrl(
  request: IServerProcessingUrlRequest,
  options?: IServerProcessingOptions,
): Promise<IServerProcessingResponse> {
  return postProcessing({ ...request }, options);
}

/**
 * Run a GDAL operation that needs both a remote raster URL and a vector
 * cutline (e.g. `gdalwarp -cutline`). The server writes the cutline GeoJSON
 * to a temp file and substitutes `{cutlinePath}` in the options list.
 */
export async function runServerProcessingUrlWithCutline(
  request: IServerProcessingUrlWithCutlineRequest,
  options?: IServerProcessingOptions,
): Promise<IServerProcessingResponse> {
  return postProcessing({ ...request }, options);
}
