import { MapChange } from '@jupyter/ydoc';
import {
  IHillshadeLayer,
  IImageSource,
  IShapefileSource,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISOptions,
  IJGISSource,
  IJGISSourceDocChange,
  IJGISTerrain,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  IRasterDemSource,
  IRasterSource,
  IVectorLayer,
  IVectorTileSource,
  IVideoSource,
  JupyterGISModel
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue } from '@lumino/coreutils';
import * as React from 'react';

import * as MapLibre from 'maplibre-gl';

import { isLightTheme } from '../tools';
import { MainViewModel } from './mainviewmodel';
import { Spinner } from './spinner';
import shp from 'shpjs';

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
    this._model.terrainChanged.connect(this._onTerrainChange, this);

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

    this._model.clientStateChanged.disconnect(
      this._onClientSharedStateChanged,
      this
    );

    this._mainViewModel.dispose();
  }

  async generateScene(): Promise<void> {
    if (this.divRef.current) {
      this._Map = new MapLibre.Map({
        container: this.divRef.current
      }).addControl(
        new MapLibre.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true
        })
      );

      this._Map.on('zoomend', () => {
        if (!this._initializedPosition) {
          return;
        }

        const zoom = this._Map.getZoom();
        this._model.setOptions({ ...this._model.getOptions(), zoom });
      });

      this._Map.on('moveend', () => {
        if (!this._initializedPosition) {
          return;
        }

        const center = this._Map.getCenter();
        const bearing = this._Map.getBearing();
        const pitch = this._Map.getPitch();
        this._model.setOptions({
          ...this._model.getOptions(),
          latitude: center.lat,
          longitude: center.lng,
          bearing,
          pitch
        });
      });

      // Workaround for broken intialization of maplibre
      this._Map._lazyInitEmptyStyle();

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
    switch (source.type) {
      case 'RasterSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.RasterTileSource;
        if (!mapSource) {
          this._Map.addSource(id, {
            type: 'raster',
            attribution: source.parameters?.attribution || '',
            tiles: [this.computeSourceUrl(source)],
            tileSize: 256
          });
        }
        break;
      }
      case 'VectorTileSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.VectorTileSource;
        if (!mapSource) {
          const parameters = source.parameters as IVectorTileSource;
          this._Map.addSource(id, {
            type: 'vector',
            minzoom: parameters.minZoom,
            maxzoom: parameters.maxZoom,
            attribution: parameters.attribution || '',
            tiles: [this.computeSourceUrl(source)]
          });
        }
        break;
      }
      case 'GeoJSONSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.GeoJSONSource;
        if (!mapSource) {
          const data =
            source.parameters?.data ||
            (await this._model.readGeoJSON(source.parameters?.path));
          this._Map.addSource(id, {
            type: 'geojson',
            data: data
          });
        }
        break;
      }
      case 'RasterDemSource': {
        const mapSource = this._Map.getSource(
          id
        ) as MapLibre.RasterDEMTileSource;
        if (!mapSource) {
          const parameters = source.parameters as IRasterDemSource;
          this._Map.addSource(id, {
            type: 'raster-dem',
            tileSize: parameters.tileSize,
            url: parameters.url
          });
        }
        break;
      }
      case 'VideoSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.VideoSource;
        if (!mapSource) {
          const parameters = source.parameters as IVideoSource;
          this._Map
            .addSource(id, {
              type: 'video',
              urls: parameters?.urls,
              coordinates: parameters?.coordinates
            })
            .on('click', () => this.toggleVideoPlaying(id));

          this._videoPlaying = true;
        }
        break;
      }
      case 'ImageSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.ImageSource;
        if (!mapSource) {
          const parameters = source.parameters as IImageSource;
          this._Map.addSource(id, {
            type: 'image',
            url: parameters?.url,
            coordinates: parameters?.coordinates
          });
        }
        break;
      }
      case 'ShapefileSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.GeoJSONSource;
        if (!mapSource) {
          const parameters = source.parameters as IShapefileSource;

          const geojson = await this._loadShapefileAsGeoJSON(parameters.path);

          const geojsonData = Array.isArray(geojson)
            ? geojson[0]
            : geojson;

          this._Map.addSource(id, {
            type: 'geojson',
            data: geojsonData
          });
        }
        break;
      }
    }
  }

  private toggleVideoPlaying(sourceId: any) {
    const source = this._Map.getSource(sourceId) as MapLibre.VideoSource;

    this._videoPlaying ? source?.pause() : source?.play();
    this._videoPlaying = !this._videoPlaying;
  }

  private async _loadShapefileAsGeoJSON(path: string): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]> {
    try {
      const geojson = await shp(path);
      return geojson;
    } catch (error) {
      console.error('Error loading shapefile:', error);
      throw error;
    }
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
    const mapSource = this._Map.getSource(id);
    if (!mapSource) {
      this.addSource(id, source);
      return;
    }

    switch (source.type) {
      case 'RasterSource': {
        (mapSource as MapLibre.RasterTileSource).setTiles([
          this.computeSourceUrl(source)
        ]);
        break;
      }
      case 'VectorTileSource': {
        (mapSource as MapLibre.RasterTileSource).setTiles([
          this.computeSourceUrl(source)
        ]);
        break;
      }
      case 'GeoJSONSource': {
        const data =
          source.parameters?.data ||
          (await this._model.readGeoJSON(source.parameters?.path));
        (mapSource as MapLibre.GeoJSONSource).setData(data);
        break;
      }
      case 'RasterDemSource': {
        const parameters = source.parameters as IRasterDemSource;
        (mapSource as MapLibre.RasterDEMTileSource).setTiles([parameters.url]);
        break;
      }
      case 'ImageSource': {
        const parameters = source.parameters as IImageSource;
        (mapSource as MapLibre.ImageSource).updateImage({
          url: parameters.url,
          coordinates: parameters.coordinates
        });
        break;
      }
      case 'VideoSource': {
        const parameters = source.parameters as IVideoSource;
        (mapSource as MapLibre.VideoSource).setCoordinates(
          parameters.coordinates
        );
        break;
      }
      case 'ShapefileSource': {
        const parameters = source.parameters as IShapefileSource;
        const geojson = await this._loadShapefileAsGeoJSON(parameters.path);
        const geojsonData = Array.isArray(geojson) ? geojson[0] : geojson;
        (mapSource as MapLibre.GeoJSONSource).setData(geojsonData);
        break;
      }
      default: {
        console.warn('Source type not found');
      }
    }
  }

  /**
   * Remove a source from the map.
   *
   * @param id - the source id.
   */
  removeSource(id: string): void {
    const mapSource = this._Map.getSource(id);
    if (mapSource?.type === 'video') {
      (mapSource as MapLibre.VideoSource).off('click', () =>
        this.toggleVideoPlaying(id)
      );
    }
    if (mapSource) {
      this._Map.removeSource(id);
    }
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
    const previousLayerIds = this._Map.getStyle().layers.map(layer => layer.id);

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
      const currentLayerIds = this._Map
        .getStyle()
        .layers.map(layer => layer.id);
      let indexInMap = currentLayerIds.length;
      const nextLayer = layerIds[layerIds.indexOf(layerId) + 1];
      if (nextLayer !== undefined) {
        indexInMap = currentLayerIds.indexOf(nextLayer);
        if (indexInMap === -1) {
          indexInMap = currentLayerIds.length;
        }
      }

      if (this._Map.getLayer(layerId)) {
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
    if (this._Map.getLayer(id)) {
      // Layer already exists
      return;
    }

    // Add the source if necessary.
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._Map.getSource(sourceId)) {
      await this.addSource(sourceId, source);
    }

    // Get the beforeId value according to the expected index.
    const currentLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
    let beforeId: string | undefined = undefined;
    if (index < currentLayerIds.length && index !== -1) {
      beforeId = currentLayerIds[index];
    }
    switch (layer.type) {
      case 'RasterLayer': {
        this._Map.addLayer(
          {
            id: id,
            type: 'raster',
            layout: {
              visibility: layer.visible ? 'visible' : 'none'
            },
            paint: {
              'raster-opacity':
                layer.parameters?.opacity !== undefined
                  ? layer.parameters.opacity
                  : 1
            },
            source: sourceId,
            minzoom: source.parameters?.minZoom || 0,
            maxzoom: source.parameters?.maxZoom || 24
          },
          beforeId
        );
        break;
      }
      case 'VectorLayer': {
        const parameters = layer.parameters as IVectorLayer;
        const layerSpecification: MapLibre.AddLayerObject = {
          id,
          type: parameters.type,
          layout: {
            visibility: layer.visible ? 'visible' : 'none'
          },
          source: sourceId
        };

        parameters.sourceLayer &&
          (layerSpecification['source-layer'] = parameters.sourceLayer);

        this._Map.addLayer(layerSpecification, beforeId);
        this._Map.setPaintProperty(
          id,
          `${parameters.type}-color`,
          parameters.color !== undefined ? parameters.color : '#FF0000'
        );
        this._Map.setPaintProperty(
          id,
          `${parameters.type}-opacity`,
          parameters.opacity !== undefined ? parameters.opacity : 1
        );
        break;
      }
      case 'HillshadeLayer': {
        const parameters = layer.parameters as IHillshadeLayer;

        this._Map.addLayer(
          {
            id: id,
            type: 'hillshade',
            layout: {
              visibility: layer.visible ? 'visible' : 'none'
            },
            paint: {
              'hillshade-shadow-color':
                parameters?.shadowColor !== undefined
                  ? parameters.shadowColor
                  : '#473B24'
            },
            source: sourceId
          },
          beforeId
        );
        break;
      }
    }
  }

  async setTerrain(sourceId: string, exaggeration: number) {
    if (this._terrainControl) {
      this._Map.removeControl(this._terrainControl);
      this._terrainControl = null;
    }

    // Remove terrain
    if (!sourceId) {
      this._Map.setTerrain(null);
      return;
    }

    // Add the source if necessary.
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._Map.getSource(sourceId)) {
      await this.addSource(sourceId, source);
    }

    this._terrainControl = new MapLibre.TerrainControl({
      source: sourceId,
      exaggeration
    });
    this._Map.setTerrain({ source: sourceId, exaggeration });
    this._Map.addControl(this._terrainControl);
  }

  /**
   * Move a layer in the stack.
   *
   * @param id - id of the layer.
   * @param index - expected index of the layer.
   */
  moveLayer(id: string, index: number | undefined): void {
    // Get the beforeId value according to the expected index.
    const currentLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
    let beforeId: string | undefined = undefined;
    if (!(index === undefined) && index < currentLayerIds.length) {
      beforeId = currentLayerIds[index];
    }
    this._Map.moveLayer(id, beforeId);
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
    mapLayer: ReturnType<typeof this._Map.getLayer>
  ): Promise<void> {
    // Check if the layer already exist in the map.
    if (!mapLayer) {
      return;
    }

    // If the layer is vector and the type has changed, let create a new layer.
    // MapLibre does not support changing the type on fly, it lead to errors with
    // the paint properties.
    if (layer.parameters?.type && mapLayer.type !== layer.parameters?.type) {
      const index = this._Map.getStyle().layers.findIndex(lay => lay.id === id);
      this._Map.removeLayer(id);
      this.addLayer(id, layer, index);
      return;
    }

    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }

    if (!this._Map.getSource(sourceId)) {
      await this.addSource(sourceId, source);
    }

    mapLayer.source = sourceId;
    this._Map.setLayoutProperty(
      id,
      'visibility',
      layer.visible ? 'visible' : 'none'
    );
    switch (layer.type) {
      case 'RasterLayer': {
        this._Map.setPaintProperty(
          id,
          'raster-opacity',
          layer.parameters?.opacity !== undefined ? layer.parameters.opacity : 1
        );
        break;
      }
      case 'VectorLayer': {
        const vectorLayerType = layer.parameters?.type;
        if (!vectorLayerType) {
          showErrorMessage(
            'Vector layer error',
            'The vector layer type is undefined'
          );
        }
        this._Map.setPaintProperty(
          id,
          `${vectorLayerType}-color`,
          layer.parameters?.color !== undefined
            ? layer.parameters.color
            : '#FF0000'
        );
        this._Map.setPaintProperty(
          id,
          `${vectorLayerType}-opacity`,
          layer.parameters?.opacity !== undefined ? layer.parameters.opacity : 1
        );
        break;
      }
      case 'HillshadeLayer': {
        const parameters = layer.parameters as IHillshadeLayer;

        this._Map.setPaintProperty(
          id,
          'hillshade-shadow-color',
          parameters?.shadowColor !== undefined
            ? parameters.shadowColor
            : '#473B24'
        );
      }
    }
  }

  /**
   * Remove a layer from the map.
   *
   * @param id - the id of the layer.
   */
  removeLayer(id: string): void {
    const mapLayer = this._Map.getLayer(id);
    if (mapLayer) {
      this._Map.removeLayer(id);
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
    // It is important to call setZoom first, otherwise maplibre does set the center properly
    this._Map.setZoom(options.zoom || 0);
    this._Map.setCenter(
      (options.longitude &&
        options.latitude && {
          lng: options.longitude,
          lat: options.latitude
        }) || [0, 0]
    );
    this._Map.setBearing(options.bearing || 0);
    this._Map.setPitch(options.pitch || 0);
  }

  private _onViewChanged(
    sender: ObservableMap<JSONValue>,
    change: IObservableMap.IChangedArgs<JSONValue>
  ): void {
    // TODO SOMETHING
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
        const mapLayer = this._Map.getLayer(change.id);

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

  private _onTerrainChange(sender: any, change: IJGISTerrain) {
    this.setTerrain(change.source, change.exaggeration);
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

  private _Map: MapLibre.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _terrainControl: MapLibre.TerrainControl | null;
  private _videoPlaying = false;
}
