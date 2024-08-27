import { MapChange } from '@jupyter/ydoc';
import {
  IJGISFilter,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISOptions,
  IJGISSource,
  IJGISSourceDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
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
import { Map, View } from 'ol';
import MVT from 'ol/format/MVT';
import * as React from 'react';
// import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import WebGlTileLayer from 'ol/layer/WebGLTile';
import { fromLonLat, toLonLat } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
// import { OSM } from 'ol/source';
import GeoTIFF from 'ol/source/GeoTIFF';
import VectorTileSource from 'ol/source/VectorTile';

import { Fill, Stroke, Style } from 'ol/style';
// import Stroke from 'ol/style/Stroke';
import BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
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
      this._Map = new Map({
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
    switch (source.type) {
      case 'RasterSource': {
        break;
      }
      case 'VectorTileSource': {
        // const mapSource = this._Map.getSource(id) as MapLibre.VectorTileSource;
        const parameters = source.parameters as IVectorTileSource;

        const newSource = new VectorTileSource({
          attributions: parameters.attribution,
          minZoom: parameters.minZoom,
          maxZoom: parameters.maxZoom,
          urls: [this.computeSourceUrl(source)],
          format: new MVT()
        });

        // TODO do we need this? not there for map libre
        // this._model.sharedModel.addSource(UUID.uuid4(), newSource);

        break;
      }
    }
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
    const sourceParameters = source.parameters as IVectorTileSource;

    // Get the beforeId value according to the expected index.
    const currentLayerIds = this.getLayers();
    // const currentLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
    let beforeId: string | undefined = undefined;
    if (index < currentLayerIds.length && index !== -1) {
      beforeId = currentLayerIds[index];
    }

    switch (layer.type) {
      case 'RasterLayer': {
        const layerParameters = layer.parameters as IRasterLayer;
        const sourceParameters = source.parameters as IRasterSource;
        const newSource = new XYZ({
          attributions: sourceParameters.attribution,
          minZoom: sourceParameters.minZoom,
          maxZoom: sourceParameters.maxZoom,
          tileSize: 256,
          url: this.computeSourceUrl(source)
        });

        const newLayer = new TileLayer({
          opacity: layerParameters.opacity,
          source: newSource
        });

        // change map view to use projection and extent from source
        this._Map.setView(newSource.getView());

        // OpenLayers doesn't have name/is field so add it
        this._Map.getLayers().insertAt(index, newLayer);
        break;
      }
      case 'WebGlLayer': {
        console.log('adding web gl layer');
        const layerParameters = layer.parameters as IRasterLayer;

        // TODO: copy video source to get multipls urls from creation form
        const source = new GeoTIFF({
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

        const newLayer = new WebGlTileLayer({
          opacity: layerParameters.opacity,
          source: source
        });

        // change map view to use projection and extent from source
        this._Map.setView(source.getView());

        // OpenLayers doesn't have name/is field so add it
        this._Map.getLayers().insertAt(index, newLayer);
        // this._Map.addLayer(newLayer);

        break;
      }
      case 'VectorLayer': {
        const layerParameters = layer.parameters as IVectorLayer;

        const newLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          source: new VectorTileSource({
            attributions: sourceParameters.attribution,
            minZoom: sourceParameters.minZoom,
            maxZoom: sourceParameters.maxZoom,
            urls: [this.computeSourceUrl(source)],
            format: new MVT()
          }),
          style: function (feature, resolution) {
            // Filter and style only the desired feature(s)
            console.log('feature in style', feature.getProperties());
            if (
              feature.getProperties()['layer'] === layerParameters.sourceLayer
            ) {
              return new Style({
                fill: new Fill({ color: '#F092DD' }),
                stroke: new Stroke({
                  color: '#392F5A',
                  width: 2
                })
              });
            }
            return undefined; // Don't render this feature
          }
        });

        // OpenLayers doesn't have name/is field so add it
        newLayer.set('id', id);

        this._Map.addLayer(newLayer);

        break;
      }
    }

    if (layer.filters) {
      this.setFilters(id, layer.filters);
    }
  }

  info = event => {
    const features = this._Map.getFeaturesAtPixel(event.pixel);
    const properties = features[0].getProperties();
    console.log('features', features);
    console.log('properties', JSON.stringify(properties, null, 2));
  };
  /**
   * Move a layer in the stack.
   *
   * @param id - id of the layer.
   * @param index - expected index of the layer.
   */
  moveLayer(id: string, index: number | undefined): void {
    // Get the beforeId value according to the expected index.
    // const currentLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
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
    switch (layer.type) {
      case 'WebGlLayer': {
        console.log('update webgl');
        const webGlLayer = mapLayer as WebGlTileLayer;
        const jgisLayer = this._model.getLayer(id);
        const color = jgisLayer?.parameters?.color;
        console.log('color', color);
        webGlLayer.setStyle({ color: color });
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
    // TODO implement
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

  //   private _onClientSharedStateChanged = (
  //     sender: IJupyterGISModel,
  //     clients: Map<number, IJupyterGISClientState>
  //   ): void => {
  //     // TODO SOMETHING
  //   };

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
   * @param id
   */
  private getLayer(id: string) {
    return this._Map
      .getLayers()
      .getArray()
      .find(layer => layer.get('id') === id);
  }

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
        console.log('mapLayer', mapLayer);
        if (
          mapLayer &&
          JupyterGISModel.getOrderedLayerIds(this._model).includes(change.id)
        ) {
          console.log('updating');
          this.updateLayer(change.id, layer, mapLayer);
        } else {
          console.log('hitting');
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

  // @ts-ignore
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

  private _Map: Map;
  //   private _Map: MapLibre.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _terrainControl: MapLibre.TerrainControl | null;
  private _videoPlaying = false;
  private _protocol: Protocol;
}
