import { MapChange } from '@jupyter/ydoc';
import {
  IGeoTiffSource,
  IHillshadeLayer,
  IImageLayer,
  IImageSource,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISOptions,
  IJGISSource,
  IJGISSourceDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  IRasterDemSource,
  IRasterLayer,
  IRasterSource,
  IShapefileSource,
  IVectorLayer,
  IVectorTileLayer,
  IVectorTileSource,
  IWebGlLayer,
  JupyterGISModel
} from '@jupytergis/schema';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue, ReadonlyPartialJSONObject, UUID } from '@lumino/coreutils';
import { Collection, Map as OlMap, View } from 'ol';
import { ScaleLine } from 'ol/control';
import { GeoJSON, MVT } from 'ol/format';
import DragAndDrop from 'ol/interaction/DragAndDrop';
import {
  Image as ImageLayer,
  Layer,
  Vector as VectorLayer,
  VectorTile as VectorTileLayer,
  WebGLTile as WebGlTileLayer
} from 'ol/layer';
import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat, toLonLat } from 'ol/proj';
import Feature from 'ol/render/Feature';
import {
  GeoTIFF as GeoTIFFSource,
  ImageTile as ImageTileSource,
  Vector as VectorSource,
  VectorTile as VectorTileSource,
  XYZ as XYZSource
} from 'ol/source';
import Static from 'ol/source/ImageStatic';
//@ts-expect-error no types for ol-pmtiles
import { PMTilesRasterSource, PMTilesVectorSource } from 'ol-pmtiles';
import { Rule } from 'ol/style/flat';
import * as React from 'react';
import shp from 'shpjs';
import { getGdal } from '../gdal';
import { GlobalStateDbManager } from '../store';
import { isLightTheme } from '../tools';
import { MainViewModel } from './mainviewmodel';
import { Spinner } from './spinner';

interface IProps {
  viewModel: MainViewModel;
}

interface IStates {
  id: string; // ID of the component, it is used to identify which component
  //is the source of awareness updates.
  loading: boolean;
  lightTheme: boolean;
  remoteUser?: User.IIdentity | null;
  firstLoad: boolean;
}

export class MainView extends React.Component<IProps, IStates> {
  constructor(props: IProps) {
    super(props);

    this._mainViewModel = this.props.viewModel;
    this._mainViewModel.viewSettingChanged.connect(this._onViewChanged, this);
    this._model = this._mainViewModel.jGISModel;
    this._model.themeChanged.connect(this._handleThemeChange, this);

    this._model.sharedOptionsChanged.connect(
      this._onSharedOptionsChanged,
      this
    );
    this._model.clientStateChanged.connect(
      this._onClientSharedStateChanged,
      this
    );

    this._model.sharedLayersChanged.connect(this._onLayersChanged, this);
    this._model.sharedLayerTreeChanged.connect(this._onLayerTreeChange, this);
    this._model.sharedSourcesChanged.connect(this._onSourcesChange, this);

    this.state = {
      id: this._mainViewModel.id,
      lightTheme: isLightTheme(),
      loading: true,
      firstLoad: true
    };

    this._sources = [];
  }

  async componentDidMount(): Promise<void> {
    window.addEventListener('resize', this._handleWindowResize);
    await this.generateScene();
    this._mainViewModel.initSignal();
  }

  componentWillUnmount(): void {
    window.removeEventListener('resize', this._handleWindowResize);
    this._mainViewModel.viewSettingChanged.disconnect(
      this._onViewChanged,
      this
    );

    this._model.themeChanged.disconnect(this._handleThemeChange, this);
    this._model.sharedOptionsChanged.disconnect(
      this._onSharedOptionsChanged,
      this
    );

    this._model.clientStateChanged.disconnect(
      this._onClientSharedStateChanged,
      this
    );

    this._mainViewModel.dispose();
  }

  async generateScene(): Promise<void> {
    if (this.divRef.current) {
      this._Map = new OlMap({
        target: this.divRef.current,
        layers: [],
        view: new View({
          center: [0, 0],
          zoom: 1
        }),
        controls: [new ScaleLine()]
      });

      const dragAndDropInteraction = new DragAndDrop({
        formatConstructors: [GeoJSON]
      });

      dragAndDropInteraction.on('addfeatures', event => {
        const sourceId = UUID.uuid4();

        const sourceModel: IJGISSource = {
          type: 'GeoJSONSource',
          name: 'Drag and Drop source',
          parameters: { path: event.file.name }
        };

        const layerId = UUID.uuid4();

        this.addSource(sourceId, sourceModel, layerId);

        this._model.sharedModel.addSource(sourceId, sourceModel);

        const layerModel: IJGISLayer = {
          type: 'VectorLayer',
          visible: true,
          name: 'Drag and Drop layer',
          parameters: {
            color: '#FF0000',
            opacity: 1.0,
            type: 'line',
            source: sourceId
          }
        };

        this.addLayer(layerId, layerModel, this.getLayers().length);
        this._model.addLayer(layerId, layerModel);
      });

      this._Map.addInteraction(dragAndDropInteraction);

      this._Map.on('moveend', () => {
        if (!this._initializedPosition) {
          return;
        }

        const currentOptions = this._model.getOptions();

        const view = this._Map.getView();
        const center = view.getCenter() || [0, 0];
        const zoom = view.getZoom() || 0;

        const projection = view.getProjection();
        const latLng = toLonLat(center, projection);
        const bearing = view.getRotation();

        const updatedOptions: Partial<IJGISOptions> = {
          latitude: latLng[1],
          longitude: latLng[0],
          bearing,
          projection: projection.getCode(),
          zoom
        };

        updatedOptions.extent = view.calculateExtent();

        this._model.setOptions({
          ...currentOptions,
          ...updatedOptions
        });
      });

      if (JupyterGISModel.getOrderedLayerIds(this._model).length !== 0) {
        await this._updateLayersImpl(
          JupyterGISModel.getOrderedLayerIds(this._model)
        );
        const options = this._model.getOptions();
        this.updateOptions(options);
        this._initializedPosition = true;
      }

      this.setState(old => ({ ...old, loading: false }));
    }
  }

  private async _loadShapefileAsGeoJSON(
    url: string
  ): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]> {
    try {
      const response = await fetch(`/jupytergis_core/proxy?url=${url}`);
      const arrayBuffer = await response.arrayBuffer();
      const geojson = await shp(arrayBuffer);

      return geojson;
    } catch (error) {
      console.error('Error loading shapefile:', error);
      throw error;
    }
  }

  /**
   * Add a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  async addSource(
    id: string,
    source: IJGISSource,
    layerId?: string
  ): Promise<void> {
    let newSource;

    switch (source.type) {
      case 'RasterSource': {
        const sourceParameters = source.parameters as IRasterSource;

        const pmTiles = sourceParameters.url.endsWith('.pmtiles');
        const url = this.computeSourceUrl(source);

        if (!pmTiles) {
          newSource = new XYZSource({
            attributions: sourceParameters.attribution,
            minZoom: sourceParameters.minZoom,
            maxZoom: sourceParameters.maxZoom,
            tileSize: 256,
            url: url
          });
        } else {
          newSource = new PMTilesRasterSource({
            attributions: sourceParameters.attribution,
            tileSize: 256,
            url: url
          });
        }

        break;
      }
      case 'RasterDemSource': {
        const sourceParameters = source.parameters as IRasterDemSource;

        newSource = new ImageTileSource({
          url: this.computeSourceUrl(source),
          attributions: sourceParameters.attribution
        });

        break;
      }
      case 'VectorTileSource': {
        const sourceParameters = source.parameters as IVectorTileSource;

        const pmTiles = sourceParameters.url.endsWith('.pmtiles');
        const url = this.computeSourceUrl(source);

        if (!pmTiles) {
          newSource = new VectorTileSource({
            attributions: sourceParameters.attribution,
            minZoom: sourceParameters.minZoom,
            maxZoom: sourceParameters.maxZoom,
            url: url,
            format: new MVT({ featureClass: Feature })
          });
        } else {
          newSource = new PMTilesVectorSource({
            attributions: sourceParameters.attribution,
            url: url
          });
        }

        break;
      }
      case 'GeoJSONSource': {
        const data =
          source.parameters?.data ||
          (await this._model.readGeoJSON(source.parameters?.path));

        const format = new GeoJSON({
          featureProjection: this._Map.getView().getProjection()
        });

        // TODO: Don't hardcode projection
        const featureArray = format.readFeatures(data, {
          dataProjection: 'EPSG:4326',
          featureProjection: this._Map.getView().getProjection()
        });

        const featureCollection = new Collection(featureArray);

        newSource = new VectorSource({
          features: featureCollection
        });

        break;
      }
      case 'ShapefileSource': {
        const parameters = source.parameters as IShapefileSource;

        const geojson = await this._loadShapefileAsGeoJSON(parameters.path);
        const geojsonData = Array.isArray(geojson) ? geojson[0] : geojson;

        const format = new GeoJSON();

        newSource = new VectorSource({
          features: format.readFeatures(geojsonData, {
            dataProjection: 'EPSG:4326',
            featureProjection: this._Map.getView().getProjection()
          })
        });
        break;
      }
      case 'ImageSource': {
        const sourceParameters = source.parameters as IImageSource;

        // Convert lon/lat array to extent
        // Get lon/lat from source coordinates
        const leftSide = Math.min(
          ...sourceParameters.coordinates.map(corner => corner[0])
        );
        const bottomSide = Math.min(
          ...sourceParameters.coordinates.map(corner => corner[1])
        );
        const rightSide = Math.max(
          ...sourceParameters.coordinates.map(corner => corner[0])
        );
        const topSide = Math.max(
          ...sourceParameters.coordinates.map(corner => corner[1])
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

        newSource = new Static({
          imageExtent: extent,
          url: sourceParameters.url,
          interpolate: true,
          crossOrigin: ''
        });

        break;
      }
      case 'VideoSource': {
        console.warn('Video Tiles not supported with Open Layers');

        break;
      }
      case 'GeoTiffSource': {
        const sourceParameters = source.parameters as IGeoTiffSource;

        const stateDb = GlobalStateDbManager.getInstance().getStateDb();

        if (stateDb) {
          const layerState = (await stateDb.fetch(
            `jupytergis:${layerId}`
          )) as ReadonlyPartialJSONObject;

          if (
            sourceParameters.urls[0].url &&
            (!layerState || !layerState.tifData)
          ) {
            // get GDAL info
            const Gdal = await getGdal();

            const fileData = await fetch(sourceParameters.urls[0].url);
            const file = new File([await fileData.blob()], 'loaded.tif');

            const result = await Gdal.open(file);
            const tifDataset = result.datasets[0];

            const tifData = await Gdal.gdalinfo(tifDataset, [
              '-stats',
              '-hist'
            ]);

            Gdal.close(tifDataset);

            stateDb.save(`jupytergis:${layerId}`, {
              ...layerState,
              tifData: JSON.stringify(tifData)
            });
          }
        }

        newSource = new GeoTIFFSource({
          sources: sourceParameters.urls,
          normalize: sourceParameters.normalize,
          wrapX: sourceParameters.wrapX
        });

        break;
      }
    }

    newSource.set('id', id);
    // _sources is a list of OpenLayers sources
    this._sources[id] = newSource;
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
    this.addSource(id, source, layerId);
    // change source of target layer
    (mapLayer as Layer).setSource(this._sources[id]);
  }

  /**
   * Remove a source from the map.
   *
   * @param id - the source id.
   */
  removeSource(id: string): void {
    delete this._sources[id];
  }

  /**
   * Add or move the layers of the map.
   *
   * @param layerIds - the list of layers in the depth order (beneath first).
   */
  updateLayers(layerIds: string[]): void {
    this._updateLayersImpl(layerIds);
  }

  private async _updateLayersImpl(layerIds: string[]): Promise<void> {
    const mapLayers: BaseLayer[] = [];
    for (const layerId of layerIds) {
      const layer = this._model.sharedModel.getLayer(layerId);

      if (!layer) {
        console.log(`Layer id ${layerId} does not exist`);
        continue;
      }
      const newMapLayer = await this._buildMapLayer(layerId, layer);
      if (newMapLayer !== undefined) {
        mapLayers.push(newMapLayer);
      }
    }
    this._Map.setLayers(mapLayers);
    this._ready = true;
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
    layer: IJGISLayer
  ): Promise<BaseLayer | undefined> {
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._sources[sourceId]) {
      await this.addSource(sourceId, source, id);
    }

    let newMapLayer;
    let layerParameters;

    // TODO: OpenLayers provides a bunch of sources for specific tile
    // providers, so maybe set up some way to use those
    switch (layer.type) {
      case 'RasterLayer': {
        layerParameters = layer.parameters as IRasterLayer;

        newMapLayer = new TileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source]
        });

        break;
      }
      case 'VectorLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        newMapLayer = new VectorLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          style: this.vectorLayerStyleRuleBuilder(layer)
        });

        break;
      }
      case 'VectorTileLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        newMapLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source]
        });

        this.updateLayer(id, layer, newMapLayer);

        break;
      }
      case 'HillshadeLayer': {
        layerParameters = layer.parameters as IHillshadeLayer;

        newMapLayer = new WebGlTileLayer({
          opacity: 0.3,
          source: this._sources[layerParameters.source],
          style: {
            color: ['color', this.hillshadeMath()]
          }
        });

        break;
      }
      case 'ImageLayer': {
        layerParameters = layer.parameters as IImageLayer;

        newMapLayer = new ImageLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source]
        });

        break;
      }
      case 'WebGlLayer': {
        layerParameters = layer.parameters as IWebGlLayer;

        // This is to handle python sending a None for the color
        const layerOptions: any = {
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source]
        };

        if (layerParameters.color) {
          layerOptions['style'] = { color: layerParameters.color };
        }

        newMapLayer = new WebGlTileLayer(layerOptions);

        break;
      }
    }

    // OpenLayers doesn't have name/id field so add it
    newMapLayer.set('id', id);

    // we need to keep track of which source has which layers
    this._sourceToLayerMap.set(layerParameters.source, id);

    return newMapLayer;
  }

  /**
   * Add a layer to the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   * @param index - expected index of the layer.
   */
  async addLayer(id: string, layer: IJGISLayer, index: number): Promise<void> {
    if (this.getLayer(id)) {
      // Layer already exists
      return;
    }

    const newMapLayer = await this._buildMapLayer(id, layer);
    if (newMapLayer !== undefined) {
      this._Map.getLayers().insertAt(index, newMapLayer);
    }
  }

  vectorLayerStyleRuleBuilder = (layer: IJGISLayer) => {
    const layerParams = layer.parameters;
    if (!layerParams) {
      return;
    }

    const defaultStyle = {
      'fill-color': 'rgba(255,255,255,0.4)',
      'stroke-color': '#3399CC',
      'stroke-width': 1.25,
      'circle-radius': 5,
      'circle-fill-color': 'rgba(255,255,255,0.4)',
      'circle-stroke-width': 1.25,
      'circle-stroke-color': '#3399CC'
    };

    const defaultRules: Rule = {
      style: defaultStyle
    };

    const layerStyle = { ...defaultRules };

    if (
      layer.filters &&
      layer.filters.logicalOp &&
      layer.filters.appliedFilters.length !== 0
    ) {
      const filterExpr: any[] = [];

      // 'Any' and 'All' operators require more than one argument
      // So if there's only one filter, skip that part to avoid error
      if (layer.filters.appliedFilters.length === 1) {
        layer.filters.appliedFilters.forEach(filter => {
          filterExpr.push(
            filter.operator,
            ['get', filter.feature],
            filter.value
          );
        });
      } else {
        filterExpr.push(layer.filters.logicalOp);

        // Arguments for "Any" and 'All' need to be wrapped in brackets
        layer.filters.appliedFilters.forEach(filter => {
          filterExpr.push([
            filter.operator,
            ['get', filter.feature],
            filter.value
          ]);
        });
      }

      layerStyle.filter = filterExpr;
    }

    if (!layerParams.color) {
      return [layerStyle];
    }

    const newStyle = { ...defaultStyle, ...layerParams.color };

    layerStyle.style = newStyle;

    return [layerStyle];
  };

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
        -32768
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
      ['*', ['cos', sunEl], ['sin', slope], ['cos', ['-', sunAz, aspect]]]
    ];
    const scaled = ['*', 255, cosIncidence];

    return scaled;
  };

  /**
   * Update a layer of the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   */
  async updateLayer(
    id: string,
    layer: IJGISLayer,
    mapLayer: BaseLayer
  ): Promise<void> {
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._sources[sourceId]) {
      await this.addSource(sourceId, source, id);
    }

    mapLayer.setVisible(layer.visible);

    switch (layer.type) {
      case 'RasterLayer': {
        mapLayer.setOpacity(layer.parameters?.opacity || 1);
        break;
      }
      case 'VectorLayer': {
        const layerParams = layer.parameters as IVectorLayer;

        mapLayer.setOpacity(layerParams.opacity || 1);

        (mapLayer as VectorLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer)
        );

        break;
      }
      case 'VectorTileLayer': {
        const layerParams = layer.parameters as IVectorTileLayer;

        mapLayer.setOpacity(layerParams.opacity || 1);

        (mapLayer as VectorTileLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer)
        );

        break;
      }
      case 'HillshadeLayer': {
        // TODO figure out color here
        break;
      }
      case 'ImageLayer': {
        break;
      }
      case 'WebGlLayer': {
        mapLayer.setOpacity(layer.parameters?.opacity);

        if (layer?.parameters?.color) {
          (mapLayer as WebGlTileLayer).setStyle({
            color: layer.parameters.color
          });
        }
        break;
      }
    }
  }

  /**
   * Remove a layer from the map.
   *
   * @param id - the id of the layer.
   */
  removeLayer(id: string): void {
    const mapLayer = this.getLayer(id);
    if (mapLayer) {
      this._Map.removeLayer(mapLayer);
    }
  }

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>
  ): void => {
    // TODO SOMETHING
  };

  private _onSharedOptionsChanged(
    sender?: IJupyterGISDoc,
    change?: MapChange
  ): void {
    if (!this._initializedPosition) {
      const options = this._model.getOptions();

      this.updateOptions(options);

      this._initializedPosition = true;
    }
  }

  private updateOptions(options: IJGISOptions) {
    const view = this._Map.getView();

    // Use the extent only if explicitly requested (QGIS files).
    if (options.extent && options.useExtent) {
      view.fit(options.extent);
    } else {
      const centerCoord = fromLonLat(
        [options.longitude || 0, options.latitude || 0],
        this._Map.getView().getProjection()
      );
      this._Map.getView().setZoom(options.zoom || 0);
      this._Map.getView().setCenter(centerCoord);

      // Save the extent if it does not exists, to allow proper export to qgis.
      if (options.extent === undefined) {
        options.extent = view.calculateExtent();
        this._model.setOptions(options);
      }
    }
    view.setRotation(options.bearing || 0);
  }

  private _onViewChanged(
    sender: ObservableMap<JSONValue>,
    change: IObservableMap.IChangedArgs<JSONValue>
  ): void {
    // TODO SOMETHING
  }

  /**
   * Convenience method to get a specific layer from OpenLayers Map
   * @param id Layer to retrieve
   */
  private getLayer(id: string) {
    return this._Map
      .getLayers()
      .getArray()
      .find(layer => layer.get('id') === id);
  }

  /**
   * Convenience method to get list layer IDs from the OpenLayers Map
   */
  private getLayers() {
    return this._Map
      .getLayers()
      .getArray()
      .map(layer => layer.get('id'));
  }

  private _onLayersChanged(
    _: IJupyterGISDoc,
    change: IJGISLayerDocChange
  ): void {
    // Avoid concurrency update on layers on first load, if layersTreeChanged and
    // LayersChanged are triggered simultaneously.
    if (!this._ready) {
      return;
    }
    change.layerChange?.forEach(change => {
      const layer = change.newValue;
      if (!layer || Object.keys(layer).length === 0) {
        this.removeLayer(change.id);
      } else {
        const mapLayer = this.getLayer(change.id);
        const layerTree = JupyterGISModel.getOrderedLayerIds(this._model);
        if (mapLayer) {
          if (layerTree.includes(change.id)) {
            this.updateLayer(change.id, layer, mapLayer);
          } else {
            this.updateLayers(layerTree);
          }
        }
      }
    });
  }

  private _onLayerTreeChange(
    sender?: IJupyterGISDoc,
    change?: IJGISLayerTreeDocChange
  ): void {
    this._ready = false;
    // We can't properly use the change, because of the nested groups in the the shared
    // document which is flattened for the map tool.
    this.updateLayers(JupyterGISModel.getOrderedLayerIds(this._model));
  }

  private _onSourcesChange(
    _: IJupyterGISDoc,
    change: IJGISSourceDocChange
  ): void {
    if (!this._ready) {
      return;
    }

    change.sourceChange?.forEach(change => {
      if (!change.newValue || Object.keys(change.newValue).length === 0) {
        this.removeSource(change.id);
      } else {
        const source = this._model.getSource(change.id);
        if (source) {
          this.updateSource(change.id, source);
        }
      }
    });
  }

  private _handleThemeChange = (): void => {
    const lightTheme = isLightTheme();

    // TODO SOMETHING

    this.setState(old => ({ ...old, lightTheme }));
  };

  private _handleWindowResize = (): void => {
    // TODO SOMETHING
  };

  render(): JSX.Element {
    return (
      <div
        className="jGIS-Mainview"
        style={{
          border: this.state.remoteUser
            ? `solid 3px ${this.state.remoteUser.color}`
            : 'unset'
        }}
      >
        <Spinner loading={this.state.loading} />

        <div
          ref={this.divRef}
          style={{
            width: '100%',
            height: 'calc(100%)'
          }}
        />
      </div>
    );
  }

  private _initializedPosition = false;
  private divRef = React.createRef<HTMLDivElement>(); // Reference of render div
  private _Map: OlMap;
  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _sources: Record<string, any>;
  private _sourceToLayerMap = new Map();
}
