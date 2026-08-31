import type {
  IDict,
  IJGISLayer,
  IJGISLayers,
  IJGISSource,
  IJGISSources,
  IJupyterGISModel,
  JgisCoordinates,
} from '@jupytergis/schema';
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

  getLayer(id: string): any | undefined;
  getLayerIDs(): string[];
  addLayer(id: string, layer: IJGISLayer, index?: number): Promise<void>;

  removeLayer(id: string): void;

  onZoomToPosition(_: IJupyterGISModel, id: string): void;
  flyToPosition(
    center: JgisCoordinates,
    zoom: number,
    duration?: number,
    transitionType?: 'linear' | 'immediate' | 'smooth',
  ): void;

  updateLayersImpl(layerIds: string[]): Promise<void>;
  trackLayerViewState(id: string, mapLayer: any): void;
  createSelectInteraction(): void;
  secureHighlightLayer(): void;

  updateLayer(
    id: string,
    layer: IJGISLayer,
    mapLayer: any,
    oldLayer?: IDict,
  ): Promise<void>;
  updateLayers(layerIds: string[]): void;

  moveLayer(id: string, index: number): void;

  addSource(id: string, source: IJGISSource): Promise<void>;

  removeSource(id: string): void;

  updateSource(id: string, source: IJGISSource): Promise<void>;

  /**
   * Temporary escape hatch while extraction is happening.
   *
   * This should also be removed once all operations
   * have moved behind IMapViewer.
   */
  getMap(): any;

  /** Adds or removes the zoom +/- control, matching `enabled`. */
  setZoomButtonsEnabled(enabled: boolean | undefined): void;

  /**
   * Removes the FullScreen control.
   *
   * This should also be removed once all operations
   * have moved behind IMapViewer.
   */
  enterPresentationMode(): void;

  /** Restores whatever enterPresentationMode() removed. */
  exitPresentationMode(): void;

  /**
   * i hope we could omit(any) in upcoming changes.
   */
  getGeolocationHandles(): any | undefined;
}

export interface IMapViewerOptions {
  projection?: string;
  center?: [number, number];
  zoom?: number;
  rotation?: number;
  layers?: IJGISLayers;
  sources?: IJGISSources;
  controlsTarget?: HTMLElement;
  zoomButtonsEnabled?: boolean;
  isSpectaMode?: boolean;
  mainViewId?: string;
  callbacks?: IMapViewerCallbacks;
}

/**
 * Hooks for the bits of `generateMap` that are genuinely MainView's
 * concern (React state, Lumino context menu) rather
 * than the map engine's.
 */
export interface IMapViewerCallbacks {
  onPostRender?: () => void;
  onScaleChange?: (scale: number) => void;
  onContextMenu?: (
    event: MouseEvent,
    lastPointerCoord: Coordinate | null,
  ) => void;
}

/**
 * Factory for creating map viewers.
 * - OpenLayers → OpenLayers implementation
 * - MapLibre   → OpenLayers fallback for now
 */
export async function createMapViewer(
  type: MapViewerType,
  model: IJupyterGISModel,
): Promise<IMapViewer> {
  switch (type) {
    case 'openlayers': {
      return new OpenLayersViewer(model);
    }

    case 'maplibre': {
      return new MapLibreViewer(model);
    }

    default: {
      throw new Error(`Unknown map viewer type: ${type}`);
    }
  }
}
