import { MapChange } from '@jupyter/ydoc';
import {
  IAnnotation,
  IAnnotationModel,
  IDict,
  IGeoTiffSource,
  IHeatmapLayer,
  IHillshadeLayer,
  IImageLayer,
  IImageSource,
  IJGISFilterItem,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISOptions,
  IJGISSource,
  IJGISSourceDocChange,
  IIdentifiedFeature,
  IIdentifiedFeatureEntry,
  IIdentifiedFeatures,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISDocChange,
  IJupyterGISModel,
  IRasterDemSource,
  IRasterLayer,
  IRasterSource,
  IShapefileSource,
  IStacLayer,
  IVectorLayer,
  IVectorTileLayer,
  IVectorTileSource,
  IGeoParquetSource,
  IGeoTiffLayer,
  JgisCoordinates,
  JupyterGISModel,
  IMarkerSource,
  IStorySegmentLayer,
  IWmsTileSource,
  IJupyterGISSettings,
  DEFAULT_PROJECTION,
  IViewState,
} from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { JSONValue, UUID } from '@lumino/coreutils';
import { ContextMenu, Menu } from '@lumino/widgets';
import {
  Collection,
  MapBrowserEvent,
  Map as OlMap,
  VectorTile,
  View,
  getUid,
} from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import TileState from 'ol/TileState';
import { FullScreen, ScaleLine, Zoom, Control } from 'ol/control';
import { Coordinate } from 'ol/coordinate';
import { singleClick } from 'ol/events/condition';
import { getCenter, getSize } from 'ol/extent';
import { GeoJSON, MVT } from 'ol/format';
import { Geometry, Point } from 'ol/geom';
import { Type } from 'ol/geom/Geometry';
import {
  DragAndDrop,
  DragPan,
  DragRotate,
  DragZoom,
  KeyboardPan,
  KeyboardZoom,
  MouseWheelZoom,
  PinchRotate,
  PinchZoom,
  DoubleClickZoom,
  Select,
} from 'ol/interaction';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import {
  Heatmap as HeatmapLayer,
  Image as ImageLayer,
  Layer,
  Vector as VectorLayer,
  VectorImage as VectorImageLayer,
  VectorTile as VectorTileLayer,
  WebGLTile as GeoTiffLayer,
} from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import {
  fromLonLat,
  get as getProjection,
  toLonLat,
  transformExtent,
} from 'ol/proj';
import { register } from 'ol/proj/proj4.js';
import RenderFeature, { toGeometry } from 'ol/render/Feature';
import {
  GeoTIFF as GeoTIFFSource,
  ImageTile as ImageTileSource,
  Source,
  TileWMS as TileWMSSource,
  Vector as VectorSource,
  VectorTile as VectorTileSource,
  XYZ as XYZSource,
  Tile as TileSource,
} from 'ol/source';
import Static from 'ol/source/ImageStatic';
import { TileSourceEvent } from 'ol/source/Tile';
import { Circle, Fill, Icon, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import { Rule } from 'ol/style/flat';
//@ts-expect-error no types for ol-pmtiles
import { PMTilesRasterSource, PMTilesVectorSource } from 'ol-pmtiles';
import StacLayer from 'ol-stac';
import proj4 from 'proj4';
import proj4list from 'proj4-list';
import * as React from 'react';

import { CommandIDs } from '@/src/constants';
import AnnotationFloater from '@/src/features/annotations/components/AnnotationFloater';
import FeatureFloater from '@/src/features/identify/components/FeatureFloater';
import { getFeatureIdentifier } from '@/src/features/identify/utils/getFeatureIdentifier';
import { LoadingOverlay } from '@/src/shared/components/loading';
import useMediaQuery from '@/src/shared/hooks/useMediaQuery';
import { markerIcon } from '@/src/shared/icons';
import {
  debounce,
  INTERNAL_PROXY_BASE,
  isJupyterLite,
  isLightTheme,
  loadFile,
  throttle,
} from '@/src/tools';
import StatusBar from '@/src/workspace/statusbar/StatusBar';
import CollaboratorPointers, { ClientPointer } from './CollaboratorPointers';
import { FollowIndicator } from './FollowIndicator';
import TemporalSlider from './TemporalSlider';
import {
  createGeoJSONFeaturePatcher,
  type PatchGeoJSONFeatureProperties,
} from './geoJsonFeaturePatch';
import { MainViewModel } from './mainviewmodel';
import {
  DEFAULT_FLAT_STYLE,
  buildTransparentFallbackFilter,
  buildVectorFlatStyle,
} from '../features/layers/symbology/styleBuilder';
import { SpectaPanel } from '../features/story/SpectaPanel';
import type { IStoryViewerPanelHandle } from '../features/story/StoryViewerPanel';
import { LeftPanel, MergedPanel, RightPanel } from '../workspace/panels';

type OlLayerTypes =
  | TileLayer
  | VectorLayer
  | VectorImageLayer
  | VectorTileLayer
  | GeoTiffLayer
  | HeatmapLayer
  | StacLayer
  | ImageLayer<any>;

const DRAW_GEOMETRIES = ['Point', 'LineString', 'Polygon'] as const;

const drawInteractionStyle = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: '#ffcc33',
    width: 2,
  }),
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({
      color: '#ffcc33',
    }),
  }),
});

interface IMainViewProps {
  viewModel: MainViewModel;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  loggerRegistry?: ILoggerRegistry;
  /** True when viewport matches (max-width: 768px). Injected by MainViewWithMediaQuery. */
  isMobile: boolean;
}

interface IStates {
  id: string; // ID of the component, it is used to identify which component
  //is the source of awareness updates.
  loading: boolean;
  lightTheme: boolean;
  remoteUser?: User.IIdentity | null;
  annotations: IDict<IAnnotation>;
  clientPointers: IDict<ClientPointer>;
  viewProjection: { code: string; units: string };
  loadingLayer: boolean;
  scale: number;
  loadingErrors: Array<{ id: string; error: any; index: number }>;
  displayTemporalController: boolean;
  filterStates: IDict<IJGISFilterItem | undefined>;
  editingVectorLayer: boolean;
  drawGeometryLabel: string | undefined;
  jgisSettings: IJupyterGISSettings;
  isSpectaPresentation: boolean;
  initialLayersReady: boolean;
  identifyFeatureFloatersVersion: number;
}

export class MainView extends React.Component<IMainViewProps, IStates> {
  constructor(props: IMainViewProps) {
    super(props);
    this._state = props.state;

    this._formSchemaRegistry = props.formSchemaRegistry;

    this._annotationModel = props.annotationModel;

    this._loggerRegistry = props.loggerRegistry;

    // Enforce the map to take the full available width in the case of Jupyter Notebook viewer
    const el = document.getElementById('main-panel');

    if (el) {
      const setWidthOneHundred = (selector: string) => {
        (document.querySelector(selector) as HTMLElement).style.setProperty(
          'width',
          '100%',
        );
      };
      //We need to observe the size to counteract
      //What the default jupyter plugin will try
      //To do dynamically with the width
      const resizeObserver = new ResizeObserver(_ => {
        el.style.setProperty('width', '100%');
        el.style.setProperty('max-width', '100%');
        el?.style.setProperty('left', '0px');

        setWidthOneHundred('#main-panel jp-toolbar');
        setWidthOneHundred('#main-panel .lm-SplitPanel ');

        setWidthOneHundred(
          '#main-panel   .lm-SplitPanel .lm-SplitPanel-child ',
        );
      });

      resizeObserver.observe(el);
    }

    this._mainViewModel = this.props.viewModel;
    this._mainViewModel.viewSettingChanged.connect(this._onViewChanged, this);

    this._model = this._mainViewModel.jGISModel;
    this._patchGeoJSONFeatureProperties = createGeoJSONFeaturePatcher({
      model: this._model,
      persistAndRefreshSource: this.persistAndRefreshSource,
    });
    this._model.themeChanged.connect(this._handleThemeChange, this);

    this._model.sharedOptionsChanged.connect(
      this._onSharedOptionsChanged,
      this,
    );
    this._model.temporalControllerActiveChanged.connect(
      this._handleTemporalControllerActiveChanged,
      this,
    );
    const remoteUserSignals = [
      this._model.remoteUserChanged,
      this._model.viewportStateChanged,
    ];
    remoteUserSignals.forEach(signal =>
      signal.connect(this._handleRemoteUserChanged, this),
    );
    this._model.pointerChanged.connect(this._handlePointerChanged, this);
    this._model.selectedChanged.connect(
      this._handleTemporalControllerActiveChanged,
      this,
    );
    this._model.selectedChanged.connect(this._handleSelectedChanged, this);
    this._model.sharedLayersChanged.connect(this._onLayersChanged, this);
    this._model.sharedLayerTreeChanged.connect(this._onLayerTreeChange, this);
    this._model.sharedSourcesChanged.connect(this._onSourcesChange, this);
    this._model.sharedModel.changed.connect(this._onSharedModelStateChange);
    this._model.sharedMetadataChanged.connect(
      this._onSharedMetadataChanged,
      this,
    );

    this._model.identifiedFeaturesChanged.connect(
      this._handleIdentifiedFeaturesChanged,
      this,
    );
    this._model.zoomToPositionSignal.connect(this._onZoomToPosition, this);
    this._model.settingsChanged.connect(this._onSettingsChanged, this);
    this._model.updateLayerSignal.connect(this._triggerLayerUpdate, this);
    this._model.addFeatureAsMsSignal.connect(this._convertFeatureToMs, this);
    this._model.geolocationChanged.connect(
      this._handleGeolocationChanged,
      this,
    );

    // Keep draw editing UI/interactions in sync with the shared editing mode.
    this._model.editingVectorLayerChanged.connect(
      this._updateEditingVectorLayer,
      this,
    );

    this._model.flyToGeometrySignal.connect(this.flyToGeometry, this);
    this._model.highlightFeatureSignal.connect(
      this.highlightFeatureOnMap,
      this,
    );

    Promise.resolve().then(() => {
      this._syncSettingsFromRegistry();
    });

    this.state = {
      id: this._mainViewModel.id,
      lightTheme: isLightTheme(),
      loading: true,
      annotations: {},
      clientPointers: {},
      viewProjection: { code: '', units: '' },
      loadingLayer: false,
      scale: 0,
      loadingErrors: [],
      displayTemporalController: false,
      filterStates: {},
      editingVectorLayer: false,
      drawGeometryLabel: '',
      jgisSettings: this._model.jgisSettings,
      isSpectaPresentation: this._model.isSpectaMode(),
      initialLayersReady: false,
      identifyFeatureFloatersVersion: 0,
    };

    this._sources = [];
    this._loadingLayers = new Set();
    this._commands = new CommandRegistry();
    this._contextMenu = new ContextMenu({
      commands: this._commands,
    });
    this._updateCenter = debounce(this.updateCenter, 100);
  }

  async componentDidMount(): Promise<void> {
    if (this._loggerRegistry) {
      const logger = this._loggerRegistry.getLogger(this._model.filePath);
      logger.level = 'debug';
    }

    window.addEventListener('resize', this._handleWindowResize);
    const options = this._model.getOptions();
    const projection = options.projection ?? DEFAULT_PROJECTION;
    const center =
      options.longitude !== undefined && options.latitude !== undefined
        ? fromLonLat([options.longitude, options.latitude], projection)
        : [0, 0];
    const zoom = options.zoom !== undefined ? options.zoom : 1;

    await this.generateMap(center, zoom, projection);
    this._handleRemoteUserChanged();
    this._handlePointerChanged();
    this._handleTemporalControllerActiveChanged();
    this._handleSelectedChanged();
    this._mainViewModel.initSignal();
    if (window.jupytergisMaps !== undefined && this._documentPath) {
      window.jupytergisMaps[this._documentPath] = this._Map;
    }
  }

  componentDidUpdate(prevProps: IMainViewProps, prevState: IStates): void {
    // Run setup when isSpectaPresentation changes from false/undefined to true
    if (
      this.state.isSpectaPresentation &&
      !this._isSpectaPresentationInitialized
    ) {
      this._setupSpectaMode();
      this._isSpectaPresentationInitialized = true;
    }
  }

  componentWillUnmount(): void {
    if (window.jupytergisMaps !== undefined && this._documentPath) {
      delete window.jupytergisMaps[this._documentPath];
    }
    window.removeEventListener('resize', this._handleWindowResize);
    this._mainViewModel.viewSettingChanged.disconnect(
      this._onViewChanged,
      this,
    );

    this._model.themeChanged.disconnect(this._handleThemeChange, this);
    this._model.settingsChanged.disconnect(this._onSettingsChanged, this);
    this._model.sharedOptionsChanged.disconnect(
      this._onSharedOptionsChanged,
      this,
    );

    this._model.temporalControllerActiveChanged.disconnect(
      this._handleTemporalControllerActiveChanged,
      this,
    );
    const remoteUserSignals = [
      this._model.remoteUserChanged,
      this._model.viewportStateChanged,
    ];
    remoteUserSignals.forEach(signal =>
      signal.disconnect(this._handleRemoteUserChanged, this),
    );
    this._model.pointerChanged.disconnect(this._handlePointerChanged, this);
    this._model.selectedChanged.disconnect(
      this._handleTemporalControllerActiveChanged,
      this,
    );
    this._model.selectedChanged.disconnect(this._handleSelectedChanged, this);
    this._model.identifiedFeaturesChanged.disconnect(
      this._handleIdentifiedFeaturesChanged,
      this,
    );

    // Clean up story scroll listener
    this._cleanupStoryScrollListener();

    this._mainViewModel.dispose();
  }

  async generateMap(
    center: number[],
    zoom: number,
    projection = DEFAULT_PROJECTION,
  ): Promise<void> {
    const layers = this._model.getLayers();

    this._initialLayersCount = Object.values(layers).filter(
      layer => layer.type !== 'StorySegmentLayer',
    ).length;

    const scaleLine = new ScaleLine({
      target: this.controlsToolbarRef.current || undefined,
    });

    const fullScreen = new FullScreen({
      target: this.controlsToolbarRef.current || undefined,
    });

    const controls: Control[] = [scaleLine, fullScreen];

    if (this._model.jgisSettings.zoomButtonsEnabled) {
      this._zoomControl = new Zoom({
        target: this.controlsToolbarRef.current || undefined,
      });
      controls.push(this._zoomControl);
    }

    if (this.divRef.current) {
      this._Map = new OlMap({
        target: this.divRef.current,
        keyboardEventTarget: document,
        layers: [],
        view: new View({
          center,
          zoom,
          projection,
        }),
        controls,
      });

      // Add map interactions
      const dragAndDropInteraction = new DragAndDrop({
        formatConstructors: [GeoJSON],
      });

      dragAndDropInteraction.on('addfeatures', event => {
        const sourceId = UUID.uuid4();

        const sourceModel: IJGISSource = {
          type: 'GeoJSONSource',
          name: 'Drag and Drop source',
          parameters: { path: event.file.name },
        };

        const layerId = UUID.uuid4();

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
            source: sourceId,
          },
        };

        this.addLayer(layerId, layerModel, this.getLayerIDs().length);
        this._model.addLayer(layerId, layerModel);
      });

      this._Map.addInteraction(dragAndDropInteraction);

      this.createSelectInteraction();

      const view = this._Map.getView();

      const syncViewportThrottled = throttle(() => {
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

        const currentExtent = view.calculateExtent(this._Map.getSize());
        this._model.syncViewport(
          {
            coordinates: {
              x: center[0],
              y: center[1],
            },
            zoom,
            extent: [
              currentExtent[0],
              currentExtent[1],
              currentExtent[2],
              currentExtent[3],
            ],
          },
          this._mainViewModel.id,
        );
      }, 200);

      view.on('change:center', () => {
        this._updateCenter();
        syncViewportThrottled();
      });

      this._Map.on('postrender', () => {
        if (this.state.annotations) {
          this._updateAnnotation();
        }
        this._updateFeatureFloaters();
      });

      this._Map.on('moveend', () => {
        const currentOptions = this._model.getOptions();

        const view = this._Map.getView();
        const center = view.getCenter() || [0, 0];
        const zoom = view.getZoom() || 0;

        const projection =
          getProjection(currentOptions.projection) ?? view.getProjection();
        const latLng = toLonLat(center, projection);
        const bearing = view.getRotation();
        const resolution = view.getResolution();

        const updatedOptions: Partial<IJGISOptions> = {
          latitude: latLng[1],
          longitude: latLng[0],
          bearing,
          projection: projection.getCode(),
          zoom,
        };

        updatedOptions.extent = view.calculateExtent();

        this._model.setOptions({
          ...currentOptions,
          ...updatedOptions,
        });

        // Calculate scale
        if (resolution) {
          // DPI and inches per meter values taken from OpenLayers
          const dpi = 25.4 / 0.28;
          const inchesPerMeter = 1000 / 25.4;
          const scale = resolution * inchesPerMeter * dpi;

          this.setState(old => ({
            ...old,
            scale,
          }));
        }
      });

      this._Map.on('click', this._identifyFeature.bind(this));
      this._Map.on('click', this._addMarker.bind(this));

      this._Map
        .getViewport()
        .addEventListener('pointermove', this._onPointerMove.bind(this));

      if (JupyterGISModel.getOrderedLayerIds(this._model).length !== 0) {
        await this._updateLayersImpl(
          JupyterGISModel.getOrderedLayerIds(this._model),
        );
        const options = this._model.getOptions();
        this.updateOptions(options);
      }

      this._Map.getViewport().addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
        if (this._lastPointerCoord) {
          this._clickCoords = this._lastPointerCoord;
        }
        this._contextMenu.open(event);
      });

      this.setState(old => ({
        ...old,
        loading: false,
        viewProjection: {
          code: projection,
          units: (getProjection(projection) ?? view.getProjection()).getUnits(),
        },
      }));
    }
  }

  updateCenter = () => {
    const extentIn4326 = this.getViewBbox();
    this._model.updateBboxSignal.emit(extentIn4326);
  };

  getViewBbox = (targetProjection = 'EPSG:4326') => {
    const view = this._Map.getView();
    const extent = view.calculateExtent(this._Map.getSize());

    if (view.getProjection().getCode() === targetProjection) {
      return extent;
    }

    return transformExtent(extent, view.getProjection(), targetProjection);
  };

  createSelectInteraction = () => {
    const pointStyle = new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({
          color: '#C52707',
        }),
        stroke: new Stroke({
          color: '#171717',
          width: 2,
        }),
      }),
    });

    const lineStyle = new Style({
      stroke: new Stroke({
        color: '#171717',
        width: 2,
      }),
    });

    const polygonStyle = new Style({
      fill: new Fill({ color: '#C5270780' }),
      stroke: new Stroke({
        color: '#171717',
        width: 2,
      }),
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
        return singleClick(event) && this._model.currentMode === 'identifying';
      },
      style: styleFunction,
    });

    selectInteraction.on('select', event => {
      const identifiedFeatures: IIdentifiedFeatureEntry[] = [];
      selectInteraction.getFeatures().forEach(feature => {
        identifiedFeatures.push({
          feature: feature.getProperties(),
          floaterOpen: false,
        });
      });

      this._model.syncIdentifiedFeatures(
        identifiedFeatures,
        this._mainViewModel.id,
      );
    });

    this._Map.addInteraction(selectInteraction);
  };

  addContextMenu = (): void => {
    this._commands.addCommand(CommandIDs.addAnnotation, {
      label: 'Add annotation',
      describedBy: {
        args: {
          type: 'object',
          properties: {},
        },
      },
      isEnabled: () => {
        return !!this._Map;
      },
      execute: () => {
        if (!this._Map) {
          return;
        }

        this._mainViewModel.addAnnotation({
          position: {
            x: this._clickCoords[0],
            y: this._clickCoords[1],
          },
          zoom: this._Map.getView().getZoom() ?? 0,
          label: 'New annotation',
          contents: [],
          parent: this._Map.getViewport().id,
          open: true,
        });
      },
    });

    this._commands.addCommand('Copy-Coordinates-Map-CRS', {
      label: () => {
        if (!this._Map || !this._clickCoords) {
          return 'Map CRS';
        }

        const proj = this._Map.getView().getProjection().getCode();
        const coord = this._clickCoords;

        return `Map CRS — ${proj} (${coord[0].toFixed(0)}E, ${coord[1].toFixed(0)}N)`;
      },
      execute: async () => {
        const coord = this._clickCoords;
        const text = `${coord[0].toFixed(0)}, ${coord[1].toFixed(0)}`;
        await navigator.clipboard.writeText(text);
      },
    });

    this._commands.addCommand('Copy-Coordinates-LonLat', {
      label: () => {
        if (!this._Map || !this._clickCoords) {
          return 'Latitude/Longitude';
        }

        const lonLat = toLonLat(
          this._clickCoords,
          this._Map.getView().getProjection(),
        );

        return `Latitude/Longitude: (${lonLat[1].toFixed(6)}N, ${lonLat[0].toFixed(6)}E)`;
      },
      execute: async () => {
        const lonLat = toLonLat(
          this._clickCoords,
          this._Map.getView().getProjection(),
        );

        const text = `${lonLat[1].toFixed(6)}, ${lonLat[0].toFixed(6)}`;
        await navigator.clipboard.writeText(text);
      },
    });

    this._contextMenu.addItem({
      command: CommandIDs.addAnnotation,
      selector: '.ol-viewport',
      rank: 1,
    });

    const copyCoordinatesMenu = new Menu({ commands: this._commands });

    copyCoordinatesMenu.title.label = 'Copy Coordinates';

    copyCoordinatesMenu.addItem({
      command: 'Copy-Coordinates-Map-CRS',
    });

    copyCoordinatesMenu.addItem({
      command: 'Copy-Coordinates-LonLat',
    });

    this._contextMenu.addItem({
      type: 'submenu',
      submenu: copyCoordinatesMenu,
      selector: '.ol-viewport',
      rank: 2,
    });
  };

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

        case 'GeoJSONSource': {
          const data =
            source.parameters?.data ||
            (await loadFile({
              filepath: source.parameters?.path,
              type: 'GeoJSONSource',
              model: this._model,
            }));

          const format = new GeoJSON({
            featureProjection: this._Map.getView().getProjection(),
          });

          const featureArray = format.readFeatures(data, {
            featureProjection: this._Map.getView().getProjection(),
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
              featureProjection: this._Map.getView().getProjection(),
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

        case 'VideoSource': {
          this._log('warning', 'Video Tiles not supported with Open Layers');

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

              if (isRemote) {
                return {
                  ...addNoData(sourceInfo),
                  min: sourceInfo.min,
                  max: sourceInfo.max,
                  url: sourceInfo.url,
                };
              } else {
                const geotiff = await loadFile({
                  filepath: sourceInfo.url ?? '',
                  type: 'GeoTiffSource',
                  model: this._model,
                });
                return {
                  ...addNoData(sourceInfo),
                  min: sourceInfo.min,
                  max: sourceInfo.max,
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
              featureProjection: this._Map.getView().getProjection(),
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
    this._sources[id] = newSource;

    this._trackSourceExtZoom(id, newSource);
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
    await this.addSource(id, source);
    // change source of target layer
    mapLayer.setSource(this._sources[id]);
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
    layer: IJGISLayer,
  ): Promise<Layer | StacLayer | undefined> {
    this.setState(old => ({ ...old, loadingLayer: true }));
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
      if (!this._sources[sourceId]) {
        await this.addSource(sourceId, source);
      }
    }

    // TODO: OpenLayers provides a bunch of sources for specific tile
    // providers, so maybe set up some way to use those
    switch (layer.type) {
      case 'RasterLayer': {
        layerParameters = layer.parameters as IRasterLayer;

        newMapLayer = new TileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
        });

        break;
      }
      case 'VectorLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        newMapLayer = new VectorImageLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          style: this.vectorLayerStyleRuleBuilder(layer),
        });

        break;
      }
      case 'VectorTileLayer': {
        layerParameters = layer.parameters as IVectorLayer;

        newMapLayer = new VectorTileLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          style: this.vectorLayerStyleRuleBuilder(layer),
        });

        break;
      }
      case 'HillshadeLayer': {
        layerParameters = layer.parameters as IHillshadeLayer;

        newMapLayer = new GeoTiffLayer({
          opacity: 0.3,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
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
          source: this._sources[layerParameters.source],
        });

        break;
      }
      case 'GeoTiffLayer': {
        layerParameters = layer.parameters as IGeoTiffLayer;

        // This is to handle python sending a None for the color
        const layerOptions: any = {
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
        };

        if (layerParameters.color) {
          layerOptions['style'] = {
            color: layerParameters.color,
          };
        }

        newMapLayer = new GeoTiffLayer(layerOptions);
        break;
      }
      case 'HeatmapLayer': {
        layerParameters = layer.parameters as IHeatmapLayer;

        newMapLayer = new HeatmapLayer({
          opacity: layerParameters.opacity,
          visible: layer.visible,
          source: this._sources[layerParameters.source],
          blur: layerParameters.blur ?? 15,
          radius: layerParameters.radius ?? 8,
          gradient: layerParameters.symbologyState?.gradient,
        });

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

        this.setState(old => ({
          ...old,
          metadata: layerParameters.data.properties,
        }));

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
      await this._waitForSourceReady(newMapLayer);
    }

    this._loadingLayers.delete(id);
    return newMapLayer;
  }

  addProjection(newMapLayer: Layer) {
    const sourceProjection = newMapLayer.getSource()?.getProjection();
    if (!sourceProjection) {
      this._log('warning', 'Layer source projection is undefined or invalid');
      return;
    }

    const projectionCode = sourceProjection.getCode();

    const isProjectionRegistered = getProjection(projectionCode);
    if (!isProjectionRegistered) {
      // Check if the projection exists in proj4list
      if (!proj4list[projectionCode]) {
        this._log(
          'warning',
          `Projection code '${projectionCode}' not found in proj4list`,
        );
        return;
      }

      try {
        proj4.defs([proj4list[projectionCode]]);
        register(proj4 as any);
      } catch (error: any) {
        this._log(
          'warning',
          `Failed to register projection '${projectionCode}'. Error: ${error.message}`,
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

    try {
      const newMapLayer = await this._buildMapLayer(id, layer);
      if (newMapLayer !== undefined) {
        await this._waitForReady();

        // Adjust index to ensure it's within bounds
        const numLayers = this._Map.getLayers().getLength();
        const safeIndex = Math.min(index, numLayers);
        this._Map.getLayers().insertAt(safeIndex, newMapLayer);
        // const newLayerExtent = newMapLayer.getExtent();
        // const shouldZoom = Boolean(
        //   this.state.initialLayersReady && newLayerExtent,
        // );
        const shouldZoom = Boolean(this.state.initialLayersReady);
        this._trackLayerViewState(id, newMapLayer as Layer, shouldZoom);

        // doing +1 instead of calling method again
        if (
          !this.state.initialLayersReady &&
          numLayers + 1 === this._initialLayersCount
        ) {
          this.setState(old => ({ ...old, initialLayersReady: true }));
        }
      }

      this._model.syncSelected(
        { [id]: { type: 'layer' } },
        this._model.getClientId().toString(),
      );
    } catch (error: any) {
      if (
        this.state.loadingErrors.find(
          item => item.id === id && item.error === error.message,
        )
      ) {
        return;
      }

      await showErrorMessage(
        `Error Adding ${layer.name}`,
        `Failed to add ${layer.name}: ${error.message || 'invalid file path'}`,
      );
      this.setState(old => ({ ...old, loadingLayer: false }));
      this.state.loadingErrors.push({
        id,
        error: error.message || 'invalid file path',
        index,
      });
    } finally {
      this._loadingLayers.delete(id);
      this.setState(old => ({ ...old, loadingLayer: false }));
    }
  }

  vectorLayerStyleRuleBuilder = (layer: IJGISLayer) => {
    const layerParams = layer.parameters as IVectorLayer | undefined;
    if (!layerParams) {
      return;
    }

    // Extract feature values for the symbology attribute field if the source
    // is already loaded (VectorSource/GeoJSON). For tile sources pass an empty
    // array – the comment on buildVectorFlatStyle says this is acceptable.
    const field = layerParams.symbologyState?.value;
    const source = this._sources[layerParams.source];
    const featureValues: unknown[] =
      field && source instanceof VectorSource
        ? source.getFeatures().map(f => (f as Feature).get(field))
        : [];

    const layerStyle: Rule = {
      style:
        buildVectorFlatStyle(layerParams.symbologyState, featureValues) ??
        DEFAULT_FLAT_STYLE,
    };

    // User-applied attribute filters.
    if (layer.filters?.logicalOp && layer.filters.appliedFilters?.length > 0) {
      const buildCondition = (filter: IJGISFilterItem): any[] => {
        const base = [filter.operator, ['get', filter.feature]];
        return filter.operator === 'between'
          ? [...base, filter.betweenMin, filter.betweenMax]
          : [...base, filter.value];
      };

      // 'Any' and 'All' operators require more than one argument
      // So if there's only one filter, skip that part to avoid error
      layerStyle.filter =
        layer.filters.appliedFilters.length === 1
          ? buildCondition(layer.filters.appliedFilters[0])
          : [
              layer.filters.logicalOp,
              ...layer.filters.appliedFilters.map(buildCondition),
            ];
    }

    // When `fallbackColor` alpha is 0, exclude features that would render with
    // the fallback color. This was previously done by introspecting the
    // generated OL expressions; now the filter is derived directly from
    // symbologyState (see styleBuilder.buildTransparentFallbackFilter).
    const transparentFilter = buildTransparentFallbackFilter(
      layerParams.symbologyState,
      featureValues,
    );
    if (transparentFilter) {
      layerStyle.filter = layerStyle.filter
        ? ['all', layerStyle.filter, transparentFilter]
        : transparentFilter;
    }

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

  /**
   * Update a layer of the map.
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
        mapLayer.setOpacity(layer.parameters?.opacity || 1);
        break;
      }
      case 'VectorLayer': {
        const layerParams = layer.parameters as IVectorLayer;

        mapLayer.setOpacity(layerParams.opacity || 1);

        (mapLayer as VectorImageLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer),
        );

        break;
      }
      case 'VectorTileLayer': {
        const layerParams = layer.parameters as IVectorTileLayer;

        mapLayer.setOpacity(layerParams.opacity || 1);

        (mapLayer as VectorTileLayer).setStyle(
          this.vectorLayerStyleRuleBuilder(layer),
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
      case 'GeoTiffLayer': {
        mapLayer.setOpacity(layer.parameters?.opacity);

        if (layer?.parameters?.color) {
          (mapLayer as GeoTiffLayer).setStyle({
            color: layer.parameters.color,
          });
        }
        break;
      }
      case 'HeatmapLayer': {
        const layerParams = layer.parameters as IHeatmapLayer;
        const heatmap = mapLayer as HeatmapLayer;

        heatmap.setOpacity(layerParams.opacity ?? 1);
        heatmap.setBlur(layerParams.blur ?? 15);
        heatmap.setRadius(layerParams.radius ?? 8);
        heatmap.setGradient(
          layerParams.symbologyState?.gradient ?? [
            '#00f',
            '#0ff',
            '#0f0',
            '#ff0',
            '#f00',
          ],
        );

        this.handleTemporalController(id, layer);

        break;
      }
      case 'StacLayer':
        mapLayer.setOpacity(layer.parameters?.opacity || 1);
        break;
    }
  }

  /**
   * Heatmap layers don't work with style based filtering.
   * This modifies the features in the underlying source
   * to work with the temporal controller
   */
  handleTemporalController = (id: string, layer: IJGISLayer) => {
    const selectedLayer = this._model?.localState?.selected?.value;

    // Temporal Controller shouldn't be active if more than one layer is selected
    if (!selectedLayer || Object.keys(selectedLayer).length !== 1) {
      return;
    }

    const selectedLayerId = Object.keys(selectedLayer)[0];

    // Don't do anything to unselected layers
    if (selectedLayerId !== id) {
      return;
    }

    const layerParams = layer.parameters as IHeatmapLayer;

    const source: VectorSource = this._sources[layerParams.source];

    if (layer.filters?.appliedFilters.length) {
      // Heatmaps don't work with existing filter system so this should be fine
      const activeFilter = layer.filters.appliedFilters[0];

      // Save original features on first filter application
      if (!Object.keys(this._originalFeatures).includes(id)) {
        this._originalFeatures[id] = source.getFeatures() ?? [];
      }

      // clear current features
      source.clear();

      const startTime = activeFilter.betweenMin ?? 0;
      const endTime = activeFilter.betweenMax ?? 1000;

      const filteredFeatures = (this._originalFeatures[id] ?? []).filter(
        feature => {
          const featureTime = feature.get(activeFilter.feature);
          return featureTime >= startTime && featureTime <= endTime;
        },
      );

      // set state for restoration
      this.setState(old => ({
        ...old,
        filterStates: {
          ...this.state.filterStates,
          [selectedLayerId]: activeFilter,
        },
      }));

      source.addFeatures(filteredFeatures);
    } else {
      // Restore original features when no filters are applied
      source.addFeatures(this._originalFeatures[id] ?? []);
      delete this._originalFeatures[id];
    }
  };

  private flyToGeometry(sender: IJupyterGISModel, geometry: any): void {
    if (!geometry || typeof geometry.getExtent !== 'function') {
      this._log('warning', `Invalid geometry for flyToGeometry: ${geometry}`);
      return;
    }

    const view = this._Map.getView();
    const extent = geometry.getExtent();

    view.fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 1000,
      maxZoom: 16,
    });
  }

  private highlightFeatureOnMap(
    sender: IJupyterGISModel,
    featureOrGeometry: any,
  ): void {
    const geometry =
      featureOrGeometry?.geometry ||
      featureOrGeometry?._geometry ||
      featureOrGeometry;

    if (!geometry) {
      this._log(
        'warning',
        `No geometry found in feature: ${featureOrGeometry}`,
      );
      return;
    }

    const isOlGeometry = typeof geometry.getCoordinates === 'function';

    const parsedGeometry = isOlGeometry
      ? geometry
      : new GeoJSON().readGeometry(geometry, {
          featureProjection: this._Map.getView().getProjection(),
        });

    const olFeature = new Feature({
      geometry: parsedGeometry,
      ...(geometry !== featureOrGeometry ? featureOrGeometry : {}),
    });

    if (!this._highlightLayer) {
      this._highlightLayer = new VectorLayer({
        source: new VectorSource(),
        style: feature => {
          const geomType = feature.getGeometry()?.getType();
          switch (geomType) {
            case 'Point':
            case 'MultiPoint':
              return new Style({
                image: new Circle({
                  radius: 6,
                  fill: new Fill({
                    color: 'rgba(255, 255, 0, 0.8)',
                  }),
                  stroke: new Stroke({
                    color: '#ff0',
                    width: 2,
                  }),
                }),
              });
            case 'LineString':
            case 'MultiLineString':
              return new Style({
                stroke: new Stroke({
                  color: 'rgba(255, 255, 0, 0.8)',
                  width: 3,
                }),
              });
            case 'Polygon':
            case 'MultiPolygon':
              return new Style({
                stroke: new Stroke({
                  color: '#f00',
                  width: 2,
                }),
                fill: new Fill({
                  color: 'rgba(255, 255, 0, 0.8)',
                }),
              });
            default:
              return new Style({
                stroke: new Stroke({
                  color: '#000',
                  width: 2,
                }),
              });
          }
        },
        zIndex: 999,
      });
      this._Map.addLayer(this._highlightLayer);
    }

    const source = this._highlightLayer.getSource();
    source?.clear();
    source?.addFeature(olFeature);
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
    if (!this._Map) {
      return null;
    }

    const view = this._Map.getView();
    const size = this._Map.getSize() ?? getSize(extent);

    const resolution = view.getResolutionForExtent(extent, size);
    const zoom = view.getZoomForResolution(resolution);

    return zoom ?? view.getZoom() ?? 0;
  }

  private _getLayerCreatorId(layerId: string): number | undefined {
    const states = this._model.sharedModel.awareness.getStates();

    for (const [clientId, state] of states.entries()) {
      if (state?.lastAddedLayer?.layerId === layerId) {
        return clientId;
      }
    }

    return undefined;
  }

  /**
   * Track layer's extent and zoom in model's view state
   */
  private _trackLayerViewState(
    layerId: string,
    olLayer: Layer,
    shouldZoom = false,
  ): void {
    const source = olLayer.getSource();
    const sourceId = source?.get?.('id');

    let extent = sourceId ? this._model.getExtent(sourceId) : undefined;

    if (!extent) {
      extent = this._computeExtent(olLayer, source);
    }

    if (extent) {
      const zoom = this._computeZoomFromExtent(extent);

      if (zoom === null) {
        return;
      }

      const view: IViewState[string] = { extent, zoom };
      this._model.updateLayerViewState(layerId, view);

      if (shouldZoom) {
        const creatorId = this._getLayerCreatorId(layerId);
        const currentClientId = this._model.getClientId();

        if (creatorId === currentClientId) {
          this._model.centerOnPosition(layerId);
        }
      }
    }
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
   * Wait for all layers to be loaded.
   */
  private _waitForReady(): Promise<void> {
    return new Promise(resolve => {
      const checkReady = () => {
        if (this._loadingLayers.size === 0) {
          this.setState(old => ({
            ...old,
            loadingLayer: false,
          }));
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
  private _waitForSourceReady(layer: Layer | LayerGroup) {
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

  private _handleSelectedChanged = (): void => {
    const localState = this._model.localState;
    if (!localState) {
      return;
    }

    const selectedLayers = localState.selected?.value;
    if (!selectedLayers) {
      return;
    }

    const selectedLayerId = Object.keys(selectedLayers)[0];
    const JGISLayer = this._model.getLayer(selectedLayerId);
    if (!JGISLayer) {
      return;
    }

    this._syncVectorDrawingFromSelection(JGISLayer, selectedLayerId);
  };

  private _syncVectorDrawingFromSelection = (
    layer: IJGISLayer,
    selectedLayerId: string,
  ): void => {
    const decision = this._getVectorDrawingSelectionDecision(
      layer,
      selectedLayerId,
    );
    if (decision.disableEditing) {
      this._model.editingVectorLayer = false;
      this._updateEditingVectorLayer();
      return;
    }
    if (!decision.shouldRebind) {
      return;
    }

    this._previousDrawLayerID = selectedLayerId;
    this._currentDrawLayerID = selectedLayerId;
    this._editVectorLayer();
  };

  /**
   * Decide how selection changes should affect vector drawing state.
   *
   * This helper only computes whether
   * draw mode must be disabled (non-draw layer selected) and whether draw
   * interactions should be rebound (draw mode enabled and selected draw layer
   * changed).
   */
  private _getVectorDrawingSelectionDecision(
    layer: IJGISLayer,
    selectedLayerId: string,
  ): { disableEditing: boolean; shouldRebind: boolean } {
    const isDrawVectorLayer = this._model.checkIfIsADrawVectorLayer(layer);
    if (!isDrawVectorLayer) {
      return { disableEditing: true, shouldRebind: false };
    }

    if (!this._model.editingVectorLayer) {
      return { disableEditing: false, shouldRebind: false };
    }

    if (selectedLayerId === this._previousDrawLayerID) {
      return { disableEditing: false, shouldRebind: false };
    }

    return { disableEditing: false, shouldRebind: true };
  }

  private _handleTemporalControllerActiveChanged(): void {
    const localState = this._model.localState;
    if (!localState) {
      return;
    }

    const isTemporalControllerActive =
      localState.isTemporalControllerActive === true;
    const selectedLayers = localState.selected?.value;
    const selectedLayerId = selectedLayers
      ? (Object.keys(selectedLayers)[0] ?? null)
      : null;
    const layerType = selectedLayerId
      ? this._model.getLayer(selectedLayerId)?.type
      : null;
    const isSelectionValid =
      !!selectedLayers &&
      Object.keys(selectedLayers).length === 1 &&
      !this._model.getSource(selectedLayerId!) &&
      ['VectorLayer', 'HeatmapLayer'].includes(layerType ?? '');
    const displayTemporalController =
      isTemporalControllerActive && isSelectionValid;

    if (displayTemporalController !== this.state.displayTemporalController) {
      this.setState(old => ({ ...old, displayTemporalController }));
      this._mainViewModel.commands.notifyCommandChanged(
        CommandIDs.temporalController,
      );
    }
  }

  private _handleRemoteUserChanged(): void {
    const localState = this._model.localState;
    if (!localState) {
      return;
    }

    const remoteUser = localState.remoteUser;
    const clients = this._model.sharedModel.awareness.getStates() as Map<
      number,
      IJupyterGISClientState
    >;

    // If we are in following mode, update UI and viewport from the remote user.
    if (remoteUser) {
      const remoteState = clients.get(remoteUser);
      if (!remoteState) {
        return;
      }

      if (remoteState.user?.username !== this.state.remoteUser?.username) {
        this.setState(old => ({
          ...old,
          remoteUser: remoteState.user,
        }));
      }

      const remoteViewport = remoteState.viewportState;
      if (remoteViewport.value) {
        const { x, y } = remoteViewport.value.coordinates;
        const zoom = remoteViewport.value.zoom;
        this._moveToPosition({ x, y }, zoom, 0);
      }
      return;
    }

    // If we are unfollowing, reset to local viewport and clear follow UI.
    if (this.state.remoteUser !== null) {
      this.setState(old => ({
        ...old,
        remoteUser: null,
      }));
      const viewportState = localState.viewportState?.value;
      if (viewportState) {
        this._moveToPosition(viewportState.coordinates, viewportState.zoom);
      }
    }
  }

  private _handlePointerChanged(): void {
    const clients = this._model.sharedModel.awareness.getStates() as Map<
      number,
      IJupyterGISClientState
    >;
    const clientPointers = { ...this.state.clientPointers };

    clients.forEach((client, clientId) => {
      if (!client?.user || this._model.getClientId() === clientId) {
        return;
      }

      const pointer = client.pointer?.value;
      let currentClientPointer = clientPointers[clientId];

      if (pointer) {
        const pixel = this._Map.getPixelFromCoordinate([
          pointer.coordinates.x,
          pointer.coordinates.y,
        ]);
        const lonLat = toLonLat([pointer.coordinates.x, pointer.coordinates.y]);

        if (!currentClientPointer) {
          currentClientPointer = {
            username: client.user.username,
            displayName: client.user.display_name,
            color: client.user.color,
            coordinates: {
              x: pixel[0],
              y: pixel[1],
            },
            lonLat: {
              longitude: lonLat[0],
              latitude: lonLat[1],
            },
          };
        } else {
          currentClientPointer = {
            ...currentClientPointer,
            coordinates: {
              x: pixel[0],
              y: pixel[1],
            },
            lonLat: {
              longitude: lonLat[0],
              latitude: lonLat[1],
            },
          };
        }

        clientPointers[clientId] = currentClientPointer;
      } else {
        delete clientPointers[clientId];
      }
    });

    this.setState(old => ({ ...old, clientPointers }));
  }

  private _onSharedOptionsChanged(): void {
    if (!this._Map) {
      return;
    }

    // ! would prefer a model ready signal or something, this feels hacky
    const enableSpectaPresentation = this._model.isSpectaMode();

    // Handle initialization based on specta presentation state
    if (!this._isSpectaPresentationInitialized) {
      if (enableSpectaPresentation) {
        // _setupSpectaMode will be called in componentDidUpdate when state changes
        this.setState(old => ({ ...old, isSpectaPresentation: true }));
      } else {
        // Add context menu when not in specta mode
        this.addContextMenu();
        this._isSpectaPresentationInitialized = true;
      }
    }

    if (!this._isPositionInitialized) {
      const options = this._model.getOptions();
      this.updateOptions(options);
      this._isPositionInitialized = true;
    }
  }

  private async _syncSettingsFromRegistry() {
    const composite = this._model.jgisSettings;
    if (composite) {
      this.setState({ jgisSettings: composite });
      this._onSettingsChanged();
    }
  }

  private _onSettingsChanged(): void {
    this.setState({ jgisSettings: this._model.jgisSettings });

    if (!this._Map) {
      return;
    }

    const enabled = this._model.jgisSettings.zoomButtonsEnabled;

    if (!enabled && this._zoomControl) {
      this._Map.removeControl(this._zoomControl);
      this._zoomControl = undefined;
    }

    if (enabled && !this._zoomControl) {
      this._zoomControl = new Zoom({
        target: this.controlsToolbarRef.current || undefined,
      });
      this._Map.addControl(this._zoomControl);
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
      bearing,
    } = options;
    let view = this._Map.getView();
    const currentProjection = view.getProjection().getCode();

    // Need to recreate view if the projection changes
    if (projection !== undefined && currentProjection !== projection) {
      const newProjection = getProjection(projection);
      if (newProjection) {
        this.setState(old => ({
          viewProjection: {
            code: newProjection.getCode(),
            units: newProjection.getUnits(),
          },
        }));
        view = new View({ projection: newProjection });
      } else {
        this._log('warning', `Invalid projection: ${projection}`);
        return;
      }
    }

    view.setRotation(bearing || 0);
    this._Map.setView(view);

    // Use the extent only if explicitly requested (QGIS files).
    if (useExtent && extent) {
      view.fit(extent);
    } else {
      const centerCoord = fromLonLat(
        [longitude || 0, latitude || 0],
        view.getProjection(),
      );

      this._moveToPosition({ x: centerCoord[0], y: centerCoord[1] }, zoom || 0);

      // Save the extent if it does not exists, to allow proper export to qgis.
      if (!options.extent) {
        options.extent = view.calculateExtent();
        this._model.setOptions(options);
      }
    }
  }

  private _onViewChanged(
    sender: ObservableMap<JSONValue>,
    change: IObservableMap.IChangedArgs<JSONValue>,
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

    // should not be undefined since the id exists above
    if (layer === undefined) {
      return;
    }
    this._Map.getLayers().removeAt(currentIndex);

    // Adjust index to ensure it's within bounds
    const numLayers = this._Map.getLayers().getLength();
    const safeIndex = Math.min(index, numLayers);

    this._Map.getLayers().insertAt(safeIndex, layer);
  }

  /**
   * Remove and recreate layer
   * @param id ID of layer being replaced
   * @param layer New layer to replace with
   */
  replaceLayer(id: string, layer: IJGISLayer) {
    const layerIndex = this.getLayerIndex(id);
    this.removeLayer(id);
    this.addLayer(id, layer, layerIndex);
  }

  private _onLayersChanged(
    _: IJupyterGISDoc,
    change: IJGISLayerDocChange,
  ): void {
    // Avoid concurrency update on layers on first load, if layersTreeChanged and
    // LayersChanged are triggered simultaneously.
    if (!this._ready) {
      return;
    }

    change.layerChange?.forEach(change => {
      const { id, oldValue: oldLayer, newValue: newLayer } = change;

      if (!newLayer || Object.keys(newLayer).length === 0) {
        this.removeLayer(id);
        if (this._model.checkIfIsADrawVectorLayer(oldLayer as IJGISLayer)) {
          this._model.editingVectorLayer = false;
          this._updateEditingVectorLayer();
          this._mainViewModel.commands.notifyCommandChanged(
            CommandIDs.toggleDrawFeatures,
          );
        }
        return;
      }

      if (oldLayer && oldLayer.type !== newLayer.type) {
        this.replaceLayer(id, newLayer);
        return;
      }

      const mapLayer = this.getLayer(id);
      const layerTree = JupyterGISModel.getOrderedLayerIds(this._model);

      if (layerTree.includes(id)) {
        this.updateLayer(id, newLayer, mapLayer, oldLayer);

        if (mapLayer) {
          this._trackLayerViewState(id, mapLayer);
        }
      } else {
        this.updateLayers(layerTree);
      }
    });
  }

  private _onLayerTreeChange(
    sender?: IJupyterGISDoc,
    change?: IJGISLayerTreeDocChange,
  ): void {
    this._ready = false;
    // We can't properly use the change, because of the nested groups in the the shared
    // document which is flattened for the map tool.
    this.updateLayers(JupyterGISModel.getOrderedLayerIds(this._model));
  }

  private _onSourcesChange(
    _: IJupyterGISDoc,
    change: IJGISSourceDocChange,
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

    this.setState(old => ({
      ...old,
      identifyFeatureFloatersVersion: old.identifyFeatureFloatersVersion + 1,
    }));
  }

  private _onSharedModelStateChange = (
    _: any,
    change: IJupyterGISDocChange,
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

  private _clearHighlightWhenIdentifyDisabled(): void {
    if (this._model.currentMode !== 'identifying' && this._highlightLayer) {
      this._highlightLayer.getSource()?.clear();
    }
  }

  private _handleIdentifiedFeaturesChanged = (): void => {
    this.setState(old => ({
      ...old,
      identifyFeatureFloatersVersion: old.identifyFeatureFloatersVersion + 1,
    }));
    this._clearHighlightWhenIdentifyDisabled();
  };

  /**
   * Handler for when story maps change in the model.
   * Updates specta state and presentation colors when story data becomes available.
   */
  private _setupSpectaMode = (): void => {
    this._removeAllInteractions();
    this._setupStoryScrollListener();

    // Ensure keybindings have a focused target in Specta mode.
    window.requestAnimationFrame(() => {
      this.mainViewRef.current?.focus();
    });
  };

  private _removeAllInteractions = (): void => {
    // Remove all default interactions
    const interactions = this._Map.getInteractions();
    const interactionArray = interactions.getArray();

    // Remove each interaction type
    const interactionsToRemove = [
      DragPan,
      DragRotate,
      DragZoom,
      KeyboardPan,
      KeyboardZoom,
      MouseWheelZoom,
      PinchRotate,
      PinchZoom,
      DoubleClickZoom,
      DragAndDrop,
      Select,
    ];

    this._zoomControl && this._Map.removeControl(this._zoomControl);

    interactionsToRemove.forEach(InteractionClass => {
      const interaction = interactionArray.find(
        interaction => interaction instanceof InteractionClass,
      );
      if (interaction) {
        this._Map.removeInteraction(interaction);
      }
    });
  };

  private _setupStoryScrollListener = (): void => {
    // Guard: block wheel-driven segment change until transition has ended
    let segmentChangeInProgress = false;
    const clearGuard = (): void => {
      segmentChangeInProgress = false;
    };
    this._clearStoryScrollGuard = clearGuard;

    let accumulatedDeltaY = 0;
    let scrollContainer: HTMLDivElement | null =
      this.storyViewerPanelRef.current?.getScrollContainer() ?? null;

    const processStoryScrollFrame = (): void => {
      this._pendingStoryScrollRafId = null;

      const currentPanelHandle = this.storyViewerPanelRef.current;
      if (!currentPanelHandle || !scrollContainer) {
        accumulatedDeltaY = 0;
        return;
      }

      const deltaY = accumulatedDeltaY;
      accumulatedDeltaY = 0;

      const isScrollingUp = deltaY < 0;
      const isScrollingDown = deltaY > 0;
      const isAtTop = currentPanelHandle.getAtTop();
      const isAtBottom = currentPanelHandle.getAtBottom();

      const hasOverflow = !(isAtTop && isAtBottom);
      const canGoInDirection =
        (isScrollingDown && currentPanelHandle.hasNext) ||
        (isScrollingUp && currentPanelHandle.hasPrev);
      const atEdge =
        (isScrollingDown && isAtBottom) || (isScrollingUp && isAtTop);
      const wantSegmentChange = canGoInDirection && (!hasOverflow || atEdge);

      if (wantSegmentChange) {
        if (segmentChangeInProgress) {
          return;
        }
        segmentChangeInProgress = true;
        isScrollingDown
          ? currentPanelHandle.handleNext()
          : currentPanelHandle.handlePrev();
        return;
      }

      scrollContainer.scrollBy({ top: deltaY });
    };

    const handleScroll = (event: Event) => {
      event.preventDefault();

      if (!scrollContainer || !document.contains(scrollContainer)) {
        scrollContainer =
          this.storyViewerPanelRef.current?.getScrollContainer() ?? null;
      }
      if (!scrollContainer) {
        return;
      }
      // One physical scroll tick often fires ~4 wheel events (sometimes across
      // frames on slow hardware). We accumulate deltaY and run flush once per
      // frame via rAF—the frame boundary batches events without adding delay.
      // So one scroll means one segment/scroll decision.
      accumulatedDeltaY += (event as WheelEvent).deltaY;
      if (this._pendingStoryScrollRafId === null) {
        this._pendingStoryScrollRafId = requestAnimationFrame(
          processStoryScrollFrame,
        );
      }
    };

    this._storyScrollHandler = handleScroll;
    const container = document.querySelector('.jGIS-Mainview-Container');
    if (container) {
      container.addEventListener('wheel', handleScroll, { passive: false });
    }
  };

  private _cleanupStoryScrollListener = (): void => {
    if (this._pendingStoryScrollRafId !== null) {
      cancelAnimationFrame(this._pendingStoryScrollRafId);
      this._pendingStoryScrollRafId = null;
    }
    if (this._storyScrollHandler) {
      const containerElement = document.querySelector(
        '.jGIS-Mainview-Container',
      );
      if (containerElement) {
        containerElement.removeEventListener('wheel', this._storyScrollHandler);
      }
      this._storyScrollHandler = null;
    }
  };

  private _onSharedMetadataChanged = (
    _: IJupyterGISModel,
    changes: MapChange,
  ) => {
    const newState = { ...this.state.annotations };
    changes.forEach((val, key) => {
      if (!key.startsWith('annotation')) {
        return;
      }
      const data = this._model.sharedModel.getMetadata(key);

      if (data && (val.action === 'add' || val.action === 'update')) {
        let jsonData: IAnnotation;
        if (typeof data === 'string') {
          try {
            jsonData = JSON.parse(data);
          } catch (e) {
            this._log(
              'warning',
              `Failed to parse annotation data for ${key}: ${e}`,
            );
            return;
          }
        } else {
          jsonData = data;
        }

        newState[key] = jsonData;
      } else if (val.action === 'delete') {
        delete newState[key];
      }
    });

    this.setState(old => ({ ...old, annotations: newState }));
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

  private _computeFeatureFloaterPosition(
    feature: any,
  ): { x: number; y: number } | undefined {
    const geometry = feature?.geometry ?? feature?._geometry;

    if (!geometry) {
      return undefined;
    }

    if (typeof geometry.getExtent === 'function') {
      const extent = geometry.getExtent();
      const center = getCenter(extent);
      const pixels = this._Map.getPixelFromCoordinate(center);
      if (pixels) {
        return { x: pixels[0], y: pixels[1] };
      }
      return undefined;
    }

    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
      const pixels = this._Map.getPixelFromCoordinate(geometry.coordinates);
      if (pixels) {
        return { x: pixels[0], y: pixels[1] };
      }
    }

    return undefined;
  }

  private _getVisibleDrawIdentifiedFeatures(): Array<
    [string, IIdentifiedFeature]
  > {
    const identifiedFeatures: IIdentifiedFeatures =
      this._model.localState?.identifiedFeatures?.value ?? [];

    const drawEntries = identifiedFeatures.filter(
      entry => entry.floaterOpen === true,
    );

    const visibleFeatures = drawEntries
      .map(entry => {
        const featureId = getFeatureIdentifier(entry.feature);
        if (!featureId) {
          return undefined;
        }
        return [featureId, entry.feature] as [string, IIdentifiedFeature];
      })
      .filter((entry): entry is [string, IIdentifiedFeature] => !!entry);

    return visibleFeatures;
  }

  private _updateFeatureFloaters() {
    this._getVisibleDrawIdentifiedFeatures().forEach(
      ([floaterKey, feature]) => {
        const el = document.getElementById(`feature-floater-${floaterKey}`);
        if (!el) {
          return;
        }

        const screenPosition = this._computeFeatureFloaterPosition(feature);
        if (!screenPosition) {
          return;
        }

        el.style.left = `${Math.round(screenPosition.x)}px`;
        el.style.top = `${Math.round(screenPosition.y)}px`;
      },
    );
  }

  // TODO this and flyToPosition need a rework
  private _onZoomToPosition(_: IJupyterGISModel, id: string) {
    // Check if the id is an annotation
    const annotation = this._model.annotationModel?.getAnnotation(id);
    if (annotation) {
      this._flyToPosition(annotation.position, annotation.zoom);
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
          const viewProjection = this._Map.getView().getProjection();
          const transformedExtent =
            viewProjection.getCode() !== 'EPSG:4326'
              ? transformExtent(bboxExtent, 'EPSG:4326', viewProjection)
              : bboxExtent;

          this._Map.getView().fit(transformedExtent, {
            size: this._Map.getSize(),
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
        const viewCenter = this._Map.getView().getCenter();
        const centersEqual =
          viewCenter !== undefined &&
          Math.abs(viewCenter[0] - coords[0]) < 1e-9 &&
          Math.abs(viewCenter[1] - coords[1]) < 1e-9;
        if (centersEqual) {
          return;
        }

        this._flyToPosition(
          { x: coords[0], y: coords[1] },
          layerParams.zoom,
          (layerParams.transition.time ?? 1) * 1000, // seconds -> ms
          layerParams.transition.type,
        );

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
    const viewProjection = this._Map.getView().getProjection();

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

    this._Map.getView().fit(transformedExtent, {
      size: this._Map.getSize(),
      duration: 500,
    });
  }

  private _moveToPosition(
    center: { x: number; y: number },
    zoom: number,
    duration = 1000,
  ) {
    const view = this._Map.getView();

    view.setZoom(zoom);
    view.setCenter([center.x, center.y]);
    // Zoom needs to be set before changing center
    if (!view.animate === undefined) {
      view.animate({ zoom, duration });
      view.animate({
        center: [center.x, center.y],
        duration,
      });
    }
  }

  private _flyToPosition(
    center: { x: number; y: number },
    zoom: number,
    duration = 1000,
    transitionType?: 'linear' | 'immediate' | 'smooth',
  ) {
    const view = this._Map.getView();

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

  private _lastPointerCoord: Coordinate | null = null;
  private _onPointerMove(e: PointerEvent) {
    const pixel = this._Map.getEventPixel(e);
    const coordinates = this._Map.getCoordinateFromPixel(pixel);

    this._lastPointerCoord = coordinates;
    this._syncPointer(coordinates);
  }

  private _syncPointer = throttle((coordinates: Coordinate) => {
    const pointer = {
      coordinates: { x: coordinates[0], y: coordinates[1] },
    };
    this._model.syncPointer(pointer);
  });

  private async _addMarker(e: MapBrowserEvent<any>) {
    if (
      this.state.editingVectorLayer ||
      this._model.currentMode !== 'marking'
    ) {
      return;
    }

    const coordinate = this._Map.getCoordinateFromPixel(e.pixel);
    const sourceId = UUID.uuid4();
    const layerId = UUID.uuid4();

    const sourceParameters: IMarkerSource = {
      feature: { coords: [coordinate[0], coordinate[1]] },
    };

    const layerParams: IVectorLayer = {
      opacity: 1.0,
      source: sourceId,
      symbologyState: { renderType: 'Single Symbol' },
    };

    const sourceModel: IJGISSource = {
      type: 'MarkerSource',
      name: 'Marker',
      parameters: sourceParameters,
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      visible: true,
      name: 'Marker',
      parameters: layerParams,
    };

    this._model.sharedModel.addSource(sourceId, sourceModel);
    await this.addSource(sourceId, sourceModel);

    this._model.addLayer(layerId, layerModel);
    await this.addLayer(layerId, layerModel, this.getLayerIDs().length);
  }

  private _identifyFeature(e: MapBrowserEvent<any>) {
    if (
      this.state.editingVectorLayer ||
      this._model.currentMode !== 'identifying'
    ) {
      return;
    }

    const localState = this._model?.sharedModel.awareness.getLocalState();
    const selectedLayer = localState?.selected?.value;

    if (!selectedLayer) {
      this._log('warning', 'Layer must be selected to use identify tool');
      return;
    }

    const layerId = Object.keys(selectedLayer)[0];
    const jgisLayer = this._model.getLayer(layerId);

    switch (jgisLayer?.type) {
      case 'VectorTileLayer': {
        const geometries: Geometry[] = [];
        const features: IIdentifiedFeatureEntry[] = [];
        let foundAnyFeatures = false;

        this._Map.forEachFeatureAtPixel(e.pixel, (feature: FeatureLike) => {
          foundAnyFeatures = true;

          let geom: Geometry | undefined;
          let props = {};

          if (feature instanceof RenderFeature) {
            geom = toGeometry(feature);
          } else if ('getGeometry' in feature) {
            geom = feature.getGeometry();
          }

          const rawProps = feature.getProperties();
          const fid = feature.getId?.() ?? rawProps?.fid;

          if (rawProps && Object.keys(rawProps).length > 1) {
            const { ...clean } = rawProps;
            props = clean;
            if (fid !== null) {
              // TODO Clean the cache under some condition?
              this._featurePropertyCache.set(fid, props);
            }
          } else if (fid !== null && this._featurePropertyCache.has(fid)) {
            props = this._featurePropertyCache.get(fid);
          }

          if (geom) {
            geometries.push(geom);
          }
          if (props && Object.keys(props).length > 0) {
            features.push({
              feature: props,
              floaterOpen: false,
            });
          }

          return true;
        });

        if (features.length > 0) {
          this._model.syncIdentifiedFeatures(
            features,
            this._model.getClientId().toString(),
          );
        } else if (!foundAnyFeatures) {
          this._model.syncIdentifiedFeatures(
            [],
            this._model.getClientId().toString(),
          );
        }

        if (geometries.length > 0) {
          for (const geom of geometries) {
            this._model.highlightFeatureSignal.emit(geom);
          }
        } else {
          const coordinate = this._Map.getCoordinateFromPixel(e.pixel);
          const point = new Point(coordinate);
          this._model.highlightFeatureSignal.emit(point);
        }

        break;
      }

      case 'GeoTiffLayer': {
        const layer = this.getLayer(layerId) as GeoTiffLayer;
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
          [{ feature: bandValues, floaterOpen: false }],
          this._mainViewModel.id,
        );

        const coordinate = this._Map.getCoordinateFromPixel(e.pixel);
        const point = new Point(coordinate);

        // trigger highlight via signal
        this._model.highlightFeatureSignal.emit(point);

        break;
      }
    }
  }

  private _triggerLayerUpdate(_: IJupyterGISModel, args: string) {
    // ? could send just the filters object and modify that instead of emitting whole layer
    const json = JSON.parse(args);
    const { layerId, layer: jgisLayer } = json;
    const isSourceType =
      typeof jgisLayer?.type === 'string' && jgisLayer.type.includes('Source');
    const olLayer = this.getLayer(layerId);

    if (isSourceType) {
      this.updateSource(layerId, jgisLayer);
    }
    if (!jgisLayer || !olLayer) {
      this._log('error', 'Failed to update layer -- layer not found');
      return;
    }
    this.updateLayer(layerId, jgisLayer, olLayer);
  }

  private _convertFeatureToMs(_: IJupyterGISModel, args: string) {
    const json = JSON.parse(args);
    const { id: layerId, selectedFeature } = json;
    const olLayer = this.getLayer(layerId);
    const source = olLayer.getSource() as VectorSource;

    if (typeof source.forEachFeature !== 'function') {
      return;
    }

    source.forEachFeature(feature => {
      const time = feature.get(selectedFeature);
      const parsedTime = typeof time === 'string' ? Date.parse(time) : time;
      feature.set(`${selectedFeature}ms`, parsedTime);
    });
  }

  private _handleGeolocationChanged(
    sender: any,
    newPosition: JgisCoordinates,
  ): void {
    const view = this._Map.getView();
    const zoom = view.getZoom();
    if (zoom) {
      this._flyToPosition(newPosition, zoom);
    } else {
      throw new Error(
        'Could not move to geolocation, because current zoom is not defined.',
      );
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

  private _handleSpectaTouchStart = (e: React.TouchEvent): void => {
    if (e.touches.length > 0) {
      this._spectaTouchStartX = e.touches[0].clientX;
    }
  };

  private _handleSpectaTouchEnd = (e: React.TouchEvent): void => {
    if (e.changedTouches.length === 0) {
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - this._spectaTouchStartX;
    const threshold = 50;
    const story = this._model.getSelectedStory().story;
    const segmentCount = story?.storySegments?.length ?? 0;

    if (segmentCount === 0) {
      return;
    }

    const current = this._model.getCurrentSegmentIndex() ?? 0;

    if (deltaX > threshold && current > 0) {
      this._model.setCurrentSegmentIndex(current - 1);
    } else if (deltaX < -threshold && current < segmentCount - 1) {
      this._model.setCurrentSegmentIndex(current + 1);
    }
  };

  private _updateEditingVectorLayer() {
    const editingVectorLayer: boolean = this._model.editingVectorLayer;
    this.setState(old => ({ ...old, editingVectorLayer }));

    if (editingVectorLayer === true) {
      this._editVectorLayer();
    }

    if (editingVectorLayer === false && this._draw) {
      this._removeDrawInteraction();
      this._currentDrawLayerID = undefined;
    }
  }

  private _handleDrawGeometryTypeChange = (
    /* handle with the change of geometry and instantiate new draw interaction and other ones accordingly*/
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const drawGeometryLabel = event.target.value;

    this._currentDrawGeometry = drawGeometryLabel as Type;

    this._updateInteractions();
    this._updateDrawSource();

    this.setState(old => ({
      ...old,
      drawGeometryLabel,
    }));
  };

  private _getVectorSourceFromLayerID = (
    layerID: string,
  ): VectorSource | undefined => {
    /* get the OpenLayers VectorSource corresponding to the JGIS currentDrawLayerID */
    const layers = this._Map.getLayers();
    const layerArray = layers.getArray();
    const matchingLayer = layerArray.find(layer => layer.get('id') === layerID);
    const source = matchingLayer?.get('source');

    this._currentVectorSource = source;

    return this._currentVectorSource;
  };

  _getDrawSourceFromSelectedLayer = () => {
    const selectedLayers =
      this._model?.sharedModel.awareness.getLocalState()?.selected?.value;

    if (!selectedLayers) {
      return;
    }

    const selectedLayerID = Object.keys(selectedLayers)[0];
    this._currentDrawLayerID = selectedLayerID;

    const JGISLayer = this._model.getLayer(selectedLayerID);
    this._currentDrawSourceID = (JGISLayer as any)?.parameters?.source;

    if (this._currentDrawSourceID) {
      this._currentDrawSource = this._model.getSource(
        this._currentDrawSourceID,
      );
    }
  };

  _onVectorSourceChange = () => {
    if (
      !this._currentVectorSource ||
      !this._currentDrawSource ||
      !this._currentDrawSourceID
    ) {
      return;
    }

    const geojsonWriter = new GeoJSON({
      featureProjection: this._Map.getView().getProjection(),
    });

    const features = this._currentVectorSource
      .getFeatures()
      .map(feature => geojsonWriter.writeFeatureObject(feature));

    const updatedData = {
      type: 'FeatureCollection',
      features: features,
    };

    const updatedJGISLayerSource: IJGISSource = {
      name: this._currentDrawSource.name,
      type: this._currentDrawSource.type,
      parameters: {
        data: updatedData,
      },
    };

    this._currentDrawSource = updatedJGISLayerSource;
    this._model.sharedModel.updateSource(
      this._currentDrawSourceID,
      updatedJGISLayerSource,
    );
  };

  _updateDrawSource = () => {
    if (this._currentVectorSource) {
      this._currentVectorSource.on('change', this._onVectorSourceChange);
    }
  };

  _updateInteractions = () => {
    if (this._draw) {
      this._removeDrawInteraction();
    }

    if (this._select) {
      this._removeSelectInteraction();
    }

    if (this._modify) {
      this._removeModifyInteraction();
    }

    if (this._snap) {
      this._removeSnapInteraction();
    }

    this._draw = new Draw({
      style: drawInteractionStyle,
      type: this._currentDrawGeometry,
      source: this._currentVectorSource,
    });
    this._draw.on('drawend', this._handleDrawEnd);
    this._select = new Select();
    this._modify = new Modify({
      features: this._select.getFeatures(),
    });
    this._snap = new Snap({
      source: this._currentVectorSource,
    });

    this._Map.addInteraction(this._draw);
    this._Map.addInteraction(this._select);
    this._Map.addInteraction(this._modify);
    this._Map.addInteraction(this._snap);

    this._draw.setActive(true);
    this._select.setActive(false);
    this._modify.setActive(false);
    this._snap.setActive(true);
  };

  private _handleDrawEnd = (event: DrawEvent): void => {
    const feature = event.feature;
    feature.set('_id', UUID.uuid4());
    feature.set('_createdAt', new Date().toISOString());
    feature.set('_creatorClientId', this._model.getClientId().toString());
    feature.set('_fromDrawTool', true);
    feature.set('Label', 'New Label');
  };

  _editVectorLayer = () => {
    this._getDrawSourceFromSelectedLayer();
    if (!this._currentDrawLayerID) {
      return;
    }

    this._currentVectorSource = this._getVectorSourceFromLayerID(
      this._currentDrawLayerID,
    );

    if (!this._currentVectorSource || !this._currentDrawGeometry) {
      return;
    }

    this._updateInteractions(); /* remove previous interactions and instantiate new ones */
    this._updateDrawSource(); /*add new features, update source and get changes reported to the JGIS Document in geoJSON format */
  };

  private _removeDrawInteraction = () => {
    this._draw.setActive(false);
    this._Map.removeInteraction(this._draw);
  };

  private _removeSelectInteraction = () => {
    this._select.setActive(false);
    this._Map.removeInteraction(this._select);
  };

  private _removeSnapInteraction = () => {
    this._snap.setActive(false);
    this._Map.removeInteraction(this._snap);
  };

  private _removeModifyInteraction = () => {
    this._modify.setActive(false);
    this._Map.removeInteraction(this._modify);
  };

  /**
   * Shared source update wrapper for child components that need to mutate a
   * source and refresh corresponding map layers.
   */
  persistAndRefreshSource = async (
    id: string,
    source: IJGISSource,
  ): Promise<void> => {
    this._model.sharedModel.updateSource(id, source);
    await this.updateSource(id, source);
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
                  top: screenPosition.y,
                }}
                className={'jGIS-Popup-Wrapper'}
              >
                <AnnotationFloater
                  itemId={key}
                  annotationModel={this._model.annotationModel}
                />
              </div>
            )
          );
        })}
        {this._getVisibleDrawIdentifiedFeatures().map(
          ([floaterKey, feature]) => {
            const screenPosition = this._computeFeatureFloaterPosition(feature);
            if (!screenPosition) {
              return null;
            }

            return (
              <div
                key={`feature-floater-${floaterKey}`}
                id={`feature-floater-${floaterKey}`}
                style={{
                  left: screenPosition.x,
                  top: screenPosition.y,
                }}
                className="jGIS-Popup-Wrapper jGIS-FeatureFloater-Wrapper"
              >
                <FeatureFloater feature={feature} />
              </div>
            );
          },
        )}

        {this.state.editingVectorLayer && (
          <div className="jgis-geometry-type-selector-overlay">
            <select
              className="geometry-type-selector"
              id="geometry-type-selector"
              value={this.state.drawGeometryLabel ?? ''}
              onChange={this._handleDrawGeometryTypeChange}
            >
              <option value="" disabled hidden>
                Geometry type
              </option>
              {DRAW_GEOMETRIES.map(geometryType => (
                <option key={geometryType} value={geometryType}>
                  {geometryType}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="jGIS-Mainview-Container">
          {this.state.displayTemporalController && (
            <TemporalSlider
              model={this._model}
              filterStates={this.state.filterStates}
            />
          )}
          <div
            ref={this.mainViewRef}
            className="jGIS-Mainview data-jgis-keybinding"
            tabIndex={0}
            style={{
              border: this.state.remoteUser
                ? `solid 3px ${this.state.remoteUser.color}`
                : 'unset',
            }}
            onTouchStart={
              this.state.isSpectaPresentation && this.props.isMobile
                ? this._handleSpectaTouchStart
                : undefined
            }
            onTouchEnd={
              this.state.isSpectaPresentation && this.props.isMobile
                ? this._handleSpectaTouchEnd
                : undefined
            }
          >
            <LoadingOverlay loading={this.state.loading} />
            <FollowIndicator remoteUser={this.state.remoteUser} />
            <CollaboratorPointers clients={this.state.clientPointers} />

            <div
              ref={this.divRef}
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              <div className="jgis-panels-wrapper">
                {!this.state.isSpectaPresentation ? (
                  <>
                    {this.props.isMobile &&
                    this._state &&
                    this._formSchemaRegistry &&
                    this._annotationModel ? (
                      <MergedPanel
                        model={this._model}
                        commands={this._mainViewModel.commands}
                        state={this._state}
                        settings={this.state.jgisSettings}
                        formSchemaRegistry={this._formSchemaRegistry}
                        annotationModel={this._annotationModel}
                        addLayer={this.addLayer.bind(this)}
                        removeLayer={this.removeLayer.bind(this)}
                      />
                    ) : (
                      <>
                        {this._state && (
                          <LeftPanel
                            model={this._model}
                            commands={this._mainViewModel.commands}
                            state={this._state}
                            settings={this.state.jgisSettings}
                          />
                        )}
                        {this._formSchemaRegistry && this._annotationModel && (
                          <RightPanel
                            model={this._model}
                            commands={this._mainViewModel.commands}
                            formSchemaRegistry={this._formSchemaRegistry}
                            annotationModel={this._annotationModel}
                            addLayer={this.addLayer.bind(this)}
                            removeLayer={this.removeLayer.bind(this)}
                            settings={this.state.jgisSettings}
                            patchGeoJSONFeatureProperties={
                              this._patchGeoJSONFeatureProperties
                            }
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  this.state.initialLayersReady && (
                    <SpectaPanel
                      model={this._model}
                      isSpecta={this.state.isSpectaPresentation}
                      isMobile={this.props.isMobile}
                      onSegmentTransitionEnd={() =>
                        this._clearStoryScrollGuard()
                      }
                      containerRef={this.spectaContainerRef}
                      storyViewerPanelRef={this.storyViewerPanelRef}
                      addLayer={this.addLayer.bind(this)}
                      removeLayer={this.removeLayer.bind(this)}
                    />
                  )
                )}
              </div>
              <div
                ref={this.controlsToolbarRef}
                className="jgis-controls-toolbar"
              ></div>
            </div>
          </div>
          {!this.state.isSpectaPresentation && (
            <StatusBar
              jgisModel={this._model}
              loading={this.state.loadingLayer}
              projection={this.state.viewProjection}
              scale={this.state.scale}
            />
          )}
        </div>
      </>
    );
  }

  private _clickCoords: Coordinate;
  private _commands: CommandRegistry;
  private _isPositionInitialized = false;
  private divRef = React.createRef<HTMLDivElement>(); // Reference of render div
  private mainViewRef = React.createRef<HTMLDivElement>();
  private controlsToolbarRef = React.createRef<HTMLDivElement>();
  private spectaContainerRef = React.createRef<HTMLDivElement>();
  private storyViewerPanelRef = React.createRef<IStoryViewerPanelHandle>();
  private _Map: OlMap;
  private _zoomControl?: Zoom;
  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _sources: Record<string, any>;
  private _sourceToLayerMap = new Map();
  private _documentPath?: string;
  private _contextMenu: ContextMenu;
  private _loadingLayers: Set<string>;
  private _originalFeatures: IDict<Feature<Geometry>[]> = {};
  private _highlightLayer: VectorLayer<VectorSource>;
  private _draw: Draw;
  private _snap: Snap;
  private _modify: Modify;
  private _select: Select;
  private _currentDrawLayerID: string | undefined;
  private _previousDrawLayerID: string | undefined;
  private _currentDrawSource: IJGISSource | undefined;
  private _currentVectorSource: VectorSource | undefined;
  private _currentDrawSourceID: string | undefined;
  private _currentDrawGeometry: Type;
  private _updateCenter: CallableFunction;
  private _state?: IStateDB;
  private _formSchemaRegistry?: IJGISFormSchemaRegistry;
  private _annotationModel?: IAnnotationModel;
  private _loggerRegistry?: ILoggerRegistry;
  private _patchGeoJSONFeatureProperties: PatchGeoJSONFeatureProperties;

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

  private _featurePropertyCache: Map<string | number, any> = new Map();
  private _isSpectaPresentationInitialized = false;
  private _storyScrollHandler: ((e: Event) => void) | null = null;
  private _clearStoryScrollGuard: () => void;
  private _pendingStoryScrollRafId: number | null = null;
  private _initialLayersCount: number;
  private _spectaTouchStartX = 0;
}

// ! TODO make mainview a modern react component instead of a class
/** Thin wrapper that injects isMobile from useMediaQuery so MainView can use it in JSX. */
function MainViewWithMediaQuery(props: Omit<IMainViewProps, 'isMobile'>) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return <MainView {...props} isMobile={isMobile} />;
}

export { MainViewWithMediaQuery };
