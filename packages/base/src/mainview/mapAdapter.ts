import type {
  IDict,
  IJGISLayer,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  IJGISUIState,
  IJupyterGISModel,
  JgisCoordinates,
} from '@jupytergis/schema';
import type { Coordinate } from 'ol/coordinate';

import { MapLibreAdapter } from './adapters/maplibreAdapter';
import { OpenLayersAdapter } from './adapters/openlayersAdapter';

export type MapAdapterType = 'openlayers' | 'maplibre';

/**
 * Minimal abstraction layer between MainView and map engines.
 *
 * Keep this interface small initially.
 * More methods can be added as MapLibre support grows.
 */
export interface IMapAdapter {
  initialize(target: HTMLElement, options: IMapAdapterOptions): Promise<void>;
  destroy(): void;

  getLayer(id: string): any | undefined;
  getLayerIDs(): string[];
  addLayer(id: string, layer: IJGISLayer, index?: number): Promise<void>;

  removeLayer(id: string): void;

  onZoomToPosition(_: IJupyterGISModel, id: string): void;
  convertFeatureToMs(_: IJupyterGISModel, args: string): void;
  handleLocationIndicatorToggled(
    _sender: IJupyterGISModel,
    uiState: IJGISUIState,
  ): void;
  flyToGeometry(_: IJupyterGISModel, geometry: any): void;
  highlightFeatureOnMap(
    _sender: IJupyterGISModel,
    featureOrGeometry: any,
  ): void;
  handleGeolocationChanged(sender: any, newPosition: JgisCoordinates): void;
  startLocationIndicator(): void;
  stopLocationIndicator(): void;
  computeFeatureFloaterPosition(
    feature: any,
  ): { x: number; y: number } | undefined;
  toLonLat(coordinate: number[], projection?: any): number[];
  handleDrawModeChanged(isDrawing: boolean): void;
  flyToPosition(
    center: JgisCoordinates,
    zoom: number,
    duration?: number,
    transitionType?: 'linear' | 'immediate' | 'smooth',
  ): void;
  moveToPosition(
    center: JgisCoordinates,
    zoom: number,
    duration?: number,
  ): void;

  applyOptions(
    options: IJGISOptions,
  ): { code: string; units: string } | undefined;

  updateLayersImpl(layerIds: string[]): Promise<void>;
  trackLayerViewState(id: string, mapLayer: any): void;
  createSelectInteraction(): void;

  updateLayer(
    id: string,
    layer: IJGISLayer,
    mapLayer: any,
    oldLayer?: IDict,
  ): Promise<void>;
  updateLayers(layerIds: string[]): void;

  clearHighlightIfNotIdentifying(): void;

  moveLayer(id: string, index: number): void;

  addSource(id: string, source: IJGISSource): Promise<void>;

  removeSource(id: string): void;

  updateSource(id: string, source: IJGISSource): Promise<void>;

  /**
   * Temporary escape hatch while extraction is happening.
   *
   * This should also be removed once all operations
   * have moved behind IMapAdapter.
   */
  getMap(): any;

  /** Adds or removes the zoom +/- control, matching `enabled`. */
  setZoomButtonsEnabled(enabled: boolean | undefined): void;

  /** Removes the FullScreen control. */
  enterPresentationMode(): void;

  /** Restores whatever enterPresentationMode() removed. */
  exitPresentationMode(): void;
}

export interface IMapAdapterOptions {
  projection?: string;
  center?: [number, number];
  /** Raw [longitude, latitude] in degrees; */
  lonLat?: [number, number];
  zoom?: number;
  rotation?: number;
  layers?: IJGISLayers;
  sources?: IJGISSources;
  controlsTarget?: HTMLElement;
  zoomButtonsEnabled?: boolean;
  isSpectaMode?: boolean;
  mainViewId?: string;
  callbacks?: IMapAdapterCallbacks;
}

/**
 * Hooks for the bits of `generateMap` that are genuinely MainView's
 * concern (React state, Lumino context menu) rather
 * than the map engine's.
 */
export interface IMapAdapterCallbacks {
  onPostRender?: () => void;
  onScaleChange?: (scale: number) => void;
  onContextMenu?: (
    event: MouseEvent,
    lastPointerCoord: Coordinate | null,
  ) => void;
}

/**
 * Factory for creating map adapters.
 * - OpenLayers → OpenLayers implementation
 * - MapLibre   → OpenLayers fallback for now
 */
export async function createMapAdapter(
  type: MapAdapterType,
  model: IJupyterGISModel,
): Promise<IMapAdapter> {
  switch (type) {
    case 'openlayers': {
      return new OpenLayersAdapter(model);
    }

    case 'maplibre': {
      return new MapLibreAdapter(model);
    }

    default: {
      throw new Error(`Unknown map adapter type: ${type}`);
    }
  }
}
