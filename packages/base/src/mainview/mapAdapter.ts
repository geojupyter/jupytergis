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

import { OpenLayersAdapter } from './adapters/openlayersAdapter';

export type MapAdapterType = 'openlayers';

/**
 * Minimal abstraction layer between MainView and map engines.
 *
 * Keep this interface small initially.
 * More methods can be added as MapLibre support grows.
 */
export interface IMapAdapter {
  initialize(target: HTMLElement, options: IMapAdapterOptions): Promise<void>;
  destroy(): void;

  addLayer(id: string, layer: IJGISLayer, index?: number): Promise<void>;
  removeLayer(id: string): void;

  getZoom(): number;
  getViewportId(): string;
  getProjection(): {
    code: string;
    units: string;
  };
  getPixelFromCoordinate(coordinate: Coordinate): [number, number];

  registerMap(path: string): void;

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
  createSelectInteraction(): void;

  updateLayer(id: string, layer: IJGISLayer, oldLayer?: IDict): Promise<void>;
  updateLayers(layerIds: string[]): void;

  clearHighlightIfNotIdentifying(): void;

  moveLayer(id: string, index: number): void;

  addSource(id: string, source: IJGISSource): Promise<void>;

  removeSource(id: string): void;

  updateSource(id: string, source: IJGISSource): Promise<void>;

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
  onDrawLayerIdChange?: (layerId: string | undefined) => void;
  onDrawGeometryLabelChange?: (label: string) => void;
  onAllLayersSettled?: () => void;
  onLayerInserted?: (layerCount: number) => void;
  onLayerAddSettled?: (id: string) => void;
  shouldShowLayerError?: (id: string, message: string) => boolean;
}

/**
 * Factory for creating map adapters.
 * - OpenLayers → OpenLayers implementation
 */
export async function createMapAdapter(
  type: MapAdapterType,
  model: IJupyterGISModel,
): Promise<IMapAdapter> {
  switch (type) {
    case 'openlayers': {
      return new OpenLayersAdapter(model);
    }

    default: {
      throw new Error(`Unknown map adapter type: ${type}`);
    }
  }
}
