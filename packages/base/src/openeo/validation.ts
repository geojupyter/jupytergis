import {
  connect,
  IOpenEOConnectionInfo,
} from '../mainview/OpenEOTileLayer';

export interface IValidationError {
  code?: string;
  message: string;
}

export async function validateProcessGraph(
  connectionInfo: IOpenEOConnectionInfo,
  processGraph: Record<string, any>,
): Promise<IValidationError[]> {
  const connection = await connect(connectionInfo);
  const result = await connection.validateProcess({
    id: 'jp-openeo-validation',
    process_graph: processGraph,
  } as any);
  return (result as any[]).map(e => ({
    code: e?.code,
    message: e?.message ?? String(e),
  }));
}

export interface ITestRenderResult {
  ok: boolean;
  /** Object URL of the rendered tile if ok. Caller must revoke. */
  imageUrl?: string;
  /** Error message if !ok. */
  message?: string;
}

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
}

/**
 * Create a transient XYZ service, fetch one tile at the centre of the
 * bbox, and report success or the backend's actual error message.
 */
export async function testRenderProcessGraph(
  connectionInfo: IOpenEOConnectionInfo,
  processGraph: Record<string, any>,
  bbox: { west: number; south: number; east: number; north: number },
): Promise<ITestRenderResult> {
  const connection = await connect(connectionInfo);
  const service = await connection.createService(
    { id: 'jp-openeo-test', process_graph: processGraph } as any,
    'XYZ',
  );
  if (!service?.url) {
    return { ok: false, message: 'Backend did not return an XYZ service URL.' };
  }
  const z = 10;
  const centerLon = (bbox.west + bbox.east) / 2;
  const centerLat = (bbox.south + bbox.north) / 2;
  const x = lonToTileX(centerLon, z);
  const y = latToTileY(centerLat, z);
  const tileUrl = service.url
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('%7Bz%7D', String(z))
    .replace('%7Bx%7D', String(x))
    .replace('%7By%7D', String(y));
  try {
    const res = await fetch(tileUrl);
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed?.message ?? parsed?.detail ?? parsed?.error ?? text;
      } catch {
        /* not JSON */
      }
      return { ok: false, message: `HTTP ${res.status}: ${message}` };
    }
    const blob = await res.blob();
    return { ok: true, imageUrl: URL.createObjectURL(blob) };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? String(err) };
  }
}
