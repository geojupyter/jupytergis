import { MapChange } from '@jupyter/ydoc';
import {
  IHillshadeLayer,
  IJGISFilter,
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
  IVectorLayer,
  IVectorTileSource,
  JupyterGISModel
} from '@jupytergis/schema';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue } from '@lumino/coreutils';
import * as MapLibre from 'maplibre-gl';
import { Map as OlMap, View } from 'ol';
import MVT from 'ol/format/MVT';
import * as React from 'react';
// import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import WebGlTileLayer from 'ol/layer/WebGLTile';
import { Projection, fromLonLat, toLonLat } from 'ol/proj';
// import { OSM } from 'ol/source';
import GeoJSON from 'ol/format/GeoJSON';
import GeoTIFF from 'ol/source/GeoTIFF';
import VectorTileSource from 'ol/source/VectorTile';
// import Stroke from 'ol/style/Stroke';

import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import { Circle, Fill, Stroke, Style } from 'ol/style';

import geojsonvt from 'geojson-vt';
import { Color } from 'ol/color';
import { ImageTile, XYZ } from 'ol/source';
import { Protocol } from 'pmtiles';
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

export class OlMainView extends React.Component<IProps, IStates> {
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
    // this._model.clientStateChanged.connect(
    //   this._onClientSharedStateChanged,
    //   this
    // );

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

    // this._model.clientStateChanged.disconnect(
    //   this._onClientSharedStateChanged,
    //   this
    // );

    this._mainViewModel.dispose();
  }

  async generateScene(): Promise<void> {
    console.log('generating');

    if (this.divRef.current) {
      this._Map = new OlMap({
        target: this.divRef.current,
        layers: [],
        view: new View({
          center: [0, 0],
          zoom: 1
        })
      });

      this._Map.on('moveend', () => {
        if (!this._initializedPosition) {
          return;
        }

        const view = this._Map.getView();
        const center = view.getCenter();
        if (!center) {
          return;
        }
        const latLng = toLonLat(center, view.getProjection());
        const bearing = view.getRotation();
        // const pitch = this._Map.getPitch();
        this._model.setOptions({
          ...this._model.getOptions(),
          latitude: latLng[1],
          longitude: latLng[0],
          bearing
        });
      });

      // PM tile stuff
      //   this._protocol = new Protocol();
      //   MapLibre.addProtocol('pmtiles', this._protocol.tile);

      if (JupyterGISModel.getOrderedLayerIds(this._model).length !== 0) {
        await this._updateLayersImpl(
          JupyterGISModel.getOrderedLayerIds(this._model)
        );
        const options = this._model.getOptions();
        this.updateOptions(options);
      }

      this.setState(old => ({ ...old, loading: false }));
    }
  }

  // TODO: I don't think we need this for openlayers?
  /**
   * Add a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  async addSource(id: string, source: IJGISSource): Promise<void> {
    let newSource;
    switch (source.type) {
      case 'RasterSource': {
        const sourceParameters = source.parameters as IRasterSource;
        const url = this.computeSourceUrl(source);
        console.log('url', url);
        newSource = new XYZ({
          attributions: sourceParameters.attribution,
          minZoom: sourceParameters.minZoom,
          maxZoom: sourceParameters.maxZoom,
          tileSize: 256,
          url: url
        });

        break;
      }
      case 'VectorTileSource': {
        // const mapSource = this._Map.getSource(id) as MapLibre.VectorTileSource;
        const sourceParameters = source.parameters as IVectorTileSource;

        newSource = new VectorTileSource({
          attributions: sourceParameters.attribution,
          minZoom: sourceParameters.minZoom,
          maxZoom: sourceParameters.maxZoom,
          urls: [this.computeSourceUrl(source)],
          format: new MVT()
        });

        // TODO do we need this? not there for map libre
        // this._model.sharedModel.addSource(UUID.uuid4(), newSource);

        break;
      }
      case 'GeoJSONSource': {
        // Converts geojson-vt data to GeoJSON
        // taken from https://openlayers.org/en/latest/examples/geojson-vt.html
        const replacer = function (key, value) {
          if (!value || !value.geometry) {
            return value;
          }

          let type;
          const rawType = value.type;
          let geometry = value.geometry;
          if (rawType === 1) {
            type = 'MultiPoint';
            if (geometry.length === 1) {
              type = 'Point';
              geometry = geometry[0];
            }
          } else if (rawType === 2) {
            type = 'MultiLineString';
            if (geometry.length === 1) {
              type = 'LineString';
              geometry = geometry[0];
            }
          } else if (rawType === 3) {
            type = 'Polygon';
            if (geometry.length > 1) {
              type = 'MultiPolygon';
              geometry = [geometry];
            }
          }

          return {
            type: 'Feature',
            geometry: {
              type: type,
              coordinates: geometry
            },
            properties: value.tags
          };
        };

        const data =
          source.parameters?.data ||
          (await this._model.readGeoJSON(source.parameters?.path));

        const tileIndex = geojsonvt(data, {
          extent: 4096,
          debug: 1
        });
        const format = new GeoJSON({
          // Data returned from geojson-vt is in tile pixel units
          dataProjection: new Projection({
            code: 'TILE_PIXELS',
            units: 'tile-pixels',
            extent: [0, 0, 4096, 4096]
          })
        });
        newSource = new VectorTileSource({
          tileUrlFunction: tileCoord => {
            // Use the tile coordinate as a pseudo URL for caching purposes
            return JSON.stringify(tileCoord);
          },
          tileLoadFunction: (tile: any, url) => {
            const tileCoord = JSON.parse(url);
            const data = tileIndex.getTile(
              tileCoord[0],
              tileCoord[1],
              tileCoord[2]
            );
            const geojson = JSON.stringify(
              {
                type: 'FeatureCollection',
                features: data ? data.features : []
              },
              replacer
            );

            const features = format.readFeatures(geojson, {
              extent: newSource?.getTileGrid()?.getTileCoordExtent(tileCoord),
              featureProjection: this._Map.getView().getProjection()
            });
            tile.setFeatures(features);
          }
        });

        break;
      }
      case 'RasterDemSource': {
        const sourceParameters = source.parameters as IRasterDemSource;

        newSource = new ImageTile({
          url: this.computeSourceUrl(source),
          attributions: sourceParameters.attribution
        });
        break;
      }
      case 'VideoSource': {
        break;
      }
      case 'ImageSource': {
        break;
      }
      case 'GeoTiffSource': {
        newSource = new GeoTIFF({
          sources: [
            {
              // red reflectance
              url: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/21/H/UB/2021/9/S2B_21HUB_20210915_0_L2A/B04.tif',
              max: 10000
            },
            {
              // near-infrared reflectance
              url: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/21/H/UB/2021/9/S2B_21HUB_20210915_0_L2A/B08.tif',
              max: 10000
            }
          ]
        });
        break;
      }
    }

    newSource.set('id', id);
    this._sources[id] = newSource;
  }

  private toggleVideoPlaying(sourceId: any) {
    // TODO implement
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
    // TODO implement
  }

  /**
   * Remove a source from the map.
   *
   * @param id - the source id.
   */
  removeSource(id: string): void {
    // TODO implement
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
    // TODO implement

    const previousLayerIds = this.getLayers();
    console.log('previousLayerIds', previousLayerIds);
    // We use the reverse order of the list to add the layer from the top to the
    // bottom.
    // This is to ensure that the beforeId (layer on top of the one we add/move)
    // is already added/moved in the map.
    const reversedLayerIds = layerIds.slice().reverse();

    for (const layerId of reversedLayerIds) {
      const layer = this._model.sharedModel.getLayer(layerId);

      if (!layer) {
        console.log(`Layer id ${layerId} does not exist`);
        return;
      }
      // Get the expected index in the map.
      const currentLayerIds = [...previousLayerIds];
      let indexInMap = currentLayerIds.length;
      const nextLayer = layerIds[layerIds.indexOf(layerId) + 1];
      if (nextLayer !== undefined) {
        indexInMap = currentLayerIds.indexOf(nextLayer);
        if (indexInMap === -1) {
          indexInMap = currentLayerIds.length;
        }
      }
      // eslint-disable-next-line no-constant-condition
      if (this.getLayer(layerId)) {
        this.moveLayer(layerId, indexInMap);
      } else {
        await this.addLayer(layerId, layer, indexInMap);
      }

      // Remove the element of the previous list as treated.
      const index = previousLayerIds.indexOf(layerId);
      if (index > -1) {
        previousLayerIds.splice(index, 1);
      }
    }
    // Remove the layers not used anymore.
    previousLayerIds.forEach(layerId => {
      this._Map.removeLayer(layerId);
    });

    this._ready = true;
  }

  /**
   * Add a layer to the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   * @param index - expected index of the layer.
   */
  async addLayer(id: string, layer: IJGISLayer, index: number): Promise<void> {
    console.log('addinglayer');
    if (this.getLayer(id)) {
      // Layer already exists
      return;
    }

    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._sources[sourceId]) {
      console.log('adding source', sourceId);
      await this.addSource(sourceId, source);
    }

    // Get the beforeId value according to the expected index.
    const currentLayerIds = this.getLayers();
    // const currentLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
    let beforeId: string | undefined = undefined;
    if (index < currentLayerIds.length && index !== -1) {
      beforeId = currentLayerIds[index];
    }

    let newLayer;

    // TODO: OpenLayers provides a bunch of sources for specific tile
    // providers, so maybe set up some way to use those
    switch (layer.type) {
      case 'RasterLayer': {
        const layerParameters = layer.parameters as IRasterLayer;

        newLayer = new TileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source]
        });
        console.log('newLayer', newLayer);

        break;
      }
      case 'WebGlLayer': {
        console.log('adding web gl layer');
        const layerParameters = layer.parameters as IRasterLayer;

        // TODO: copy video source to get multipls urls from creation form

        newLayer = new WebGlTileLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source]
        });

        break;
      }
      case 'VectorLayer': {
        const layerParameters = layer.parameters as IVectorLayer;

        const fill = new Fill({
          color: (layerParameters.color as Color) || '#FF0000'
        });
        const stroke = new Stroke({
          color: '#FFFFFF',
          width: 1.25
        });
        // TODO is MVT right here??
        newLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          style: new Style({
            image: new Circle({
              fill: fill,
              stroke: stroke,
              radius: 5
            }),
            fill: fill,
            stroke: stroke
          })
        });

        break;
      }
      case 'HillshadeLayer': {
        const layerParameters = layer.parameters as IHillshadeLayer;

        newLayer = new WebGlTileLayer({
          opacity: 0.3,
          source: this._sources[layerParameters.source],
          style: {
            color: ['color', this.hillshadeMathStuff()]
          }
        });

        break;
      }
    }

    // OpenLayers doesn't have name/id field so add it
    newLayer.set('id', id);

    // change map view to use projection and extent from source
    if (layer.parameters) {
      console.log('setting view');
      // this._Map.setView(this._sources[layer.parameters.source].getView());
    }

    // TODO: Does this work? Think I need to do z-index stuff
    this._Map.getLayers().insertAt(index, newLayer);

    if (layer.filters) {
      this.setFilters(id, layer.filters);
    }
  }

  /**
   * Taken from https://openlayers.org/en/latest/examples/webgl-shaded-relief.html
   * @returns
   */
  private hillshadeMathStuff = () => {
    // The method used to extract elevations from the DEM.
    // In this case the format used is Terrarium
    // red * 256 + green + blue / 256 - 32768
    //
    // Other frequently used methods include the Mapbox format
    // (red * 256 * 256 + green * 256 + blue) * 0.1 - 10000
    //
    function elevation(xOffset, yOffset) {
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
   * Move a layer in the stack.
   *
   * @param id - id of the layer.
   * @param index - expected index of the layer.
   */
  moveLayer(id: string, index: number | undefined): void {
    // TODO: OL uses z-index for ordering so come back to this
    // // Get the beforeId value according to the expected index.
    // const currentLayerIds = this.getLayers();
    // let beforeId: string | undefined = undefined;
    // if (!(index === undefined) && index < currentLayerIds.length) {
    //   beforeId = currentLayerIds[index];
    // }
    // this._Map.moveLayer(id, beforeId);
  }

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
    console.log('in updater');
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._sources[sourceId]) {
      console.log('adding source', sourceId);
      await this.addSource(sourceId, source);
    }

    console.log(
      'set vis',
      layer.parameters?.visible,
      this.getLayer(id)?.get('id')
    );
    mapLayer.setVisible(layer.visible);

    switch (layer.type) {
      case 'RasterLayer': {
        mapLayer?.setOpacity(layer.parameters?.opacity || 1);
        break;
      }
      case 'VectorLayer': {
        mapLayer?.setOpacity(layer.parameters?.opacity || 1);

        (mapLayer as VectorTileLayer).setStyle({
          'fill-color': layer.parameters?.color,
          'stroke-color': layer.parameters?.color,
          'circle-fill-color': layer.parameters?.color,
          'circle-stroke-color': layer.parameters?.color
        });
        break;
      }
      case 'WebGlLayer': {
        (mapLayer as WebGlTileLayer).setStyle({
          color: layer?.parameters?.color
        });
        break;
      }
      case 'HillshadeLayer': {
        // TODO figure out color here
        break;
      }
    }

    // TODO: filters
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

  /**
   * Determines whether to use tiles or a URL for a given source based on the presence of replaceable parameters in the URL.
   *
   * This method checks if the provided URL contains patterns that indicate it can be broken down into tiles
   * (e.g., {z}/{x}/{y}, {ratio}, etc.).
   * If such patterns are found, it suggests that tiles should be used. Otherwise, the URL itself should be used.
   *
   * @param url - The URL to check for replaceable parameters.
   * @returns True if the URL contains replaceable parameters indicating the use of tiles, false otherwise.
   */
  private _shouldUseTiles(url: string) {
    const regexPatterns = [
      /\{z\}/,
      /\{x\}/,
      /\{y\}/,
      /\{ratio\}/,
      /\{quadkey\}/,
      /\{bbox-epsg-3857\}/
    ];

    let result = false;

    for (const pattern of regexPatterns) {
      if (pattern.test(url)) {
        result = true;
        break;
      }
    }

    return result;
  }

  /**
   * Updates the given source with either a new URL or tiles based on the result of `_shouldUseTiles`.
   *
   * @param source - The source to update.
   * @param url - The URL to set for the source.
   */
  private _handleSourceUpdate(
    source:
      | MapLibre.RasterTileSource
      | MapLibre.VectorTileSource
      | MapLibre.RasterDEMTileSource,
    url: string
  ) {
    const result = this._shouldUseTiles(url);

    result ? source.setTiles([url]) : source.setUrl(url);
  }

  /**
   * Configures a source specification, setting either the `tiles` or `url` property based on the provided URL.
   *
   * This method uses the `_shouldUseTiles` method to determine whether the source should be configured with tiles or a direct URL. It then modifies the `sourceSpec` object accordingly.
   *
   * @param sourceSpec - The source specification object to configure. This object is modified in place.
   * @param url - The URL to check for replaceable parameters and use in configuring the source.
   * @returns The modified source specification object.
   */
  private configureTileSource(
    sourceSpec:
      | MapLibre.RasterSourceSpecification
      | MapLibre.RasterDEMSourceSpecification
      | MapLibre.VectorSourceSpecification,
    url: string
  ) {
    const result = this._shouldUseTiles(url);

    result
      ? (sourceSpec = { tiles: [url], ...sourceSpec })
      : (sourceSpec = { url, ...sourceSpec });

    return sourceSpec;
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
    const centerCoord = fromLonLat(
      [options.longitude, options.latitude],
      this._Map.getView().getProjection()
    );

    console.log('centerCoord', centerCoord);
    this._Map.getView().setZoom(options.zoom || 0);
    this._Map.getView().setCenter(centerCoord || [0, 0]);

    this._Map.getView().setRotation(options.bearing || 0);
  }

  private _onViewChanged(
    sender: ObservableMap<JSONValue>,
    change: IObservableMap.IChangedArgs<JSONValue>
  ): void {
    // TODO SOMETHING
  }

  /**
   * Convienence method to get a specific layer from OpenLayers Map
   * @param id Layer to retrieve
   */
  private getLayer(id: string) {
    return this._Map
      .getLayers()
      .getArray()
      .find(layer => layer.get('id') === id);
  }

  /**
   * Convienence method to get a specific layer from OpenLayers Map
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
        // OpenLayers doesn't have a way to get an individual layer
        const mapLayer = this.getLayer(change.id);
        if (
          mapLayer &&
          JupyterGISModel.getOrderedLayerIds(this._model).includes(change.id)
        ) {
          this.updateLayer(change.id, layer, mapLayer);
        } else {
          this.updateLayers(JupyterGISModel.getOrderedLayerIds(this._model));
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

  private async setFilters(id: string, filters: IJGISFilter) {
    if (filters.appliedFilters.length === 0) {
      //   this._Map.setFilter(id, null);
      return;
    }

    const filterExpression = [
      filters.logicalOp,
      ...filters.appliedFilters.map(filter => {
        return [filter.operator, filter.feature, filter.value];
      })
    ] as MapLibre.FilterSpecification;

    // this._Map.setFilter(id, filterExpression);
  }

  private getSource<T>(id: string): T | undefined {
    const source = this._model.sharedModel.getSource(id);

    if (!source || !source.parameters) {
      console.log(`Source id ${id} does not exist`);
      return;
    }

    return source.parameters as T;
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
  //   private _Map: MapLibre.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _terrainControl: MapLibre.TerrainControl | null;
  private _videoPlaying = false;
  private _protocol: Protocol;
  private _sources: Record<string, any>;
}
