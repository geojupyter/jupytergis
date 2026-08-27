import {
  IJGISLayer,
  IJGISSource,
  IMarkerSource,
  IGeoParquetSource,
  IGeoZarrSource,
  IGeoTiffSource,
  IImageSource,
  IShapefileSource,
  IOpenEOTileSource,
  IVectorTileSource,
  IRasterDemSource,
  IRasterSource,
  IWmsTileSource,
  IViewState,
  IRasterLayer,
  IVectorLayer,
  IGrammarSymbologyState,
  IHillshadeLayer,
  IImageLayer,
  IOpenEOTileLayer,
  IGeoTiffLayer,
  IGeoZarrLayer,
  IJGISFilterItem,
  IStacLayer,
  IJupyterGISModel,
  IStorySegmentLayer,
  IVectorTileLayer,
  IDict,
  IIdentifiedFeatureEntry,
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import {
  Collection,
  Feature,
  getUid,
  MapBrowserEvent,
  Map as OlMap,
  VectorTile,
  View,
} from 'ol';
import type { FeatureLike } from 'ol/Feature';
import TileState from 'ol/TileState';
import { Coordinate } from 'ol/coordinate';
import { singleClick } from 'ol/events/condition';
import { getCenter } from 'ol/extent';
import { GeoJSON, MVT } from 'ol/format';
import { Point } from 'ol/geom';
import { Select } from 'ol/interaction';
import {
  Image as ImageLayer,
  Layer,
  Vector as VectorLayer,
  VectorImage as VectorImageLayer,
  VectorTile as VectorTileLayer,
  WebGLTile as RasterLayer,
} from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat, get as getProjection, transformExtent } from 'ol/proj';
import { register } from 'ol/proj/proj4.js';
import RenderFeature from 'ol/render/Feature';
import {
  GeoTIFF as GeoTIFFSource,
  ImageTile as ImageTileSource,
  Source,
  TileWMS as TileWMSSource,
  Vector as VectorSource,
  VectorTile as VectorTileSource,
  XYZ as XYZSource,
} from 'ol/source';
import GeoZarr from 'ol/source/GeoZarr';
import Static from 'ol/source/ImageStatic';
import TileSource, { TileSourceEvent } from 'ol/source/Tile';
import { Icon, Style } from 'ol/style';
import { Rule } from 'ol/style/flat';
//@ts-expect-error no types for ol-pmtiles
import { PMTilesRasterSource, PMTilesVectorSource } from 'ol-pmtiles';
import StacLayer from 'ol-stac';
import proj4 from 'proj4';
import proj4list from 'proj4-list';

import { ensureHighlightLayer } from '@/src/features/identify/utils/highlightLayer';
import { buildHighlightStyle } from '@/src/features/identify/utils/highlightStyle';
import {
  OpenEOTileLayer,
  OpenEOTileSource,
} from '@/src/features/layers/openeo/OpenEOTileLayer';
import { grammarToOLLayer } from '@/src/features/layers/symbology/grammarToOLLayer';
import {
  extractEncodingFieldValues,
  grammarToOLStyle,
} from '@/src/features/layers/symbology/grammarToOLStyle';
import { DEFAULT_FLAT_STYLE } from '@/src/features/layers/symbology/styleBuilder';
import {
  buildZarrColorStyle,
  getBandInfoFromZarr,
  getDefaultRGBBands,
  IZarrBandInfo,
} from '@/src/features/layers/symbology/zarrBandDiscovery';
import { IMapViewer, IMapViewerOptions } from '@/src/mainview/mapviewer';
import { markerIcon } from '@/src/shared/icons';
import { INTERNAL_PROXY_BASE, isJupyterLite, loadFile } from '@/src/tools';
import { MainViewModel } from '../mainviewmodel';

type OlLayerTypes =
  | TileLayer
  | VectorLayer
  | VectorImageLayer
  | VectorTileLayer
  | RasterLayer
  | StacLayer
  | ImageLayer<any>
  | LayerGroup;

export class OpenLayersViewer implements IMapViewer {
  constructor(model: IJupyterGISModel) {
    this._model = model;
    this._loadingLayers = new Set();
  }
  async initialize(
    target: HTMLElement,
    options: IMapViewerOptions,
  ): Promise<void> {
    const {
      projection = 'EPSG:3857',
      center = [0, 0],
      zoom = 1,
      rotation = 0,
      layers = {},
      sources = {},
    } = options;

    const proj = getProjection(projection);

    if (!proj) {
      throw new Error(`Invalid projection: ${projection}`);
    }

    this._map = new OlMap({
      target,
      view: new View({
        center,
        zoom,
        rotation,
        projection: proj,
      }),
      keyboardEventTarget: document,
    });

    for (const [sourceId, source] of Object.entries(sources)) {
      this.addSource(sourceId, source);
    }

    let index = 0;

    for (const [layerId, layer] of Object.entries(layers)) {
      this.addLayer(layerId, layer, index++);
    }

    await new Promise<void>(resolve => {
      if (!this._map) {
        resolve();
        return;
      }

      if (this._map.getSize()) {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => {
        resolve();
      }, 100);

      this._map.once('postrender', () => {
        window.clearTimeout(timeout);
        resolve();
      });
    });
  }

  destroy(): void {
    if (!this._map) {
      return;
    }

    this._map.setTarget(undefined);
    this._sources.clear();
  }

  getSize(): [number, number] | undefined {
    const size = this._map?.getSize();

    if (!size) {
      return undefined;
    }

    return [size[0], size[1]];
  }

  /**
   * Build the map layer.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   * @returns - the map layer.
   */
  private async _buildMapLayer(
    id: string,
    layer: IJGISLayer,
  ): Promise<Layer | LayerGroup | StacLayer | undefined> {
    this._loadingLayers.add(id);

    let newMapLayer: OlLayerTypes;
    let layerParameters: any;
    let sourceId: string | undefined;
    let source: IJGISSource | undefined;

    // Sourceless layers
    if (!['StacLayer', 'StorySegmentLayer'].includes(layer.type)) {
      sourceId = layer.parameters?.source;
      if (!sourceId) {
        return;
      }
      source = this._model.sharedModel.getLayerSource(sourceId);
      if (!source) {
        return;
      }
      if (!this._sources.get(sourceId)) {
        await this.addSource(sourceId, source);
      }
      // Updates GeoZarr layer again after getting bands, styles info from zarr store.
      source = this._model.sharedModel.getLayerSource(sourceId);
    }

    // TODO: OpenLayers provides a bunch of sources for specific tile
    // providers, so maybe set up some way to use those
    switch (layer.type) {
      case 'RasterLayer': {
        layerParameters = layer.parameters as IRasterLayer;

        newMapLayer = new TileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources.get(layerParameters.source),
        });

        break;
      }
      case 'VectorLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        if (Array.isArray(layerParameters.symbologyState?.layers)) {
          const olSource = this._sources.get(
            layerParameters.source,
          ) as VectorSource;
          const grammarState =
            layerParameters.symbologyState as IGrammarSymbologyState;
          const rows =
            olSource instanceof VectorSource
              ? olSource.getFeatures().map(f => (f as Feature).getProperties())
              : [];
          const featureValues = extractEncodingFieldValues(grammarState, rows);
          newMapLayer = grammarToOLLayer(
            layerParameters.symbologyState as IGrammarSymbologyState,
            olSource,
            layerParameters.opacity,
            layer.visible,
            featureValues,
          ) as OlLayerTypes;
        } else {
          newMapLayer = new VectorImageLayer({
            opacity: layerParameters.opacity,
            visible: layer.visible,
            source: this._sources.get(layerParameters.source),
            style: this.vectorLayerStyleRuleBuilder(layer),
          });
        }

        break;
      }
      case 'VectorTileLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        newMapLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources.get(layerParameters.source),
          style: this.vectorLayerStyleRuleBuilder(layer),
        });

        break;
      }
      case 'HillshadeLayer': {
        layerParameters = layer.parameters as IHillshadeLayer;

        newMapLayer = new RasterLayer({
          opacity: layerParameters.opacity ?? 0.3,
          visible: layer.visible,
          source: this._sources.get(layerParameters.source),
          style: {
            color: ['color', this.hillshadeMath()],
          },
        });

        break;
      }
      case 'ImageLayer': {
        layerParameters = layer.parameters as IImageLayer;

        newMapLayer = new ImageLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources.get(layerParameters.source),
        });

        break;
      }
      case 'OpenEOTileLayer': {
        layerParameters = layer.parameters as IOpenEOTileLayer;

        newMapLayer = new OpenEOTileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources.get(layerParameters.source),
        });
        break;
      }
      case 'GeoTiffLayer': {
        layerParameters = layer.parameters as IGeoTiffLayer;
        const geoTiffSource = this._sources.get(layerParameters.source);

        await this._waitForSourceReady(geoTiffSource);

        if (Array.isArray(layerParameters.symbologyState?.layers)) {
          newMapLayer = grammarToOLLayer(
            layerParameters.symbologyState as IGrammarSymbologyState,
            geoTiffSource,
            layerParameters.opacity ?? 1,
            layer.visible ?? true,
            [],
            true,
          ) as OlLayerTypes;
        } else {
          // This is to handle python sending a None for the color
          const layerOptions: any = {
            opacity: layerParameters.opacity,
            visible: layer.visible,
            source: geoTiffSource,
          };

          if (layerParameters.color) {
            layerOptions['style'] = {
              color: layerParameters.color,
            };
          }

          newMapLayer = new RasterLayer(layerOptions);
        }
        break;
      }
      case 'GeoZarrLayer': {
        layerParameters = layer.parameters as IGeoZarrLayer;
        const geoZarrSource = this._sources.get(layerParameters.source);

        await this._waitForSourceReady(geoZarrSource);

        if (Array.isArray(layerParameters.symbologyState?.layers)) {
          newMapLayer = grammarToOLLayer(
            layerParameters.symbologyState as IGrammarSymbologyState,
            geoZarrSource,
            layerParameters.opacity ?? 1,
            layer.visible ?? true,
            [],
            true,
          ) as OlLayerTypes;
        } else {
          const bands = source?.parameters?.bands || [];
          const defaultColor = buildZarrColorStyle(bands);

          newMapLayer = new RasterLayer({
            opacity: layerParameters.opacity ?? 1,
            visible: layer.visible,
            source: geoZarrSource,
            style: {
              gamma: layerParameters.gamma ?? 1,
              color: layerParameters.color ?? defaultColor,
            },
          });
        }

        break;
      }

      case 'StacLayer': {
        layerParameters = layer.parameters as IStacLayer;

        newMapLayer = new StacLayer({
          displayPreview: true,
          data: layerParameters.data,
          opacity: layerParameters.opacity,
          visible: layer.visible,
          assets: Object.keys(layerParameters.data.assets),
          extent: layerParameters.data.bbox,
        });

        break;
      }

      case 'StorySegmentLayer': {
        // Special layer not for this
        return;
      }
    }

    // OpenLayers doesn't have name/id field so add it
    newMapLayer.set('id', id);

    // STAC layers don't have source
    if (newMapLayer instanceof Layer) {
      // we need to keep track of which source has which layers
      // Only set sourceToLayerMap if 'source' exists on layerParameters
      if ('source' in layerParameters) {
        this._sourceToLayerMap.set(layerParameters.source, id);
      }

      this.addProjection(newMapLayer);
      await this._waitForLayerReady(newMapLayer);
    }

    this._loadingLayers.delete(id);

    return newMapLayer;
  }

  // Used by VectorTileLayer (which shares a flat-style API with Grammar output).
  vectorLayerStyleRuleBuilder = (layer: IJGISLayer) => {
    const layerParams = layer.parameters as IVectorLayer | undefined;
    const ss = layerParams?.symbologyState;
    if (!ss || Object.keys(ss).length === 0) {
      return [{ style: DEFAULT_FLAT_STYLE }];
    }

    const flatStyle = grammarToOLStyle(
      layerParams.symbologyState as IGrammarSymbologyState,
      [],
    );

    const layerStyle: Rule = { style: flatStyle };

    if (layer.filters?.logicalOp && layer.filters.appliedFilters?.length > 0) {
      const buildCondition = (filter: IJGISFilterItem): any[] => {
        const base = [filter.operator, ['get', filter.feature]];
        return filter.operator === 'between'
          ? [...base, filter.betweenMin, filter.betweenMax]
          : [...base, filter.value];
      };

      layerStyle.filter =
        layer.filters.appliedFilters.length === 1
          ? buildCondition(layer.filters.appliedFilters[0])
          : [
              layer.filters.logicalOp,
              ...layer.filters.appliedFilters.map(buildCondition),
            ];
    }

    return [layerStyle];
  };

  createSelectInteraction = () => {
    const selectInteraction = new Select({
      hitTolerance: 3,
      multi: true,
      layers: layer => {
        const localState = this._model?.sharedModel.awareness.getLocalState();
        const selectedLayers = localState?.selected?.value;

        if (!selectedLayers) {
          return false;
        }
        const selectedLayerId = Object.keys(selectedLayers)[0];
        const expected = this.getLayer(selectedLayerId);
        if (layer === expected) {
          return true;
        }
        // Grammar multi-layer symbology wraps sub-layers in a LayerGroup.
        // OL Select flattens groups, so we receive leaf layers, not the group.
        if (expected instanceof LayerGroup) {
          return expected.getLayers().getArray().includes(layer);
        }
        return false;
      },
      condition: (event: MapBrowserEvent<any>) => {
        return singleClick(event) && this._model.currentMode === 'identifying';
      },
      // Use the layer's own style so selected features keep their original
      // appearance.  Visual highlight feedback comes from _highlightLayer.
      style: null,
    });

    selectInteraction.on('select', event => {
      const identifiedFeatures: IIdentifiedFeatureEntry[] = [];
      const highlightFeatures: Feature[] = [];

      // Look up the selected layer's style function for adaptive highlights.
      const localState = this._model?.sharedModel.awareness.getLocalState();
      const selectedLayers = localState?.selected?.value;
      const selectedLayerId = selectedLayers
        ? Object.keys(selectedLayers)[0]
        : undefined;
      const mapLayer = selectedLayerId
        ? this.getLayer(selectedLayerId)
        : undefined;

      // For LayerGroup (multi-layer grammar), collect style functions from
      // all sub-layers so we can match the right one per feature.
      const styleFnCandidates: ReturnType<VectorLayer['getStyleFunction']>[] =
        [];
      if (mapLayer instanceof LayerGroup) {
        for (const sub of mapLayer.getLayers().getArray()) {
          if ('getStyleFunction' in sub) {
            styleFnCandidates.push((sub as VectorLayer).getStyleFunction());
          }
        }
      } else if (mapLayer && 'getStyleFunction' in mapLayer) {
        styleFnCandidates.push((mapLayer as VectorLayer).getStyleFunction());
      }
      const resolution = this._map.getView().getResolution() ?? 1;

      selectInteraction.getFeatures().forEach(feature => {
        identifiedFeatures.push({
          feature: feature.getProperties(),
          floaterOpen: false,
        });
        const geom = feature.getGeometry();
        if (geom) {
          const hlFeature = new Feature({ geometry: geom });
          // Try each style function candidate; use the first that resolves
          // a non-empty style array (important for LayerGroup sub-layers
          // where only one sub-layer's style applies to this feature).
          for (const fn of styleFnCandidates) {
            if (!fn) {
              continue;
            }
            const resolved = fn(feature, resolution);
            const styles = Array.isArray(resolved)
              ? resolved
              : resolved
                ? [resolved]
                : [];
            if (styles.length > 0) {
              const gType = geom.getType();
              hlFeature.setStyle(
                styles.map(s => this._buildHighlightStyle(s, gType)),
              );
              break;
            }
          }
          highlightFeatures.push(hlFeature);
        }
      });

      this._model.syncIdentifiedFeatures(
        identifiedFeatures,
        this._mainViewModel.id,
      );

      // Sync _highlightLayer with the current selection (clears on deselect).
      this._setHighlightFeatures(highlightFeatures);
    });

    this._map.addInteraction(selectInteraction);
  };

  /**
   * Replace the highlight layer contents with pre-styled features.
   * Each feature carries its own highlight style via feature.setStyle().
   */
  private _setHighlightFeatures(features: Feature[]): void {
    this.secureHighlightLayer();
    const source = this._highlightLayerRef.current?.getSource();
    source?.clear();
    for (const f of features) {
      source?.addFeature(f);
    }
  }
  private _buildHighlightStyle(original: Style, geomType?: string): Style {
    return buildHighlightStyle(original, geomType);
  }

  secureHighlightLayer(): void {
    ensureHighlightLayer(this._map, this._highlightLayerRef);
  }

  private ensureProjectionRegistered(projectionCode: string): void {
    const hasProj4Definition = Boolean(proj4.defs(projectionCode));
    if (!hasProj4Definition) {
      // Check if the projection exists in proj4list
      const proj4Definition = proj4list[projectionCode];
      if (!proj4Definition) {
        this._log(
          'warning',
          `Projection code '${projectionCode}' not found in proj4list`,
        );
        return;
      }

      try {
        if (Array.isArray(proj4Definition)) {
          proj4.defs([proj4Definition]);
        } else {
          proj4.defs(projectionCode, proj4Definition);
        }
      } catch (error: any) {
        this._log(
          'warning',
          `Failed to register projection '${projectionCode}'. Error: ${error.message}`,
        );
        return;
      }
    }

    // Always register after ensuring proj4 defs exist so OL transform functions
    // are available even when the projection object already exists in cache.
    register(proj4 as any);
  }

  private resolveLayerSourceProjection(layer: IJGISLayer): string | undefined {
    const sourceId = layer.parameters?.source;
    if (!sourceId) {
      return;
    }

    const source = this._model.sharedModel.getLayerSource(sourceId);
    if (!source) {
      return;
    }

    const parameters = source.parameters;
    return parameters?.projection;
  }

  addProjection(target: Layer | IJGISLayer): void {
    if (target instanceof Layer) {
      const sourceProjection = target.getSource()?.getProjection();
      if (!sourceProjection) {
        this._log('warning', 'Layer source projection is undefined or invalid');
        return;
      }

      this.ensureProjectionRegistered(sourceProjection.getCode());
      return;
    }

    const projectionCode = this.resolveLayerSourceProjection(target);
    if (!projectionCode) {
      return;
    }

    this.ensureProjectionRegistered(projectionCode);
  }

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------

  /**
   * Add a layer to the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   * @param index - expected index of the layer.
   */
  async addLayer(id: string, layer: IJGISLayer, index: number): Promise<void> {
    if (this.getLayer(id)) {
      return;
    }

    try {
      const newMapLayer = await this._buildMapLayer(id, layer);

      if (newMapLayer !== undefined) {
        await this._waitForReady();

        const numLayers = this._map.getLayers().getLength();
        const safeIndex = Math.min(index, numLayers);

        this._map.getLayers().insertAt(safeIndex, newMapLayer);
        this.trackLayerViewState(id, newMapLayer);
      }

      if (layer.type !== 'StorySegmentLayer') {
        this._model.syncSelected(
          { [id]: { type: 'layer' } },
          this._model.getClientId().toString(),
        );
      }
    } catch (error: any) {
      await showErrorMessage(
        `Error Adding ${layer.name}`,
        `Failed to add ${layer.name}: ${error.message || 'invalid file path'}`,
      );

      throw error;
    }
  }

  /**
   * Wait for all layers to be loaded.
   */
  private _waitForReady(): Promise<void> {
    return new Promise(resolve => {
      const checkReady = () => {
        if (this._loadingLayers.size === 0) {
          // this.setState(old => ({
          //   ...old,
          // loadingLayer: false,
          // }));
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };

      checkReady();
    });
  }

  /**
   * Wait for a layers source state to be 'ready'
   * @param layer The Layer to check
   */
  private _waitForLayerReady(layer: Layer | LayerGroup) {
    return new Promise<void>((resolve, reject) => {
      const checkState = () => {
        const state = layer.getSourceState();
        if (state === 'ready') {
          layer.un('change', checkState);
          resolve();
        } else if (state === 'error') {
          layer.un('change', checkState);
          reject(new Error('Layer failed to load.'));
        }
      };

      // Listen for state changes
      layer.on('change', checkState);

      // Check the state immediately in case it's already 'ready'
      checkState();
    });
  }

  /**
   * Wait for a source to finish loading and configuring
   * @param source The Source to check
   */
  private _waitForSourceReady(source: Source) {
    return new Promise<void>((resolve, reject) => {
      const checkState = () => {
        const state = source.getState();
        if (state === 'ready') {
          source.un('change', checkState);
          resolve();
        } else if (state === 'error') {
          source.un('change', checkState);
          reject(new Error('Source failed to load'));
        }
      };

      // Listen for state changes
      source.on('change', checkState);

      // Check immediately in case already ready
      checkState();
    });
  }

  /**
   * Remove a layer from the map.
   *
   * @param id - the id of the layer.
   */
  removeLayer(id: string): void {
    const mapLayer = this.getLayer(id);
    if (mapLayer) {
      this._map.removeLayer(mapLayer);
    }
  }

  /**
   * Update a layer of the map.
   *
   * Only for updating appearance -- opacity or style.
   * For vector layers, the whole layer is replaced.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   */
  async updateLayer(
    id: string,
    layer: IJGISLayer,
    mapLayer: Layer,
    oldLayer?: IDict,
  ): Promise<void> {
    layer.type !== 'StorySegmentLayer' && mapLayer.setVisible(layer.visible);

    switch (layer.type) {
      case 'RasterLayer': {
        mapLayer.setOpacity(layer.parameters?.opacity ?? 1);
        break;
      }
      case 'VectorLayer': {
        const layerParams = layer.parameters as IVectorLayer;

        if (Array.isArray(layerParams.symbologyState?.layers)) {
          this._syncGrammarSubLayers(id, layer, mapLayer as Layer | LayerGroup);
          break;
        }

        mapLayer.setOpacity(layerParams.opacity ?? 1);

        (mapLayer as VectorImageLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer),
        );

        break;
      }
      case 'VectorTileLayer': {
        const layerParams = layer.parameters as IVectorTileLayer;

        mapLayer.setOpacity(layerParams.opacity ?? 1);

        (mapLayer as VectorTileLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer),
        );

        break;
      }
      case 'HillshadeLayer': {
        // TODO figure out color here
        mapLayer.setOpacity(layer.parameters?.opacity ?? 0.3);
        break;
      }
      case 'ImageLayer': {
        mapLayer.setOpacity(layer.parameters?.opacity ?? 1);
        break;
      }
      case 'GeoTiffLayer': {
        if (Array.isArray(layer?.parameters?.symbologyState?.layers)) {
          this._syncGrammarSubLayers(id, layer, mapLayer as Layer | LayerGroup);
        } else {
          mapLayer.setOpacity(layer.parameters?.opacity);
          if (layer?.parameters?.color) {
            (mapLayer as RasterLayer).setStyle({
              color: layer.parameters.color,
            });
          }
        }
        break;
      }
      case 'GeoZarrLayer': {
        if (Array.isArray(layer?.parameters?.symbologyState?.layers)) {
          this._syncGrammarSubLayers(id, layer, mapLayer as Layer | LayerGroup);
          break;
        }

        if (layer?.parameters?.opacity !== undefined) {
          mapLayer.setOpacity(layer.parameters?.opacity);
        }

        const source = this._model.getSource(layer?.parameters?.source);
        const bands = (source?.parameters as any)?.bands || [];

        const style: any = {
          color: layer.parameters?.color ?? buildZarrColorStyle(bands),
          gamma: layer.parameters?.gamma ?? 1,
        };

        (mapLayer as RasterLayer).setStyle(style);

        break;
      }
      case 'OpenEOTileLayer': {
        const layerParams = layer.parameters as IOpenEOTileLayer;
        const openeoLayer = mapLayer as OpenEOTileLayer;

        openeoLayer.setOpacity(layerParams.opacity ?? 1);

        break;
      }
      case 'StacLayer':
        mapLayer.setOpacity(layer.parameters?.opacity ?? 1);
        break;
    }
  }

  /**
   * Convenience method to get list layer IDs from the OpenLayers Map
   */
  getLayerIDs(): string[] {
    return this._map
      .getLayers()
      .getArray()
      .map(layer => layer.get('id'));
  }

  /**
   * Move layer `id` in the stack to `index`.
   *
   * @param id - id of the layer.
   * @param index - expected index of the layer.
   */
  moveLayer(layerId: string, index: number): void {
    if (!this._map) {
      return;
    }

    const currentIndex = this.getLayerIndex(layerId);

    if (currentIndex === -1 || currentIndex === index) {
      return;
    }

    const collection = this._map.getLayers();
    const layer = collection.removeAt(currentIndex);

    if (!layer) {
      return;
    }

    collection.insertAt(index, layer);
  }

  /**
   * Convenience method to get a specific layer from OpenLayers Map
   * @param id Layer to retrieve
   */
  getLayer(id: string) {
    return this._map
      .getLayers()
      .getArray()
      .find(layer => layer.get('id') === id) as Layer;
  }

  /**
   * Convenience method to get a specific layer index from OpenLayers Map
   * @param id Layer to retrieve
   */
  private getLayerIndex(id: string) {
    return this._map
      .getLayers()
      .getArray()
      .findIndex(layer => layer.get('id') === id);
  }

  /**
   * Add a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  async addSource(id: string, source: IJGISSource): Promise<void> {
    this._log('info', `Loading source "${source.name ?? id}" (${source.type})`);
    let newSource;

    try {
      switch (source.type) {
        case 'RasterSource': {
          const sourceParameters = source.parameters as IRasterSource;

          const pmTiles =
            sourceParameters.url.endsWith('.pmtiles') ||
            sourceParameters.url.endsWith('pmtiles.gz');
          const url = this.computeSourceUrl(source);

          if (!pmTiles) {
            newSource = new XYZSource({
              interpolate: sourceParameters.interpolate,
              attributions: sourceParameters.attribution,
              minZoom: sourceParameters.minZoom,
              maxZoom: sourceParameters.maxZoom,
              tileSize: 256,
              url: url,
            });
          } else {
            newSource = new PMTilesRasterSource({
              interpolate: sourceParameters.interpolate,
              attributions: sourceParameters.attribution,
              tileSize: 256,
              url: url,
            });
          }

          break;
        }

        case 'RasterDemSource': {
          const sourceParameters = source.parameters as IRasterDemSource;

          newSource = new ImageTileSource({
            interpolate: sourceParameters.interpolate,
            url: this.computeSourceUrl(source),
            attributions: sourceParameters.attribution,
          });

          break;
        }

        case 'VectorTileSource': {
          const sourceParameters = source.parameters as IVectorTileSource;

          const pmTiles =
            sourceParameters.url.endsWith('.pmtiles') ||
            sourceParameters.url.endsWith('pmtiles.gz');
          const url = this.computeSourceUrl(source);

          if (!pmTiles) {
            const vtSourceOptions: ConstructorParameters<
              typeof VectorTileSource
            >[0] = {
              attributions: sourceParameters.attribution,
              minZoom: sourceParameters.minZoom,
              maxZoom: sourceParameters.maxZoom,
              url: url,
              format: new MVT({
                featureClass: RenderFeature,
              }),
            };

            if (sourceParameters.useProxy) {
              const extraHeaders = sourceParameters.httpHeaders ?? {};
              const headersParam =
                Object.keys(extraHeaders).length > 0
                  ? `&headers=${encodeURIComponent(JSON.stringify(extraHeaders))}`
                  : '';

              const proxyBase = isJupyterLite()
                ? `${this._model.jgisSettings.proxyUrl}/`
                : `${INTERNAL_PROXY_BASE}`;

              vtSourceOptions.tileLoadFunction = (tile, tileUrl) => {
                const vtTile = tile as VectorTile<RenderFeature>;
                const proxyUrl = `${proxyBase}?url=${encodeURIComponent(tileUrl)}${headersParam}`;
                vtTile.setLoader((extent, _resolution, projection) => {
                  return fetch(proxyUrl)
                    .then(response => {
                      if (!response.ok) {
                        throw new Error(
                          `Tile proxy request failed: ${response.status} ${response.statusText}`,
                        );
                      }
                      return response.arrayBuffer();
                    })
                    .then(data => {
                      const features = vtTile.getFormat().readFeatures(data, {
                        extent,
                        featureProjection: projection,
                      });
                      vtTile.setFeatures(features);
                      this._log('debug', `Proxy tile loaded: ${tileUrl}`);
                      return features;
                    })
                    .catch((err: any) => {
                      this._log(
                        'error',
                        `Proxy tile error for ${tileUrl}: ${err.message}`,
                      );
                      tile.setState(TileState.ERROR);
                      return [];
                    });
                });
              };
            }

            newSource = new VectorTileSource(vtSourceOptions);
          } else {
            newSource = new PMTilesVectorSource({
              attributions: sourceParameters.attribution,
              url: url,
            });
          }

          newSource.on('tileloadend', (event: TileSourceEvent) => {
            const tile = event.tile as VectorTile<FeatureLike>;
            const features = tile.getFeatures();

            if (features && features.length > 0) {
              this._model.syncTileFeatures({
                sourceId: id,
                features,
              });
            }
          });

          break;
        }

        case 'OpenEOTileSource': {
          const sourceParameters = source.parameters as IOpenEOTileSource;

          newSource = new OpenEOTileSource({
            serverUrl: sourceParameters.serverUrl ?? '',
            authBearer: sourceParameters.authBearer,
            processGraph: sourceParameters.processGraph,
          });

          break;
        }

        case 'GeoJSONSource': {
          const data =
            source.parameters?.data ||
            (await loadFile({
              filepath: source.parameters?.path,
              type: 'GeoJSONSource',
              model: this._model,
            }));

          const format = new GeoJSON({
            featureProjection: this._map.getView().getProjection(),
          });

          const featureArray = format.readFeatures(data, {
            featureProjection: this._map.getView().getProjection(),
          });

          const featureCollection = new Collection(featureArray);

          featureCollection.forEach(feature => {
            feature.setId(getUid(feature));
          });

          newSource = new VectorSource({
            features: featureCollection,
          });

          break;
        }

        case 'ShapefileSource': {
          const parameters = source.parameters as IShapefileSource;

          const geojson = await loadFile({
            filepath: parameters.path,
            type: 'ShapefileSource',
            model: this._model,
          });

          const geojsonData = Array.isArray(geojson) ? geojson[0] : geojson;

          const format = new GeoJSON();

          newSource = new VectorSource({
            features: format.readFeatures(geojsonData, {
              dataProjection: 'EPSG:4326',
              featureProjection: this._map.getView().getProjection(),
            }),
          });
          break;
        }

        case 'ImageSource': {
          const sourceParameters = source.parameters as IImageSource;

          // Convert lon/lat array to extent
          // Get lon/lat from source coordinates
          const leftSide = Math.min(
            ...sourceParameters.coordinates.map(corner => corner[0]),
          );
          const bottomSide = Math.min(
            ...sourceParameters.coordinates.map(corner => corner[1]),
          );
          const rightSide = Math.max(
            ...sourceParameters.coordinates.map(corner => corner[0]),
          );
          const topSide = Math.max(
            ...sourceParameters.coordinates.map(corner => corner[1]),
          );

          // Convert lon/lat to OpenLayer coordinates
          const topLeft = fromLonLat([leftSide, topSide]);
          const bottomRight = fromLonLat([rightSide, bottomSide]);

          // Get extent from coordinates
          const minX = topLeft[0];
          const maxY = topLeft[1];
          const maxX = bottomRight[0];
          const minY = bottomRight[1];

          const extent = [minX, minY, maxX, maxY];

          const imageUrl = await loadFile({
            filepath: sourceParameters.path,
            type: 'ImageSource',
            model: this._model,
          });

          newSource = new Static({
            interpolate: sourceParameters.interpolate,
            imageExtent: extent,
            url: imageUrl,
            crossOrigin: '',
          });

          break;
        }

        case 'GeoTiffSource': {
          const sourceParameters = source.parameters as IGeoTiffSource;

          const addNoData = (url: (typeof sourceParameters.urls)[0]) => {
            return { ...url, nodata: 0 };
          };
          const sources = await Promise.all(
            sourceParameters.urls.map(async sourceInfo => {
              const isRemote =
                sourceInfo.url?.startsWith('http://') ||
                sourceInfo.url?.startsWith('https://');
              const isDataUrl = sourceInfo.url?.startsWith('data:');

              if (isRemote) {
                return {
                  ...addNoData(sourceInfo),
                  url: sourceInfo.url,
                };
              } else if (isDataUrl) {
                // Inline base64 GeoTIFF embedded in the .jGIS doc.
                const blob = await (await fetch(sourceInfo.url!)).blob();
                return {
                  ...addNoData(sourceInfo),
                  url: URL.createObjectURL(blob),
                };
              } else {
                const geotiff = await loadFile({
                  filepath: sourceInfo.url ?? '',
                  type: 'GeoTiffSource',
                  model: this._model,
                });
                return {
                  ...addNoData(sourceInfo),
                  geotiff,
                  url: URL.createObjectURL(geotiff.file),
                };
              }
            }),
          );

          newSource = new GeoTIFFSource({
            interpolate: sourceParameters.interpolate,
            sources,
            normalize: sourceParameters.normalize,
            wrapX: sourceParameters.wrapX,
            ...(sourceParameters.projection
              ? { projection: sourceParameters.projection }
              : {}),
          });

          break;
        }

        case 'GeoZarrSource': {
          const sourceParameters = source.parameters as IGeoZarrSource;

          let bands: string[] = sourceParameters.bands || [];

          if (bands.length === 0) {
            let bandInfo: IZarrBandInfo[] = [];

            try {
              bandInfo = await getBandInfoFromZarr(sourceParameters.url);
            } catch (err) {
              console.warn('Failed to auto-detect Zarr bands:', err);
            }

            if (bandInfo.length > 0) {
              bands = getDefaultRGBBands(bandInfo);

              // Persist to model for future loads
              const updatedSource: IJGISSource = {
                ...source,
                parameters: {
                  ...sourceParameters,
                  bands,
                },
              };

              this._model.sharedModel.updateSource(id, updatedSource);
            } else {
              console.warn('No bands detected from Zarr store');
              bands = sourceParameters.bands?.length
                ? sourceParameters.bands
                : ['b04', 'b03', 'b02'];
            }
          }

          newSource = new GeoZarr({
            url: sourceParameters.url,
            bands,
            wrapX: sourceParameters.wrapX,
          });

          break;
        }

        case 'GeoPackageVectorSource': {
          const sourceParameters = source.parameters;

          if (!sourceParameters) {
            throw new Error('GeoPackageSource has no parameters');
          }

          const tableMap = await loadFile({
            filepath: sourceParameters.path,
            type: 'GeoPackageVectorSource',
            model: this._model,
          });

          const table = tableMap[sourceParameters.tables];
          const vectorSource = table.source;
          vectorSource['projection'] = getProjection(
            sourceParameters.projection,
          );
          newSource = vectorSource;
          break;
        }

        case 'GeoPackageRasterSource': {
          const sourceParameters = source.parameters;

          if (!sourceParameters) {
            throw new Error('GeoPackageSource has no parameters');
          }

          const tableMap = await loadFile({
            filepath: sourceParameters.path,
            type: 'GeoPackageRasterSource',
            model: this._model,
          });

          const { gpr, tileDao } = tableMap[sourceParameters.tables];

          const rasterSource = new XYZSource({
            minZoom: sourceParameters.minZoom ?? tileDao.minWebMapZoom,
            maxZoom: sourceParameters.maxZoom ?? tileDao.maxWebMapZoom,
            interpolate: sourceParameters.interpolate,
            url: '{z},{x},{y}',
            tileLoadFunction(tile: any, src) {
              const [z, x, y] = src.split(',').map(Number);
              gpr
                .getTile(x, y, z)
                .then((dataUri: any) => (tile.getImage().src = dataUri));
            },
            attributions: sourceParameters.attribution,
          });

          newSource = rasterSource;
          break;
        }

        case 'GeoParquetSource': {
          const parameters = source.parameters as IGeoParquetSource;

          const geojson = await loadFile({
            filepath: parameters.path,
            type: 'GeoParquetSource',
            model: this._model,
          });

          const geojsonData = Array.isArray(geojson) ? geojson[0] : geojson;

          const format = new GeoJSON();

          newSource = new VectorSource({
            features: format.readFeatures(geojsonData, {
              dataProjection: parameters.projection,
              featureProjection: this._map.getView().getProjection(),
            }),
          });
          break;
        }

        case 'MarkerSource': {
          const parameters = source.parameters as IMarkerSource;

          const point = new Point(parameters.feature.coords);
          const marker = new Feature({
            type: 'icon',
            geometry: point,
          });

          // Replace color placeholder in SVG with the parameter color
          const markerColor = parameters.color || '#3463a0';
          const svgString = markerIcon.svgstr
            .replace('{{COLOR}}', markerColor)
            .replace('<svg', '<svg width="128" height="128"');

          const iconStyle = new Style({
            image: new Icon({
              src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`,
              scale: 0.25,
              anchor: [0.5, 1],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
            }),
          });

          marker.setStyle(iconStyle);

          newSource = new VectorSource({
            features: [marker],
          });

          break;
        }

        case 'WmsTileSource': {
          const sourceParameters = source.parameters as IWmsTileSource;
          const url = sourceParameters.url;
          const selectedLayer = sourceParameters?.params?.layers;

          newSource = new TileWMSSource({
            attributions: sourceParameters?.attribution,
            url,
            params: {
              LAYERS: selectedLayer,
              TILED: true,
            },
          });

          break;
        }
      }
    } catch (err: any) {
      this._log(
        'error',
        `Failed to load source "${source.name ?? id}" (${source.type}): ${err.message}`,
      );
      return;
    }

    this._log(
      'info',
      `Source "${source.name ?? id}" (${source.type}) loaded successfully`,
    );
    newSource.set('id', id);

    // Forward OL tile/feature load errors to the JupyterLab log console.
    // These errors (CORS failures, network errors, etc.) are written directly
    // by the browser to DevTools and cannot be captured by console patching —
    // OL's own events are the only reliable interception point.
    newSource.on('tileloaderror', (evt: any) => {
      const url = evt?.tile?.getKey?.() ?? '';
      this._log(
        'error',
        `Tile load error for source "${id}"${url ? ': ' + url : ''}`,
      );
    });
    newSource.on('featuresloaderror', () => {
      this._log('error', `Features load error for source "${id}"`);
    });

    // _sources is a list of OpenLayers sources
    this._sources.set(id, newSource);

    this._trackSourceExtZoom(id, newSource);
  }

  /**
   * Remove a source from the map.
   *
   * @param id - the source id.
   */
  removeSource(id: string): void {
    this._sources.delete(id);
  }

  /**
   * Add or move the layers of the map.
   *
   * @param layerIds - the list of layers in the depth order (beneath first).
   */
  updateLayers(layerIds: string[]): void {
    this.updateLayersImpl(layerIds);
  }

  /**
   * Updates the position and existence of layers in the OL map based on the layer IDs.
   *
   * @param layerIds - An array of layer IDs that should be present on the map.
   * @returns {} Nothing is returned.
   */
  async updateLayersImpl(layerIds: string[]): Promise<void> {
    // get layers that are currently on the OL map
    const previousLayerIds = this.getLayerIDs();

    // Iterate over the new layer IDs:
    //   * Add layers to the map that are present in the list but not the map.
    //   * Remove layers from the map that are present in the map but not the list.
    //   * Update layer positions to match the list.
    for (
      let targetLayerPosition = 0;
      targetLayerPosition < layerIds.length;
      targetLayerPosition++
    ) {
      const layerId = layerIds[targetLayerPosition];
      const layer = this._model.sharedModel.getLayer(layerId);

      if (this._loadingLayers.has(layerId)) {
        continue;
      }

      if (!layer) {
        this._log(
          'warning',
          `Layer with ID ${layerId} does not exist in the shared model.`,
        );
        continue;
      }

      const mapLayer = this.getLayer(layerId);

      if (mapLayer !== undefined) {
        this.moveLayer(layerId, targetLayerPosition);
      } else {
        await this.addLayer(layerId, layer, targetLayerPosition);
      }

      const previousIndex = previousLayerIds.indexOf(layerId);
      if (previousIndex > -1) {
        previousLayerIds.splice(previousIndex, 1);
      }
    }

    // Remove layers that are no longer in the `layerIds` list.
    previousLayerIds.forEach(layerId => {
      const layer = this.getLayer(layerId);
      if (layer !== undefined) {
        this._map.removeLayer(layer);
      }
    });

    this._ready = true;

    // If a "zoom to layer" request arrived before its layer was on the map,
    // retry now that layers have been (re)built.
    if (
      this._pendingZoomLayerId &&
      this.getLayer(this._pendingZoomLayerId) !== undefined
    ) {
      const pendingId = this._pendingZoomLayerId;
      this._pendingZoomLayerId = null;
      this.onZoomToPosition(this._model, pendingId);
    }
  }

  // TODO this and flyToPosition need a rework
  onZoomToPosition(_: IJupyterGISModel, id: string) {
    // Check if the id is an annotation
    const annotation = this._model.annotationModel?.getAnnotation(id);
    if (annotation) {
      this.flyToPosition(annotation.position, annotation.zoom);
      return;
    }

    // The id is a layer
    const layer = this.getLayer(id);
    const source = layer?.getSource();
    const jgisLayer = this._model.getLayer(id);

    /**
     * Layer may be undefined in two cases:
     * 1. StorySegmentLayer: These layers don't have an associated OpenLayers layer
     * 2. StacLayer: When centerOnPosition is called immediately after adding the layer,
     *    the OpenLayers layer hasn't been created yet, so we use the bbox from the
     *    layer model's STAC data directly.
     */
    if (!layer) {
      // Handle StacLayer that hasn't been added to the map yet
      if (jgisLayer?.type === 'StacLayer') {
        const layerParams = jgisLayer.parameters as IStacLayer;
        const stacBbox = layerParams.data?.bbox;

        if (stacBbox && stacBbox.length === 4) {
          // STAC bbox format: [west, south, east, north] in EPSG:4326
          const [west, south, east, north] = stacBbox;
          const bboxExtent = [west, south, east, north];

          // Convert from EPSG:4326 to view projection
          const viewProjection = this._map.getView().getProjection();
          const transformedExtent =
            viewProjection.getCode() !== 'EPSG:4326'
              ? transformExtent(bboxExtent, 'EPSG:4326', viewProjection)
              : bboxExtent;

          this._map.getView().fit(transformedExtent, {
            size: this._map.getSize(),
            duration: 500,
            padding: [250, 250, 250, 250],
          });
          return;
        }
      }

      // Handle StorySegmentLayer
      if (jgisLayer?.type === 'StorySegmentLayer') {
        const layerParams = jgisLayer.parameters as IStorySegmentLayer;
        const coords = getCenter(layerParams.extent);

        // Don't move map if we're already centered on the segment
        const viewCenter = this._map.getView().getCenter();
        const centersEqual =
          viewCenter !== undefined &&
          Math.abs(viewCenter[0] - coords[0]) < 1e-9 &&
          Math.abs(viewCenter[1] - coords[1]) < 1e-9;
        if (centersEqual) {
          return;
        }

        this.flyToPosition(
          { x: coords[0], y: coords[1] },
          layerParams.zoom,
          (layerParams.transition.time ?? 1) * 1000, // seconds -> ms
          layerParams.transition.type,
        );

        return;
      }

      // Generic layer whose OpenLayers layer hasn't been created yet (e.g. a
      // layer just added via the Python API with zoom_to=True). Remember the
      // request and retry once the layer has been added to the map.
      if (jgisLayer) {
        this._pendingZoomLayerId = id;
        return;
      }
    }

    const extent = this._computeExtent(layer, source);
    if (!extent) {
      this._log('warning', 'Layer ${id} has no extent.');
      return;
    }

    if (!extent.every(value => Number.isFinite(value))) {
      this._log(
        'warning',
        `Layer ${id} has an invalid extent: ${extent.join(', ')}`,
      );
      return;
    }

    // Convert layer extent value to view projection if needed
    const sourceProjection = source?.getProjection();
    const viewProjection = this._map.getView().getProjection();

    const transformedExtent =
      sourceProjection && sourceProjection !== viewProjection
        ? transformExtent(extent, sourceProjection, viewProjection)
        : extent;
    if (!transformedExtent.every(value => Number.isFinite(value))) {
      this._log(
        'warning',
        `Layer ${id} has an invalid transformed extent: ${transformedExtent.join(', ')}`,
      );
      return;
    }

    this._map.getView().fit(transformedExtent, {
      size: this._map.getSize(),
      duration: 500,
    });
  }

  flyToPosition(
    center: { x: number; y: number },
    zoom: number,
    duration = 1000,
    transitionType?: 'linear' | 'immediate' | 'smooth',
  ) {
    const view = this._map.getView();

    // Cancel any in-progress animations before starting new ones
    view.cancelAnimations();

    const targetCenter: Coordinate = [center.x, center.y];

    if (transitionType === 'linear') {
      // Linear: direct zoom
      view.animate({
        center: targetCenter,
        zoom: zoom,
        duration,
      });

      return;
    }

    if (transitionType === 'smooth') {
      // Smooth: zoom out, center, and zoom in
      // Centering takes full duration, zoom out completes halfway, zoom in starts halfway
      // 3 shows most of the map
      const zoomOutLevel = 3;

      // Start centering (full duration) and zoom out (50% duration) simultaneously
      view.animate({
        center: targetCenter,
        duration: duration,
      });
      // Chain zoom out -> zoom in (zoom in starts when zoom out completes)
      view.animate(
        {
          zoom: zoomOutLevel,
          duration: duration * 0.5,
        },
        {
          zoom: zoom,
          duration: duration * 0.5,
        },
      );

      return;
    }

    // Immediate move
    view.setCenter(targetCenter);
    view.setZoom(zoom);
  }

  /**
   * Update a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  async updateSource(id: string, source: IJGISSource): Promise<void> {
    // get the layer id associated with this source
    const layerId = this._sourceToLayerMap.get(id);
    // get the OL layer
    const mapLayer = this.getLayer(layerId);
    if (!mapLayer) {
      return;
    }
    // remove source being updated
    this.removeSource(id);
    // create updated source
    await this.addSource(id, source);
    // change source of target layer
    mapLayer.setSource(this._sources.get(id));
  }

  private computeSourceUrl(source: IJGISSource): string {
    const parameters = source.parameters as IRasterSource;
    const urlParameters = parameters.urlParameters || {};
    let url: string = parameters.url;

    for (const parameterName of Object.keys(urlParameters)) {
      url = url.replace(`{${parameterName}}`, urlParameters[parameterName]);
    }

    // Special case for max_zoom and min_zoom
    if (url.includes('{max_zoom}')) {
      url = url.replace('{max_zoom}', parameters.maxZoom.toString());
    }
    if (url.includes('{min_zoom}')) {
      url = url.replace('{min_zoom}', parameters.minZoom.toString());
    }

    return url;
  }

  /**
   * Taken from https://openlayers.org/en/latest/examples/webgl-shaded-relief.html
   * @returns
   */
  private hillshadeMath = () => {
    // The method used to extract elevations from the DEM.
    // In this case the format used is Terrarium
    // red * 256 + green + blue / 256 - 32768
    //
    // Other frequently used methods include the Mapbox format
    // (red * 256 * 256 + green * 256 + blue) * 0.1 - 10000
    //
    function elevation(xOffset: number, yOffset: number) {
      const red = ['band', 1, xOffset, yOffset];
      const green = ['band', 2, xOffset, yOffset];
      const blue = ['band', 3, xOffset, yOffset];

      // band math operates on normalized values from 0-1
      // so we scale by 255
      return [
        '+',
        ['*', 255 * 256, red],
        ['*', 255, green],
        ['*', 255 / 256, blue],
        -32768,
      ];
    }
    // Generates a shaded relief image given elevation data.  Uses a 3x3
    // neighborhood for determining slope and aspect.
    const dp = ['*', 2, ['resolution']];
    const z0x = ['*', 2, elevation(-1, 0)];
    const z1x = ['*', 2, elevation(1, 0)];
    const dzdx = ['/', ['-', z1x, z0x], dp];
    const z0y = ['*', 2, elevation(0, -1)];
    const z1y = ['*', 2, elevation(0, 1)];
    const dzdy = ['/', ['-', z1y, z0y], dp];
    const slope = ['atan', ['sqrt', ['+', ['^', dzdx, 2], ['^', dzdy, 2]]]];
    const aspect = ['clamp', ['atan', ['-', 0, dzdx], dzdy], -Math.PI, Math.PI];
    const sunEl = ['*', Math.PI / 180, 45];
    const sunAz = ['*', Math.PI / 180, 46];

    const cosIncidence = [
      '+',
      ['*', ['sin', sunEl], ['cos', slope]],
      ['*', ['cos', sunEl], ['sin', slope], ['cos', ['-', sunAz, aspect]]],
    ];
    const scaled = ['*', 255, cosIncidence];

    return scaled;
  };

  private _syncGrammarSubLayers(
    id: string,
    layer: IJGISLayer,
    mapLayer: Layer | LayerGroup,
  ): void {
    const layerParams = layer.parameters as
      | IVectorLayer
      | IGeoTiffLayer
      | IGeoZarrLayer
      | undefined;
    const grammarState = layerParams?.symbologyState as
      | IGrammarSymbologyState
      | undefined;

    if (!grammarState || !Array.isArray(grammarState.layers)) {
      return;
    }

    const sourceId = layerParams?.source;
    const source = sourceId ? this._sources.get(sourceId) : undefined;
    const rows =
      source instanceof VectorSource
        ? source.getFeatures().map(f => (f as Feature).getProperties())
        : [];
    const featureValues = extractEncodingFieldValues(grammarState, rows);
    const nextLayer = grammarToOLLayer(
      grammarState,
      source,
      layerParams?.opacity ?? layer.parameters?.opacity ?? 1,
      layer.visible,
      featureValues,
      layer.type === 'GeoTiffLayer' || layer.type === 'GeoZarrLayer',
    );

    if (mapLayer instanceof LayerGroup) {
      if (nextLayer instanceof LayerGroup) {
        const replacementLayers = nextLayer.getLayers().getArray();
        mapLayer.setOpacity(
          layerParams?.opacity ?? layer.parameters?.opacity ?? 1,
        );
        mapLayer.setVisible(layer.visible);
        mapLayer.setLayers(new Collection(replacementLayers));
        return;
      }

      // Collapse back to a single top-level layer so tools that expect a
      // concrete OL Layer (fly-to/identify) keep working.
      nextLayer.set('id', id);
      const index = this.getLayerIndex(id);
      if (index !== -1) {
        this._map.getLayers().setAt(index, nextLayer);
      }
      return;
    }

    nextLayer.set('id', id);
    const index = this.getLayerIndex(id);
    if (index !== -1) {
      this._map.getLayers().setAt(index, nextLayer);
    }
  }

  /**
   * Compute extent for layer or source
   */
  private _computeExtent(
    layer?: Layer | StacLayer,
    source?: any,
  ): number[] | undefined {
    try {
      if (source instanceof VectorSource) {
        const extent = source.getExtent();
        if (extent) {
          return extent;
        }
      }

      if (source instanceof TileSource || source instanceof VectorTileSource) {
        const tileGrid = source.getTileGrid();
        const extent = tileGrid?.getExtent();
        if (extent) {
          return extent;
        }
      }

      if (layer instanceof StacLayer) {
        const extent = layer.getExtent();
        if (extent) {
          return extent;
        }
      }
    } catch (error) {
      this._log('warning', `Failed to compute extent: ${error}`);
    }

    return undefined;
  }

  private _computeZoomFromExtent(extent: number[]): number | null {
    if (!this._map) {
      return null;
    }

    const view = this._map.getView();
    const size = this._map.getSize() ?? this.getSize();

    const resolution = view.getResolutionForExtent(extent, size);
    const zoom = view.getZoomForResolution(resolution);

    return zoom ?? view.getZoom() ?? 0;
  }

  /**
   * Track source's extent and zoom in model's view state
   */
  private _trackSourceExtZoom(sourceId: string, olSource: Source): void {
    const extent = this._computeExtent(undefined, olSource);

    if (extent) {
      const projection = olSource?.getProjection?.()?.getCode?.();
      const zoom = this._computeZoomFromExtent(extent);

      if (zoom === null) {
        return;
      }

      const view: IViewState[string] = {
        extent,
        zoom,
        ...(projection && { projection }),
      };
      this._model.updateLayerViewState(sourceId, view);
    }
  }

  /**
   * Track layer's extent and zoom in model's view state
   */
  trackLayerViewState(layerId: string, olLayer: Layer | LayerGroup): void {
    const effectiveLayer =
      olLayer instanceof LayerGroup
        ? (olLayer.getLayers().getArray()[0] as Layer | undefined)
        : olLayer;
    if (!effectiveLayer) {
      return;
    }
    const source = effectiveLayer.getSource();
    const sourceId = source?.get?.('id');

    let extent = sourceId ? this._model.getExtent(sourceId) : undefined;

    if (!extent) {
      extent = this._computeExtent(effectiveLayer, source);
    }

    if (extent) {
      const zoom = this._computeZoomFromExtent(extent);

      if (zoom === null) {
        return;
      }

      const view: IViewState[string] = { extent, zoom };
      this._model.updateLayerViewState(layerId, view);
    }
  }

  /**
   * Temporary escape hatch while extraction is happening.
   *
   * This should eventually disappear once all OpenLayers-specific
   * operations have moved behind IMapViewer.
   */
  getMap(): OlMap | null {
    return this._map;
  }

  private _map: OlMap;
  private _sourceToLayerMap = new Map();
  private _sources = new Map<string, any>();
  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _pendingZoomLayerId: string | null = null;
  private _loggerRegistry?: ILoggerRegistry;
  private _loadingLayers: Set<string>;
  private _highlightLayerRef: {
    current: VectorImageLayer<VectorSource> | null;
  } = { current: null };

  private _log(
    level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
    message: string,
  ): void {
    // Always mirror to the browser console regardless of whether the JupyterLab
    // logger is available.
    if (level === 'error' || level === 'critical') {
      // eslint-disable-next-line no-console
      console.error(message);
    } else if (level === 'warning') {
      // eslint-disable-next-line no-console
      console.warn(message);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }

    // Forward to JupyterLab log console when available.
    this._loggerRegistry
      ?.getLogger(this._model.filePath)
      .log({ type: 'text', level, data: message });
  }
}
