/** Where The ISS At — public position API for NORAD ID 25544. */
export const ISS_API_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

/** Stable source/layer name used to find and resume the tracker. */
export const ISS_TRACKER_NAME = 'ISS Tracker';

export interface IIssPosition {
  name: string;
  id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint: number;
  timestamp: number;
}

export interface IIssGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: {
      name: string;
      altitude: number;
      velocity: number;
      visibility: string;
      footprint: number;
      timestamp: number;
    };
  }>;
}

export async function fetchIssPosition(
  signal?: AbortSignal,
): Promise<IIssPosition> {
  const response = await fetch(ISS_API_URL, { signal });
  if (!response.ok) {
    throw new Error(`ISS API ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as IIssPosition;
}

export function issPositionToGeoJson(
  position: IIssPosition,
): IIssGeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          name: position.name,
          altitude: position.altitude,
          velocity: position.velocity,
          visibility: position.visibility,
          footprint: position.footprint,
          timestamp: position.timestamp,
        },
      },
    ],
  };
}
