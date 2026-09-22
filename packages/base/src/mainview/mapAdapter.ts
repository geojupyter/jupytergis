import type {
  IDict,
  IIdentifiedFeature,
  IJGISLayer,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  IJGISUIState,
  IJupyterGISModel,
  JgisCoordinates,
} from '@jupytergis/schema';
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';

import type { IDrawToolAdapter } from '@/src/features/draw-tool';
import { ClientPointer } from './CollaboratorPointers';

export type MapAdapterType = 'openlayers';

export const VIEWPORT_SYNC_INTERVAL = 200;

export interface IMapProjection {
  code: string;
  units: string;
}

export interface IMapLayerComparison {
  /** The compared layers: the first shows on the left, the second on the right. */
  layers: [string, string];
  /** Divider position, expressed as proportion of map width between 0 and 1. */
  position: number;
}

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
  getProjection(): IMapProjection;
  getPixelFromCoordinate(coordinate: number[]): [number, number];

  registerMap(path?: string): void;
  unregisterMap(): void;

  onZoomToPosition(id: string): void;
  convertFeatureToMs(args: string): void;
  updateClientPointerPositions(
    clientPointers: Record<number, ClientPointer>,
  ): Record<number, ClientPointer>;
  handleLocationIndicatorToggled(uiState: IJGISUIState): void;
  flyToGeometry(geometry: Geometry): void;
  highlightFeatureOnMap(featureOrGeometry: GeoJSONFeature | Geometry): void;
  handleGeolocationChanged(newPosition: JgisCoordinates): void;
  startLocationIndicator(): void;
  stopLocationIndicator(): void;
  computeFeatureFloaterPosition(
    feature: IIdentifiedFeature,
  ): { x: number; y: number } | undefined;
  toLonLat(coordinate: number[], projection?: IMapProjection): number[];
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
    easing?: 'ease' | 'linear',
  ): void;

  applyOptions(
    options: IJGISOptions,
  ): { code: string; units: string } | undefined;

  updateLayer(id: string, layer: IJGISLayer, oldLayer?: IDict): Promise<void>;
  updateLayers(layerIds: string[]): Promise<void>;

  clearHighlightIfNotIdentifying(): void;

  addSource(id: string, source: IJGISSource): Promise<void>;

  removeSource(id: string): void;

  updateSource(id: string, source: IJGISSource): Promise<void>;

  /** Adds or removes the zoom +/- control, matching `enabled`. */
  setZoomButtonsEnabled(enabled: boolean | undefined): void;

  /** Enables or disables pan/zoom navigation (used while following a user). */
  setNavigationEnabled(enabled: boolean): void;

  /** Clips each compared layer to its side of a divider; `null` clears it. */
  setLayerComparison(comparison: IMapLayerComparison | null): void;

  /** Removes the FullScreen control. */
  enterPresentationMode(): void;

  /** Restores whatever enterPresentationMode() removed. */
  exitPresentationMode(): void;

  readonly drawTool: IDrawToolAdapter;
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
  loggerRegistry?: ILoggerRegistry;
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
    lastPointerCoord: number[] | null,
  ) => void;
  onDrawLayerIdChange?: (layerId: string | undefined) => void;
  onDrawGeometryLabelChange?: (label: string) => void;
  onAllLayersSettled?: () => void;
  onLayerInserted?: (layerCount: number) => void;
  onLayerAddStarted?: () => void;
  onLayerAddSettled?: (id: string) => void;
  onLayerError?: (id: string, message: string) => void;
  onClientPointerPositionChanged?: () => void;
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
      const { OpenLayersAdapter } =
        await import('./adapters/openlayersAdapter');
      return new OpenLayersAdapter(model);
    }

    default: {
      throw new Error(`Unknown map adapter type: ${type}`);
    }
  }
}
