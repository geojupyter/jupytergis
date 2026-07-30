import type { ILiveApiSource } from '@jupytergis/schema';

export const DEFAULT_LIVE_API_POLL_MS = 5000;

export const ISS_TRACKER_NAME = 'ISS Tracker';

export const ISS_LIVE_API_PRESET: Required<
  Pick<ILiveApiSource, 'url' | 'pollIntervalMs'>
> &
  Pick<ILiveApiSource, 'useProxy'> = {
  url: 'https://api.wheretheiss.at/v1/satellites/25544',
  pollIntervalMs: DEFAULT_LIVE_API_POLL_MS,
  useProxy: false,
};

export interface ILiveApiPosition {
  longitude: number;
  latitude: number;
  properties: Record<string, unknown>;
}

/**
 * Read root-level latitude/longitude from an API JSON payload.
 * Other root-level scalar fields become feature properties.
 */
export function parseLiveApiPosition(json: unknown): ILiveApiPosition {
  if (!json || typeof json !== 'object') {
    throw new Error('Live API response is not a JSON object');
  }

  const record = json as Record<string, unknown>;
  const latitude = record.latitude;
  const longitude = record.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error(
      'Live API response must include numeric root-level latitude and longitude',
    );
  }

  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'latitude' || key === 'longitude') {
      continue;
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      properties[key] = value;
    }
  }

  return { latitude, longitude, properties };
}
