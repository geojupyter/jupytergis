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
  IVectorLayer,
  IVectorTileLayer,
  IVectorTileSource,
  IWebGlLayer,
  JupyterGISModel
} from '@jupytergis/schema';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue, UUID } from '@lumino/coreutils';
import { Map as OlMap, View } from 'ol';
import { GeoJSON, MVT } from 'ol/format';
import DragAndDrop from 'ol/interaction/DragAndDrop';
import {
  Image as ImageLayer,
  Vector as VectorLayer,
  VectorTile as VectorTileLayer,
  WebGLTile as WebGlTileLayer
} from 'ol/layer';
import BaseLayer from 'ol/layer/Base';
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
import { Circle, Fill, Stroke, Style } from 'ol/style';
import * as React from 'react';
import { isLightTheme } from '../tools';
import { MainViewModel } from './mainviewmodel';
import { Spinner } from './spinner';
//@ts-expect-error no types for ol-pmtiles
import { PMTilesRasterSource, PMTilesVectorSource } from 'ol-pmtiles';
import TileLayer from 'ol/layer/Tile';
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
        })
      });

      const dragAndDropInteraction = new DragAndDrop({
        formatConstructors: [GeoJSON]
      });

      dragAndDropInteraction.on('addfeatures', event => {
        // const source = new VectorSource({
        //   features: event.features
        // });

        const sourceId = UUID.uuid4();

        const sourceModel: IJGISSource = {
          type: 'GeoJSONSource',
          name: 'Drag and Drop source',
          parameters: { path: event.file.name }
        };

        this.addSource(sourceId, sourceModel);

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

        const layerId = UUID.uuid4();
        this.addLayer(layerId, layerModel, this.getLayers().length);
        this._model.addLayer(layerId, layerModel);

        // this._Map
        //   .getView()
        //   .fit(this._sources[layerModel.parameters?.source].getExtent());
      });

      this._Map.addInteraction(dragAndDropInteraction);

      this._Map.on('moveend', () => {
        if (!this._initializedPosition) {
          return;
        }

        const view = this._Map.getView();
        const center = view.getCenter();
        const zoom = view.getZoom();
        if (!center || !zoom) {
          return;
        }
        const projection = view.getProjection();
        const latLng = toLonLat(center, projection);
        const bearing = view.getRotation();

        this._model.setOptions({
          ...this._model.getOptions(),
          latitude: latLng[1],
          longitude: latLng[0],
          bearing,
          projection: projection.getCode(),
          zoom
        });
      });

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

        const format = new GeoJSON();

        // TODO: Don't hardcode projection
        newSource = new VectorSource({
          features: format.readFeatures(data, {
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

        newSource = new GeoTIFFSource({
          sources: sourceParameters.urls,
          normalize: sourceParameters.normalize,
          wrapX: sourceParameters.wrapX
        });

        break;
      }
    }

    newSource.set('id', id);
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
    // TODO implement
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
    const previousLayerIds = this.getLayers();
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
      await this.addSource(sourceId, source);
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

        break;
      }
      case 'VectorLayer': {
        const layerParameters = layer.parameters as IVectorLayer;

        newLayer = new VectorLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          style: currentFeature =>
            this.vectorLayerStyleFunc(currentFeature, layer)
        });

        break;
      }
      case 'VectorTileLayer': {
        const layerParameters = layer.parameters as IVectorLayer;

        newLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source],
          style: currentFeature =>
            this.vectorLayerStyleFunc(currentFeature, layer)
        });

        break;
      }
      case 'HillshadeLayer': {
        const layerParameters = layer.parameters as IHillshadeLayer;

        newLayer = new WebGlTileLayer({
          opacity: 0.3,
          source: this._sources[layerParameters.source],
          style: {
            color: ['color', this.hillshadeMath()]
          }
        });

        break;
      }
      case 'ImageLayer': {
        const layerParameters = layer.parameters as IImageLayer;

        newLayer = new ImageLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source]
        });

        break;
      }
      case 'WebGlLayer': {
        const layerParameters = layer.parameters as IWebGlLayer;

        newLayer = new WebGlTileLayer({
          opacity: layerParameters.opacity,
          source: this._sources[layerParameters.source],
          style: {
            color: layerParameters.color
          }
        });

        // TODO: Some tifs are messed up without this, but I think it's a projection thing
        // this._Map.setView(this._sources[layerParameters.source].getView());

        break;
      }
    }

    // OpenLayers doesn't have name/id field so add it
    newLayer.set('id', id);

    this._Map.getLayers().insertAt(index, newLayer);
  }

  vectorLayerStyleFunc = (currentFeature, layer) => {
    const layerParameters = layer.parameters as IVectorLayer;

    // const flatStyle = {
    //   'fill-color': 'rgba(255,255,255,0.4)',
    //   'stroke-color': '#3399CC',
    //   'stroke-width': 1.25,
    //   'circle-radius': 5,
    //   'circle-fill-color': 'rgba(255,255,255,0.4)',
    //   'circle-stroke-width': 1.25,
    //   'circle-stroke-color': '#3399CC'
    // };

    // TODO: Need to make a version that works with strings as well
    const operators = {
      '>': (a, b) => a > b,
      '<': (a, b) => a < b,
      '>=': (a, b) => a >= b,
      '<=': (a, b) => a <= b,
      '==': (a, b) => a === b,
      '!=': (a, b) => a !== b
    };

    // TODO: I don't think this will work with fancy color expressions
    const fill = new Fill({
      color:
        layerParameters.type === 'fill' || layerParameters.type === 'circle'
          ? layerParameters.color
          : '#F092DD'
    });

    const stroke = new Stroke({
      color:
        layerParameters.type === 'line' || layerParameters.type === 'circle'
          ? layerParameters.color
          : '#392F5A',
      width: 2
    });

    const style = new Style({
      fill,
      stroke,
      image: new Circle({
        radius: 5,
        fill,
        stroke
      })
    });

    if (layer.filters && layer.filters?.appliedFilters.length !== 0) {
      const props = currentFeature.getProperties();
      let shouldDisplayFeature = true;

      switch (layer.filters.logicalOp) {
        case 'any': {
          // Display the feature if any filter conditions apply
          shouldDisplayFeature = layer.filters.appliedFilters.some(
            ({ feature, operator, value }) =>
              operators[operator](props[feature], value)
          );

          break;
        }
        case 'all': {
          // Display the feature only if all the filter conditions apply
          shouldDisplayFeature = layer.filters.appliedFilters.every(
            ({ feature, operator, value }) =>
              operators[operator](props[feature], value)
          );

          break;
        }
      }

      if (shouldDisplayFeature) {
        return style;
      } else {
        return undefined;
      }
    } else {
      return style;
    }
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
    // Get the beforeId value according to the expected index.
    const currentLayerIds = this.getLayers();
    let beforeId: string | undefined = undefined;
    if (!(index === undefined) && index < currentLayerIds.length) {
      beforeId = currentLayerIds[index];
    }

    const layerArray = this._Map.getLayers().getArray();
    const movingLayer = this.getLayer(id);

    if (!movingLayer || !index || !beforeId) {
      return;
    }
    const indexOfMovingLayer = layerArray.indexOf(movingLayer);

    layerArray.splice(indexOfMovingLayer, 1);

    const beforeLayer = this.getLayer(beforeId);

    if (!beforeLayer) {
      return;
    }
    const indexOfBeforeLayer = layerArray.indexOf(beforeLayer);

    layerArray.splice(indexOfBeforeLayer, 0, movingLayer);
    this._Map.setLayers(layerArray);
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
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._sources[sourceId]) {
      await this.addSource(sourceId, source);
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

        (mapLayer as VectorLayer).setStyle(currentFeature =>
          this.vectorLayerStyleFunc(currentFeature, layer)
        );

        break;
      }
      case 'VectorTileLayer': {
        const layerParams = layer.parameters as IVectorTileLayer;

        mapLayer.setOpacity(layerParams.opacity || 1);

        (mapLayer as VectorLayer).setStyle(currentFeature =>
          this.vectorLayerStyleFunc(currentFeature, layer)
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
        (mapLayer as WebGlTileLayer).setStyle({
          color: layer?.parameters?.color
        });
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
    const centerCoord = fromLonLat(
      [options.longitude, options.latitude],
      this._Map.getView().getProjection()
    );

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
  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _sources: Record<string, any>;
}
