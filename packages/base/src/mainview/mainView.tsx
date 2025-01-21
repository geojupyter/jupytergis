import { MapChange } from '@jupyter/ydoc';
import {
  IAnnotation,
  IDict,
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
  IJupyterGISDocChange,
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
import { CommandRegistry } from '@lumino/commands';
import { JSONValue, UUID } from '@lumino/coreutils';
import { ContextMenu } from '@lumino/widgets';
import { Collection, MapBrowserEvent, Map as OlMap, View, getUid } from 'ol';
//@ts-expect-error no types for ol-pmtiles
import { PMTilesRasterSource, PMTilesVectorSource } from 'ol-pmtiles';
import { FeatureLike } from 'ol/Feature';
import { ScaleLine } from 'ol/control';
import { Coordinate } from 'ol/coordinate';
import { singleClick } from 'ol/events/condition';
import { GeoJSON, MVT } from 'ol/format';
import { DragAndDrop, Select } from 'ol/interaction';
import {
  Image as ImageLayer,
  Layer,
  Vector as VectorLayer,
  VectorTile as VectorTileLayer,
  WebGLTile as WebGlTileLayer
} from 'ol/layer';
import TileLayer from 'ol/layer/Tile';
import {
  fromLonLat,
  get as getRegisteredProjection,
  toLonLat,
  transformExtent
} from 'ol/proj';
import { get as getProjection } from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import Feature from 'ol/render/Feature';
import {
  GeoTIFF as GeoTIFFSource,
  ImageTile as ImageTileSource,
  Vector as VectorSource,
  VectorTile as VectorTileSource,
  XYZ as XYZSource
} from 'ol/source';
import Static from 'ol/source/ImageStatic';
import TileSource from 'ol/source/Tile';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { Rule } from 'ol/style/flat';
import proj4 from 'proj4';
//@ts-expect-error no types for proj4list
import proj4list from 'proj4-list';
import * as React from 'react';
import AnnotationFloater from '../annotations/components/AnnotationFloater';
import { CommandIDs } from '../constants';
import StatusBar from '../statusbar/StatusBar';
import {
  isLightTheme,
  loadFile,
  loadGeoTIFFWithCache,
  throttle
} from '../tools';
import CollaboratorPointers, { ClientPointer } from './CollaboratorPointers';
import { FollowIndicator } from './FollowIndicator';
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
  annotations: IDict<IAnnotation>;
  clientPointers: IDict<ClientPointer>;
  viewProjection: { code: string; units: string };
  loadingLayer: boolean;
  scale: number;
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
    this._model.sharedModel.changed.connect(this._onSharedModelStateChange);
    this._mainViewModel.jGISModel.sharedMetadataChanged.connect(
      this._onSharedMetadataChanged,
      this
    );
    this._model.zoomToPositionSignal.connect(this._onZoomToPosition, this);

    this.state = {
      id: this._mainViewModel.id,
      lightTheme: isLightTheme(),
      loading: true,
      firstLoad: true,
      annotations: {},
      clientPointers: {},
      viewProjection: { code: '', units: '' },
      loadingLayer: false,
      scale: 0
    };

    this._sources = [];
    this._loadingLayers = new Set();
    this._commands = new CommandRegistry();
    this._contextMenu = new ContextMenu({ commands: this._commands });
  }

  async componentDidMount(): Promise<void> {
    window.addEventListener('resize', this._handleWindowResize);
    await this.generateScene();
    this.addContextMenu();
    this._mainViewModel.initSignal();
    if (window.jupytergisMaps !== undefined && this._documentPath) {
      window.jupytergisMaps[this._documentPath] = this._Map;
    }
  }

  componentWillUnmount(): void {
    if (window.jupytergisMaps !== undefined && this._documentPath) {
      delete window.jupytergisMaps[this._documentPath];
    }
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

      // Add map interactions
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

        this.addLayer(layerId, layerModel, this.getLayerIDs().length);
        this._model.addLayer(layerId, layerModel);
      });

      this._Map.addInteraction(dragAndDropInteraction);

      this.createSelectInteraction();

      const view = this._Map.getView();

      // TODO: Note for the future, will need to update listeners if view changes
      view.on(
        'change:center',
        throttle(() => {
          // Not syncing center if following someone else
          if (this._model.localState?.remoteUser) {
            return;
          }
          const view = this._Map.getView();
          const center = view.getCenter();
          const zoom = view.getZoom();
          if (!center || !zoom) {
            return;
          }
          this._model.syncViewport(
            { coordinates: { x: center[0], y: center[1] }, zoom },
            this._mainViewModel.id
          );
        })
      );

      this._Map.on('postrender', () => {
        if (this.state.annotations) {
          this._updateAnnotation();
        }
      });

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
        const resolution = view.getResolution();

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

        // Calculate scale
        if (resolution) {
          // DPI and inches per meter values taken from OpenLayers
          const dpi = 25.4 / 0.28;
          const inchesPerMeter = 1000 / 25.4;
          const scale = resolution * inchesPerMeter * dpi;

          this.setState(old => ({
            ...old,
            scale
          }));
        }
      });

      this._Map.on('click', this._identifyFeature.bind(this));

      this._Map
        .getViewport()
        .addEventListener('pointermove', this._onPointerMove.bind(this));

      if (JupyterGISModel.getOrderedLayerIds(this._model).length !== 0) {
        await this._updateLayersImpl(
          JupyterGISModel.getOrderedLayerIds(this._model)
        );
        const options = this._model.getOptions();
        this.updateOptions(options);
        this._initializedPosition = true;
      }

      this._Map.getViewport().addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
        const coordinate = this._Map.getEventCoordinate(event);
        this._clickCoords = coordinate;
        this._contextMenu.open(event);
      });

      this.setState(old => ({
        ...old,
        loading: false,
        viewProjection: {
          code: view.getProjection().getCode(),
          units: view.getProjection().getUnits()
        }
      }));
    }
  }

  createSelectInteraction = () => {
    const pointStyle = new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({
          color: '#C52707'
        }),
        stroke: new Stroke({
          color: '#171717',
          width: 2
        })
      })
    });

    const lineStyle = new Style({
      stroke: new Stroke({
        color: '#171717',
        width: 2
      })
    });

    const polygonStyle = new Style({
      fill: new Fill({ color: '#C5270780' }),
      stroke: new Stroke({
        color: '#171717',
        width: 2
      })
    });

    const styleFunction = (feature: FeatureLike) => {
      const geometryType = feature.getGeometry()?.getType();
      switch (geometryType) {
        case 'Point':
        case 'MultiPoint':
          return pointStyle;
        case 'LineString':
        case 'MultiLineString':
          return lineStyle;
        case 'Polygon':
        case 'MultiPolygon':
          return polygonStyle;
      }
    };

    const selectInteraction = new Select({
      hitTolerance: 5,
      multi: true,
      layers: layer => {
        const localState = this._model?.sharedModel.awareness.getLocalState();
        const selectedLayers = localState?.selected?.value;

        if (!selectedLayers) {
          return false;
        }
        const selectedLayerId = Object.keys(selectedLayers)[0];

        return layer === this.getLayer(selectedLayerId);
      },
      condition: (event: MapBrowserEvent<any>) => {
        return singleClick(event) && this._model.isIdentifying;
      },
      style: styleFunction
    });

    selectInteraction.on('select', event => {
      const identifiedFeatures: IDict<any> = [];
      selectInteraction.getFeatures().forEach(feature => {
        identifiedFeatures.push(feature.getProperties());
      });

      this._model.syncIdentifiedFeatures(
        identifiedFeatures,
        this._mainViewModel.id
      );
    });

    this._Map.addInteraction(selectInteraction);
  };

  addContextMenu = (): void => {
    this._commands.addCommand(CommandIDs.addAnnotation, {
      execute: () => {
        if (!this._Map) {
          return;
        }

        this._mainViewModel.addAnnotation({
          position: { x: this._clickCoords[0], y: this._clickCoords[1] },
          zoom: this._Map.getView().getZoom() ?? 0,
          label: 'New annotation',
          contents: [],
          parent: this._Map.getViewport().id
        });
      },
      label: 'Add annotation',
      isEnabled: () => {
        return !!this._Map;
      }
    });

    this._contextMenu.addItem({
      command: CommandIDs.addAnnotation,
      selector: '.ol-viewport',
      rank: 1
    });
  };

  private async _loadGeoTIFFWithCache(sourceInfo: {
    url?: string | undefined;
  }) {
    const result = await loadGeoTIFFWithCache(sourceInfo);
    return result?.file;
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
          (await loadFile({
            filepath: source.parameters?.path,
            type: 'GeoJSONSource',
            model: this._model
          }));

        const format = new GeoJSON({
          featureProjection: this._Map.getView().getProjection()
        });

        // TODO: Don't hardcode projection
        const featureArray = format.readFeatures(data, {
          dataProjection: 'EPSG:4326',
          featureProjection: this._Map.getView().getProjection()
        });

        const featureCollection = new Collection(featureArray);

        featureCollection.forEach(feature => {
          feature.setId(getUid(feature));
        });

        newSource = new VectorSource({
          features: featureCollection
        });

        break;
      }
      case 'ShapefileSource': {
        const parameters = source.parameters as IShapefileSource;

        const geojson = await loadFile({
          filepath: parameters.path,
          type: 'ShapefileSource',
          model: this._model
        });

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

        const imageUrl = await loadFile({
          filepath: sourceParameters.path,
          type: 'ImageSource',
          model: this._model
        });

        newSource = new Static({
          imageExtent: extent,
          url: imageUrl,
          interpolate: false,
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

        const addNoData = (url: (typeof sourceParameters.urls)[0]) => {
          return { ...url, nodata: 0 };
        };
        const sourcesWithBlobs = await Promise.all(
          sourceParameters.urls.map(async sourceInfo => {
            const blob = await this._loadGeoTIFFWithCache(sourceInfo);
            return { ...addNoData(sourceInfo), blob };
          })
        );

        newSource = new GeoTIFFSource({
          sources: sourcesWithBlobs,
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
    await this.addSource(id, source, layerId);
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

  /**
   * Updates the position and existence of layers in the OL map based on the layer IDs.
   *
   * @param layerIds - An array of layer IDs that should be present on the map.
   * @returns {} Nothing is returned.
   */
  private async _updateLayersImpl(layerIds: string[]): Promise<void> {
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

      if (!layer) {
        console.warn(
          `Layer with ID ${layerId} does not exist in the shared model.`
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
        this._Map.removeLayer(layer);
      }
    });

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
  ): Promise<Layer | undefined> {
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getLayerSource(sourceId);
    if (!source) {
      return;
    }

    this.setState(old => ({ ...old, loadingLayer: true }));
    this._loadingLayers.add(id);

    if (!this._sources[sourceId]) {
      await this.addSource(sourceId, source, id);
    }

    this._loadingLayers.add(id);

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

    await this._waitForSourceReady(newMapLayer);

    // OpenLayers doesn't have name/id field so add it
    newMapLayer.set('id', id);

    // we need to keep track of which source has which layers
    this._sourceToLayerMap.set(layerParameters.source, id);

    this.addProjection(newMapLayer);

    this._loadingLayers.delete(id);

    return newMapLayer;
  }

  addProjection(newMapLayer: Layer) {
    const sourceProjection = newMapLayer.getSource()?.getProjection();
    if (!sourceProjection) {
      console.warn('Layer source projection is undefined or invalid');
      return;
    }

    const projectionCode = sourceProjection.getCode();

    const isProjectionRegistered = getRegisteredProjection(projectionCode);
    if (!isProjectionRegistered) {
      // Check if the projection exists in proj4list
      if (!proj4list[projectionCode]) {
        console.warn(
          `Projection code '${projectionCode}' not found in proj4list`
        );
        return;
      }

      try {
        proj4.defs([proj4list[projectionCode]]);
        register(proj4);
      } catch (error: any) {
        console.warn(
          `Failed to register projection '${projectionCode}'. Error: ${error.message}`
        );
        return;
      }
    }
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
      await this._waitForReady();

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
    mapLayer: Layer
  ): Promise<void> {
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getLayerSource(sourceId);
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
   * Wait for all layers to be loaded.
   */
  private _waitForReady(): Promise<void> {
    return new Promise(resolve => {
      const checkReady = () => {
        if (this._loadingLayers.size === 0) {
          this.setState(old => ({ ...old, loadingLayer: false }));
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
  private _waitForSourceReady(layer: Layer) {
    return new Promise<void>((resolve, reject) => {
      const checkState = () => {
        const state = layer.getSourceState();
        if (state === 'ready') {
          layer.un('change', checkState);
          resolve();
        } else if (state === 'error') {
          layer.un('change', checkState);
          reject(new Error('Source failed to load.'));
        }
      };

      // Listen for state changes
      layer.on('change', checkState);

      // Check the state immediately in case it's already 'ready'
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
      this._Map.removeLayer(mapLayer);
    }
  }

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>
  ): void => {
    const remoteUser = this._model.localState?.remoteUser;
    // If we are in following mode, we update our position and selection
    if (remoteUser) {
      const remoteState = clients.get(remoteUser);
      if (!remoteState) {
        return;
      }

      if (remoteState.user?.username !== this.state.remoteUser?.username) {
        this.setState(old => ({ ...old, remoteUser: remoteState.user }));
      }

      const remoteViewport = remoteState.viewportState;

      if (remoteViewport.value) {
        const { x, y } = remoteViewport.value.coordinates;
        const zoom = remoteViewport.value.zoom;

        this._moveToPosition({ x, y }, zoom, 0);
      }
    } else {
      // If we are unfollowing a remote user, we reset our center and zoom to their previous values
      if (this.state.remoteUser !== null) {
        this.setState(old => ({ ...old, remoteUser: null }));
        const viewportState = this._model.localState?.viewportState?.value;

        if (viewportState) {
          this._moveToPosition(viewportState.coordinates, viewportState.zoom);
        }
      }
    }

    // cursors
    clients.forEach((client, clientId) => {
      if (!client?.user) {
        return;
      }

      const pointer = client.pointer?.value;

      // We already display our own cursor on mouse move
      if (this._model.getClientId() === clientId) {
        return;
      }

      const clientPointers = this.state.clientPointers;
      let currentClientPointer = clientPointers[clientId];

      if (pointer) {
        const pixel = this._Map.getPixelFromCoordinate([
          pointer.coordinates.x,
          pointer.coordinates.y
        ]);

        const lonLat = toLonLat([pointer.coordinates.x, pointer.coordinates.y]);

        if (!currentClientPointer) {
          currentClientPointer = clientPointers[clientId] = {
            username: client.user.username,
            displayName: client.user.display_name,
            color: client.user.color,
            coordinates: { x: pixel[0], y: pixel[1] },
            lonLat: { longitude: lonLat[0], latitude: lonLat[1] }
          };
        }

        currentClientPointer.coordinates.x = pixel[0];
        currentClientPointer.coordinates.y = pixel[1];
        clientPointers[clientId] = currentClientPointer;
      } else {
        delete clientPointers[clientId];
      }

      this.setState(old => ({ ...old, clientPointers: clientPointers }));
    });
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

  private async updateOptions(options: IJGISOptions): Promise<void> {
    const {
      projection,
      extent,
      useExtent,
      latitude,
      longitude,
      zoom,
      bearing
    } = options;

    let view = this._Map.getView();
    const currentProjection = view.getProjection().getCode();

    // Need to recreate view if the projection changes
    if (projection !== undefined && currentProjection !== projection) {
      const newProjection = getProjection(projection);
      if (newProjection) {
        view = new View({ projection: newProjection });
      } else {
        console.warn(`Invalid projection: ${projection}`);
        return;
      }
    }

    // Use the extent only if explicitly requested (QGIS files).
    if (useExtent && extent) {
      view.fit(extent);
    } else {
      const centerCoord = fromLonLat(
        [longitude || 0, latitude || 0],
        view.getProjection()
      );

      this._moveToPosition({ x: centerCoord[0], y: centerCoord[1] }, zoom || 0);

      // Save the extent if it does not exists, to allow proper export to qgis.
      if (!options.extent) {
        options.extent = view.calculateExtent();
        this._model.setOptions(options);
      }
    }

    view.setRotation(bearing || 0);

    this._Map.setView(view);
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
      .find(layer => layer.get('id') === id) as Layer;
  }

  /**
   * Convenience method to get a specific layer index from OpenLayers Map
   * @param id Layer to retrieve
   */
  private getLayerIndex(id: string) {
    return this._Map
      .getLayers()
      .getArray()
      .findIndex(layer => layer.get('id') === id);
  }

  /**
   * Convenience method to get list layer IDs from the OpenLayers Map
   */
  private getLayerIDs(): string[] {
    return this._Map
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
  moveLayer(id: string, index: number): void {
    const currentIndex = this.getLayerIndex(id);
    if (currentIndex === index || currentIndex === -1) {
      return;
    }
    const layer = this.getLayer(id);
    let nextIndex = index;
    // should not be undefined since the id exists above
    if (layer === undefined) {
      return;
    }
    this._Map.getLayers().removeAt(currentIndex);
    if (currentIndex < index) {
      nextIndex -= 1;
    }
    this._Map.getLayers().insertAt(nextIndex, layer);
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

  private _onSharedModelStateChange = (
    _: any,
    change: IJupyterGISDocChange
  ) => {
    const changedState = change.stateChange?.map(value => value.name);
    if (!changedState?.includes('path')) {
      return;
    }
    const path = this._model.sharedModel.getState('path');
    if (path !== this._documentPath && typeof path === 'string') {
      if (window.jupytergisMaps !== undefined && this._documentPath) {
        delete window.jupytergisMaps[this._documentPath];
      }
      this._documentPath = path;
      if (window.jupytergisMaps !== undefined) {
        window.jupytergisMaps[this._documentPath] = this._Map;
      }
    }
  };

  private _onSharedMetadataChanged = (
    _: IJupyterGISModel,
    changes: MapChange
  ) => {
    const newState = { ...this.state.annotations };
    changes.forEach((val, key) => {
      if (!key.startsWith('annotation')) {
        return;
      }
      const data = this._model.sharedModel.getMetadata(key);
      let open = true;
      if (this.state.firstLoad) {
        open = false;
      }

      if (data && (val.action === 'add' || val.action === 'update')) {
        const jsonData = JSON.parse(data);
        jsonData['open'] = open;
        newState[key] = jsonData;
      } else if (val.action === 'delete') {
        delete newState[key];
      }
    });

    this.setState(old => ({ ...old, annotations: newState, firstLoad: false }));
  };

  private _computeAnnotationPosition(annotation: IAnnotation) {
    const { x, y } = annotation.position;
    const pixels = this._Map.getPixelFromCoordinate([x, y]);

    if (pixels) {
      return { x: pixels[0], y: pixels[1] };
    }
  }

  private _updateAnnotation() {
    Object.keys(this.state.annotations).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        const annotation = this._model.annotationModel?.getAnnotation(key);
        if (annotation) {
          const screenPosition = this._computeAnnotationPosition(annotation);
          if (screenPosition) {
            el.style.left = `${Math.round(screenPosition.x)}px`;
            el.style.top = `${Math.round(screenPosition.y)}px`;
          }
        }
      }
    });
  }

  private _onZoomToPosition(_: IJupyterGISModel, id: string) {
    // Check if the id is an annotation
    const annotation = this._model.annotationModel?.getAnnotation(id);
    if (annotation) {
      this._moveToPosition(annotation.position, annotation.zoom);
      return;
    }

    // The id is a layer
    let extent;
    const layer = this.getLayer(id) as Layer;
    const source = layer?.getSource();

    if (source instanceof VectorSource) {
      extent = source.getExtent();
    }

    if (source instanceof TileSource) {
      // Tiled sources don't have getExtent() so we get it from the grid
      const tileGrid = source.getTileGrid();
      extent = tileGrid?.getExtent();
    }

    if (!extent) {
      console.warn('Layer has no extent.');
      return;
    }

    // Convert layer extent value to view projection if needed
    const sourceProjection = source?.getProjection();
    const viewProjection = this._Map.getView().getProjection();

    const transformedExtent =
      sourceProjection && sourceProjection !== viewProjection
        ? transformExtent(extent, sourceProjection, viewProjection)
        : extent;

    this._Map.getView().fit(transformedExtent, {
      size: this._Map.getSize(),
      duration: 500
    });
  }

  private _moveToPosition(
    center: { x: number; y: number },
    zoom: number,
    duration = 1000
  ) {
    const view = this._Map.getView();

    // Zoom needs to be set before changing center
    if (!view.animate === undefined) {
      view.animate({ zoom, duration });
      view.animate({ center: [center.x, center.y], duration });
    } else {
      view.setZoom(zoom);
      view.setCenter([center.x, center.y]);
    }
  }

  private _onPointerMove(e: MouseEvent) {
    const pixel = this._Map.getEventPixel(e);
    const coordinates = this._Map.getCoordinateFromPixel(pixel);

    this._syncPointer(coordinates);
  }

  private _syncPointer = throttle((coordinates: Coordinate) => {
    const pointer = {
      coordinates: { x: coordinates[0], y: coordinates[1] }
    };
    this._model.syncPointer(pointer);
  });

  private _identifyFeature(e: MapBrowserEvent<any>) {
    if (!this._model.isIdentifying) {
      return;
    }

    const localState = this._model?.sharedModel.awareness.getLocalState();
    const selectedLayer = localState?.selected?.value;

    if (!selectedLayer) {
      console.warn('Layer must be selected to use identify tool');
      return;
    }

    const layerId = Object.keys(selectedLayer)[0];
    const jgisLayer = this._model.getLayer(layerId);

    switch (jgisLayer?.type) {
      case 'WebGlLayer': {
        const layer = this.getLayer(layerId) as WebGlTileLayer;
        const data = layer.getData(e.pixel);

        // TODO: Handle dataviews?
        if (!data || data instanceof DataView) {
          return;
        }

        const bandValues: IDict<number> = {};

        // Data is an array of band values
        for (let i = 0; i < data.length - 1; i++) {
          bandValues[`Band ${i + 1}`] = data[i];
        }

        // last element is alpha
        bandValues['Alpha'] = data[data.length - 1];

        this._model.syncIdentifiedFeatures(
          [bandValues],
          this._mainViewModel.id
        );

        break;
      }
    }
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
      <>
        {Object.entries(this.state.annotations).map(([key, annotation]) => {
          if (!this._model.annotationModel) {
            return null;
          }
          const screenPosition = this._computeAnnotationPosition(annotation);
          return (
            screenPosition && (
              <div
                key={key}
                id={key}
                style={{
                  left: screenPosition.x,
                  top: screenPosition.y
                }}
                className={'jGIS-Popup-Wrapper'}
              >
                <AnnotationFloater
                  itemId={key}
                  annotationModel={this._model.annotationModel}
                  open={false}
                />
              </div>
            )
          );
        })}

        <div
          className="jGIS-Mainview"
          style={{
            border: this.state.remoteUser
              ? `solid 3px ${this.state.remoteUser.color}`
              : 'unset'
          }}
        >
          <Spinner loading={this.state.loading} />
          <FollowIndicator remoteUser={this.state.remoteUser} />
          <CollaboratorPointers clients={this.state.clientPointers} />

          <div
            ref={this.divRef}
            style={{
              width: '100%',
              height: 'calc(100%)'
            }}
          />
        </div>
        <StatusBar
          jgisModel={this._model}
          loading={this.state.loadingLayer}
          projection={this.state.viewProjection}
          scale={this.state.scale}
        />
      </>
    );
  }

  private _clickCoords: Coordinate;
  private _commands: CommandRegistry;
  private _initializedPosition = false;
  private divRef = React.createRef<HTMLDivElement>(); // Reference of render div
  private _Map: OlMap;
  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _sources: Record<string, any>;
  private _sourceToLayerMap = new Map();
  private _documentPath?: string;
  private _contextMenu: ContextMenu;
  private _loadingLayers: Set<string>;
}
