import type { Coordinate } from 'ol/coordinate';

import { MapLibreViewer } from './viewers/maplibreViewer';
import { OpenLayersViewer } from './viewers/openlayersViewer';

export type MapViewerType = 'openlayers' | 'maplibre';

/**
 * Minimal abstraction layer between MainView and map engines.
 *
 * Keep this interface small initially.
 * More methods can be added as MapLibre support grows.
 */
export interface IMapViewer {
  initialize(target: HTMLElement, options: IMapViewerOptions): Promise<void>;
  destroy(): void;

  getCenter(): Coordinate | undefined;
  setCenter(center: Coordinate): void;
  getZoom(): number | undefined;
  setZoom(zoom: number): void;
  getRotation(): number;
  setRotation(rotation: number): void;
  getProjection(): string;

  getViewport(): HTMLElement | undefined;
}

export interface IMapViewerOptions {
  projection?: string;
  center?: Coordinate;
  zoom?: number;
  rotation?: number;
}

/**
 * Factory for creating map viewers.
 * - OpenLayers → OpenLayers implementation
 * - MapLibre   → OpenLayers fallback for now
 */
export async function createMapViewer(
  type: MapViewerType,
): Promise<IMapViewer> {
  switch (type) {
    case 'openlayers': {
      return new OpenLayersViewer();
    }

    case 'maplibre': {
      return new MapLibreViewer();
    }

    default: {
      throw new Error(`Unknown map viewer type: ${type}`);
    }
  }
}
