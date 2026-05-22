import {
  ProcessGraph,
  ProcessRegistry,
} from '@openeo/js-processgraphs';

import {
  connect,
  IOpenEOConnectionInfo,
} from '../mainview/OpenEOTileLayer';

export interface IValidationError {
  code?: string;
  message: string;
}

/**
 * Client-side schema validation against the backend's process registry.
 *
 * Catches errors the backend's POST /validation misses — most notably
 * argument-schema violations like passing `{from_node: ...}` where a
 * `process-graph` callback is required (which some backends silently
 * accept). Same library openeo-web-editor uses.
 */
function isRef(v: any): boolean {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    (typeof v.from_node === 'string' || typeof v.from_parameter === 'string')
  );
}

function schemaIsCallback(schema: any): boolean {
  if (!schema) {
    return false;
  }
  if (Array.isArray(schema)) {
    return schema.some(s => schemaIsCallback(s));
  }
  if (typeof schema !== 'object') {
    return false;
  }
  if (schema.subtype === 'process-graph') {
    return true;
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (Array.isArray(schema[key]) && schema[key].some((s: any) => schemaIsCallback(s))) {
      return true;
    }
  }
  return false;
}

/**
 * Supplementary check: callbacks (parameters whose schema declares
 * `subtype: process-graph`) cannot be satisfied by a `from_node` /
 * `from_parameter` reference — per the openEO spec they must be inline
 * sub-graphs. The official `@openeo/js-processgraphs` library only flags
 * this when the upstream node's `returns.schema` is rich enough to prove
 * incompatibility; on sparse backend catalogs it silently passes.
 */
function checkCallbackArgs(
  processGraph: Record<string, any>,
  processIndex: Map<string, any>,
): IValidationError[] {
  const errors: IValidationError[] = [];
  for (const nodeId of Object.keys(processGraph)) {
    const node = processGraph[nodeId];
    const proc = node && processIndex.get(node.process_id);
    if (!proc || !Array.isArray(proc.parameters)) {
      continue;
    }
    const args = (node && node.arguments) ?? {};
    for (const param of proc.parameters) {
      if (!param || typeof param.name !== 'string') {
        continue;
      }
      if (!schemaIsCallback(param.schema)) {
        continue;
      }
      const argVal = args[param.name];
      if (argVal === undefined) {
        continue;
      }
      if (isRef(argVal)) {
        errors.push({
          code: 'ProcessArgumentInvalid',
          message: `The argument '${param.name}' in process '${node.process_id}' (node '${nodeId}') must be a callback (an inline process graph), not a reference to another node.`,
        });
      }
    }
  }
  return errors;
}

export async function validateProcessGraphLocally(
  processGraph: Record<string, any>,
  processes: any[] | undefined,
): Promise<IValidationError[]> {
  if (!processes || processes.length === 0) {
    return [];
  }
  try {
    const registry = new ProcessRegistry();
    for (const p of processes) {
      try {
        registry.add(p);
      } catch {
        // Skip processes the registry rejects (malformed catalog entries).
      }
    }
    const pg = new ProcessGraph(
      { id: 'jp-openeo-local', process_graph: processGraph },
      registry,
    );
    await pg.validate(false);
    const libErrs = pg.getErrors().getAll().map((e: any) => ({
      code: typeof e?.code === 'string' ? e.code : undefined,
      message: e?.message ?? String(e),
    }));
    // Supplementary spec-rule check the library misses on sparse catalogs.
    const processIndex = new Map<string, any>();
    for (const p of processes) {
      if (p && typeof p.id === 'string') {
        processIndex.set(p.id, p);
      }
    }
    const extraErrs = checkCallbackArgs(processGraph, processIndex);
    return mergeValidationErrors(libErrs, extraErrs);
  } catch (err: any) {
    return [
      {
        code: typeof err?.code === 'string' ? err.code : undefined,
        message: err?.message ?? String(err),
      },
    ];
  }
}

/**
 * Try to extract a (process, argument) "subject" from an error message
 * so we can dedupe multiple complaints about the same parameter slot.
 * Common shapes from @openeo/js-processgraphs and our supplementary
 * check:
 *   "argument 'X' in process 'Y'"
 *   "parameter 'X' missing for process 'Y'"
 *   "argument 'X' in process 'Y' (node 'Z')"
 */
function extractSubject(message: string): string | null {
  let m = message.match(/argument '([^']+)' in process '([^']+)'/);
  if (m) {
    return `${m[2]}::${m[1]}`;
  }
  m = message.match(/parameter '([^']+)' missing for process '([^']+)'/i);
  if (m) {
    return `${m[2]}::${m[1]}`;
  }
  return null;
}

function errorPriority(e: IValidationError): number {
  // Lower is better (kept when deduping by subject).
  if (e.code === 'ProcessParameterMissing') {
    return 0;
  }
  if (/must be a callback/i.test(e.message)) {
    return 1;
  }
  if (/missing|required/i.test(e.message)) {
    return 2;
  }
  // Generic "should be …" schema noise is least actionable.
  if (/should be /i.test(e.message)) {
    return 9;
  }
  return 5;
}

export function mergeValidationErrors(
  ...lists: IValidationError[][]
): IValidationError[] {
  // Flatten, drop exact duplicates first.
  const seenExact = new Set<string>();
  const all: IValidationError[] = [];
  for (const list of lists) {
    for (const e of list) {
      const exact = `${e.code ?? ''}::${e.message}`;
      if (seenExact.has(exact)) {
        continue;
      }
      seenExact.add(exact);
      all.push(e);
    }
  }
  // Dedupe by (process, argument) "subject", keeping the most actionable
  // message — preserving original order otherwise.
  const bestForSubject = new Map<string, { idx: number; prio: number }>();
  const kept = new Array<boolean>(all.length).fill(true);
  for (let i = 0; i < all.length; i++) {
    const subject = extractSubject(all[i].message);
    if (!subject) {
      continue;
    }
    const prio = errorPriority(all[i]);
    const existing = bestForSubject.get(subject);
    if (!existing) {
      bestForSubject.set(subject, { idx: i, prio });
    } else if (prio < existing.prio) {
      kept[existing.idx] = false;
      bestForSubject.set(subject, { idx: i, prio });
    } else {
      kept[i] = false;
    }
  }
  return all.filter((_, i) => kept[i]);
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
