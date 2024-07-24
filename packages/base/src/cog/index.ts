import { IDict } from '@jupytergis/schema';
import { URLExt } from '@jupyterlab/coreutils';

// TODO Make this configurable
const BASE_URL = 'http://127.0.0.1:8000/cog';

export function buildCOGURL(endpoint: string, params: IDict): string {
  const target = new URL(URLExt.join(BASE_URL, endpoint));
  const urlParams = new URLSearchParams();

  for (const key of Object.keys(params)) {
    if (Array.isArray(params[key])) {
      for (const param of params[key]) {
        urlParams.append(key, param);
      }
      continue;
    }

    urlParams.set(key, params[key]);
  }
  target.search = urlParams.toString();

  return target.toString();
}

export async function cogRequest(
  endpoint: string,
  params: IDict
): Promise<IDict> {
  const out = await fetch(buildCOGURL(endpoint, params));
  return await out.json();
}

export function cogInfo(params: IDict) {
  return cogRequest('info', params);
}

export function cogStats(params: IDict) {
  return cogRequest('statistics', params);
}

export function cogTile(params: IDict): string {
  return buildCOGURL('WebMercatorQuad/tilejson.json', params);
}
