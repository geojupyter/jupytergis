import { faCrosshairs } from '@fortawesome/free-solid-svg-icons';
import { MapChange } from '@jupyter/ydoc';
import {
  IAnnotation,
  IAnnotationModel,
  IDict,
  IJGISFilterItem,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISOptions,
  IJGISSource,
  IJGISSourceDocChange,
  IJGISUIState,
  IIdentifiedFeature,
  IIdentifiedFeatureEntry,
  IIdentifiedFeatures,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISDocChange,
  IJupyterGISModel,
  IVectorLayer,
  JgisCoordinates,
  JupyterGISModel,
  IMarkerSource,
  IJupyterGISSettings,
  DEFAULT_PROJECTION,
} from '@jupytergis/schema';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { JSONValue, UUID } from '@lumino/coreutils';
import { ContextMenu, Menu } from '@lumino/widgets';
import { Geolocation, MapBrowserEvent, Map as OlMap, View } from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import type { GeolocationError } from 'ol/Geolocation';
import { FullScreen, ScaleLine, Zoom, Control, Rotate } from 'ol/control';
import { Coordinate } from 'ol/coordinate';
import { singleClick } from 'ol/events/condition';
import { getCenter } from 'ol/extent';
import { GeoJSON } from 'ol/format';
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
import type Interaction from 'ol/interaction/Interaction';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import {
  Vector as VectorLayer,
  VectorImage as VectorImageLayer,
  WebGLTile as RasterLayer,
} from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import {
  fromLonLat,
  get as getProjection,
  toLonLat,
  transformExtent,
} from 'ol/proj';
import RenderFeature, { toGeometry } from 'ol/render/Feature';
import { Vector as VectorSource } from 'ol/source';
import { Fill, Icon, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import * as React from 'react';

import { CommandIDs } from '@/src/constants';
import AnnotationFloater from '@/src/features/annotations/components/AnnotationFloater';
import FeatureFloater from '@/src/features/identify/components/FeatureFloater';
import { getFeatureIdentifier } from '@/src/features/identify/utils/getFeatureIdentifier';
import { applyDrawCustomAttributesToFeature } from '@/src/features/labels/drawCustomAttributes';
import {
  getStoryPresentationMode,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { useIsMobile } from '@/src/shared/hooks/useIsMobile';
import { debounce, isLightTheme, throttle } from '@/src/tools';
import StatusBar from '@/src/workspace/statusbar/StatusBar';
import { ClientPointer } from './CollaboratorPointers';
import TemporalSlider from './TemporalSlider';
import { MainViewMapSurface } from './components/MainViewMapSurface';
import { MainViewOverlayLayer } from './components/MainViewOverlayLayer';
import { MainViewSidePanels } from './components/MainViewSidePanels';
import { MainViewStoryStage } from './components/MainViewStoryStage';
import { PositionedFloater } from './components/PositionedFloater';
import {
  createGeoJSONFeaturePatcher,
  type PatchGeoJSONFeatureAttributes,
} from './geoJsonFeaturePatch';
import { MainViewModel } from './mainviewmodel';
import { createMapViewer, IMapViewer, MapViewerType } from './mapviewer';
import { ensureHighlightLayer } from '../features/identify/utils/highlightLayer';
import { buildHighlightStyle } from '../features/identify/utils/highlightStyle';
import { openEOEvents } from '../features/layers/openeo/OpenEOTileLayer';
import type { IStoryViewerPanelHandle } from '../features/story/StoryViewerPanel';
import type { IListStorySegmentTransition } from '../features/story/types/types';

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
  /** True when viewport matches (max-width: 960px). Injected by MainViewWithObserver. */
  isMobile: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
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
  isDrawing: boolean;
  drawGeometryLabel: string | undefined;
  currentDrawLayerId: string | undefined;
  jgisSettings: IJupyterGISSettings;
  isSpectaPresentation: boolean;
  initialLayersReady: boolean;
  identifyFeatureFloatersVersion: number;
  /** List story segment handoff for the map stage overlay; null when off. */
  segmentTransition: IListStorySegmentTransition | null;
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
    this._patchGeoJSONFeatureAttributes = createGeoJSONFeaturePatcher({
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
    this._model.sharedAnnotationsChanged.connect(
      this._onAnnotationsChanged,
      this,
    );

    this._model.identifiedFeaturesChanged.connect(
      this._handleIdentifiedFeaturesChanged,
      this,
    );
    this._model.settingsChanged.connect(this._onSettingsChanged, this);
    this._model.updateLayerSignal.connect(this._triggerLayerUpdate, this);
    this._model.addFeatureAsMsSignal.connect(this._convertFeatureToMs, this);
    this._model.storyPreviewActiveChanged.connect(
      this._onStoryPreviewActiveChanged,
      this,
    );

    // After a user signs in to an OpenEO server, rebuild any of this
    // document's OpenEO tile sources whose serverUrl matches — they
    // would have failed to construct on document load when CONNECTIONS
    // was still empty.
    openEOEvents.connected.connect(this._onOpenEOConnected, this);
    this._model.geolocationChanged.connect(
      this._handleGeolocationChanged,
      this,
    );
    this._model.uiStateChanged.connect(
      this._handleLocationIndicatorToggled,
      this,
    );

    // Keep draw UI/interactions in sync with the exclusive map mode.
    this._model.modeChanged.connect(this._handleModeChanged, this);

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
      isDrawing: false,
      drawGeometryLabel: '',
      currentDrawLayerId: undefined,
      jgisSettings: this._model.jgisSettings,
      isSpectaPresentation: this._model.isStoryPresentationActive(),
      initialLayersReady: false,
      identifyFeatureFloatersVersion: 0,
      segmentTransition: null,
    };

    this._commands = new CommandRegistry();
    this._contextMenu = new ContextMenu({
      commands: this._commands,
    });
    this._updateCenter = debounce(this.updateCenter, 100);
  }

  async componentDidMount(): Promise<void> {
    this.setState({
      annotations: this._model.sharedModel.getAnnotations(),
    });

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
    this._model.zoomToPositionSignal.connect(
      this._mapViewer.onZoomToPosition,
      this._mapViewer,
    );

    this._handleRemoteUserChanged();
    this._handlePointerChanged();
    this._handleTemporalControllerActiveChanged();
    this._handleSelectedChanged();
    this._mainViewModel.initSignal();
    if (this.state.isSpectaPresentation && !this._spectaModeSetupDone) {
      this._setupSpectaMode();
      this._spectaModeSetupDone = true;
    }
    if (window.jupytergisMaps !== undefined && this._documentPath) {
      window.jupytergisMaps[this._documentPath] = this._Map;
    }
  }

  componentDidUpdate(prevProps: IMainViewProps, prevState: IStates): void {
    const enteredPresentation =
      !prevState.isSpectaPresentation && this.state.isSpectaPresentation;
    const exitedPresentation =
      prevState.isSpectaPresentation && !this.state.isSpectaPresentation;

    if (enteredPresentation && !this._spectaModeSetupDone) {
      this._setupSpectaMode();
      this._spectaModeSetupDone = true;
    }

    if (exitedPresentation && this._spectaModeSetupDone) {
      this._teardownSpectaMode();
      this._spectaModeSetupDone = false;
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
    openEOEvents.connected.disconnect(this._onOpenEOConnected, this);
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
    this._model.storyPreviewActiveChanged.disconnect(
      this._onStoryPreviewActiveChanged,
      this,
    );
    // Clean up story scroll listener
    this._cleanupStoryScrollListener();

    this._model.uiStateChanged.disconnect(
      this._handleLocationIndicatorToggled,
      this,
    );
    this._model.modeChanged.disconnect(this._handleModeChanged, this);
    this._stopLocationIndicator();
    if (this._mapViewer) {
      this._mapViewer.destroy();
    }

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

    const controlsToolbar = this.controlsToolbarRef.current || undefined;
    const controls: Control[] = [new ScaleLine({ target: controlsToolbar })];

    if (!this._model.isSpectaMode()) {
      controls.push(new FullScreen({ target: controlsToolbar }));
    }

    controls.push(new Rotate({ target: controlsToolbar, autoHide: true }));

    if (this._model.jgisSettings.zoomButtonsEnabled) {
      this._zoomControl = new Zoom({ target: controlsToolbar });
      controls.push(this._zoomControl);
    }

    if (this.divRef.current) {
      const mapViewerSetting =
        this._model.jgisSettings.mapViewer || 'openlayers';
      const mapViewerType: MapViewerType = (
        mapViewerSetting === 'maplibre' ? 'maplibre' : 'openlayers'
      ) as MapViewerType;

      this._lastMapViewerType = mapViewerType;

      // Create the map viewer using abstraction
      this._mapViewer = await createMapViewer(mapViewerType, this._model);

      await this._mapViewer.initialize(this.divRef.current, {
        projection,
        center: [center[0], center[1]],
        zoom,
        rotation: 0,
      });

      this._Map = (this._mapViewer as any).getMap?.() || null;

      if (!this._Map) {
        // Fallback
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
      }

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

        this._mapViewer.addSource(sourceId, sourceModel);

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

        this._mapViewer.addLayer(
          layerId,
          layerModel,
          this._mapViewer.getLayerIDs().length,
        );
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

        const view = this._Map?.getView();
        if (view) {
          this._lastCenter = view.getCenter();
          this._lastZoom = view.getZoom();
        }

        const center = view.getCenter();
        const zoom = view.getZoom();

        if (!center || !zoom) {
          return;
        }

        if (this._model.localState?.remoteUser) {
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
        await this._mapViewer.updateLayersImpl(
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

      this._geolocation = new Geolocation({
        tracking: false,
        trackingOptions: {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: Infinity,
        },
        projection: this._Map.getView().getProjection(),
      });
      this._geolocation.on('error', (err: GeolocationError) => {
        console.warn(`Geolocation error (${err.code}): ${err.message}`);
        this._model.setUIState({ locationIndicatorActive: false });
      });

      this._geolocationAccuracyFeature = new Feature();
      this._geolocationAccuracyFeature.setStyle(
        new Style({
          fill: new Fill({ color: 'rgba(135, 206, 250, 0.5)' }),
        }),
      );
      this._geolocation.on('change:accuracyGeometry', () => {
        if (
          this._geolocationAccuracyFeature === undefined ||
          this._geolocation === undefined
        ) {
          throw new Error('State incorrectly initialized. This is a bug.');
        }

        this._geolocationAccuracyFeature.setGeometry(
          this._geolocation.getAccuracyGeometry() ?? undefined,
        );
      });

      /**
       * Built as an inline SVG rather than via OL's Icon `color` option as this icon needs a
       * contrasting white stroke and the OL API does not support that in a single icon.
       */
      const [iconWidth, iconHeight, , , iconPath] = faCrosshairs.icon;
      const crosshairsSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 ${iconWidth} ${iconHeight}"
        >
          <path
            d="${iconPath}"
            fill="blue"
            stroke="white"
            stroke-width="40"
            paint-order="stroke"
            stroke-linejoin="round"
          />
        </svg>`,
      )}`;

      this._geolocationPositionFeature = new Feature();
      this._geolocationPositionFeature.setStyle(
        new Style({
          image: new Icon({ src: crosshairsSrc }),
        }),
      );

      this._geolocation.on('change:position', () => {
        if (
          this._geolocation === undefined ||
          this._geolocationPositionFeature === undefined
        ) {
          throw new Error('State incorrectly initialized. This is a bug.');
        }

        const coordinates = this._geolocation.getPosition();
        this._geolocationPositionFeature.setGeometry(
          coordinates ? new Point(coordinates) : undefined,
        );
      });

      this._geolocationSource = new VectorSource({});
      new VectorLayer({
        map: this._Map,
        source: this._geolocationSource,
      });
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
        const expected = this._mapViewer.getLayer(selectedLayerId);
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
        ? this._mapViewer.getLayer(selectedLayerId)
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
      const resolution = this._Map.getView().getResolution() ?? 1;

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

    this._ensureHighlightLayer();
    const source = this._highlightLayerRef.current?.getSource();
    source?.clear();
    source?.addFeature(olFeature);
  }

  private _ensureHighlightLayer(): void {
    ensureHighlightLayer(this._Map, this._highlightLayerRef);
  }

  /**
   * Replace the highlight layer contents with pre-styled features.
   * Each feature carries its own highlight style via feature.setStyle().
   */
  private _setHighlightFeatures(features: Feature[]): void {
    this._ensureHighlightLayer();
    const source = this._highlightLayerRef.current?.getSource();
    source?.clear();
    for (const f of features) {
      source?.addFeature(f);
    }
  }

  private _buildHighlightStyle(original: Style, geomType?: string): Style {
    return buildHighlightStyle(original, geomType);
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
      if (this._model.currentMode === 'drawing') {
        this._model.currentMode = 'panning';
        this._notifyInteractionModeCommands();
      }
      return;
    }
    if (!decision.shouldRebind) {
      return;
    }

    this._previousDrawLayerID = selectedLayerId;
    this._setCurrentDrawLayerId(selectedLayerId);
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

    if (this._model.currentMode !== 'drawing') {
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
      layerType === 'VectorLayer';
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

  private _onStoryPreviewActiveChanged = (): void => {
    this.setState({
      isSpectaPresentation: this._model.isStoryPresentationActive(),
    });
  };

  private _onSharedOptionsChanged(): void {
    if (!this._Map) {
      return;
    }

    if (!this._contextMenuAttached && !this._model.isSpectaMode()) {
      this.addContextMenu();
      this._contextMenuAttached = true;
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

    // Handle mapViewer setting changes
    const mapViewerSetting =
      (this._model.jgisSettings.mapViewer as string) || 'openlayers';
    const newMapViewerType: MapViewerType = (
      mapViewerSetting === 'maplibre' ? 'maplibre' : 'openlayers'
    ) as MapViewerType;

    if (newMapViewerType !== this._lastMapViewerType) {
      // eslint-disable-next-line no-console
      console.log(
        `Map viewer changed from ${this._lastMapViewerType} to ${newMapViewerType}`,
      );
      this._regenerateMap();
      return;
    }

    // Handle other settings changes (existing code)
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

  private async _regenerateMap(): Promise<void> {
    try {
      // Dispose old viewer
      if (this._mapViewer) {
        this._mapViewer.destroy();
      }

      // Get current view state before regenerating
      const center = this._lastCenter || [0, 0];
      const zoom = this._lastZoom || 1;
      const projection = this.state.viewProjection.code || DEFAULT_PROJECTION;

      // Regenerate map with new viewer
      await this.generateMap(center, zoom, projection);

      const layerids = this._mapViewer.getLayerIDs();

      this._mapViewer.updateLayers(layerids);
    } catch (error) {
      console.error('Error regenerating map:', error);
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
        this._geolocation?.setProjection(newProjection);
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
   * Convenience method to get a specific layer index from OpenLayers Map
   * @param id Layer to retrieve
   */
  private getLayerIndex(id: string) {
    return this._Map
      .getLayers()
      .getArray()
      .findIndex(layer => layer.get('id') === id);
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
        this._mapViewer.removeLayer(id);
        if (
          this._model.currentMode === 'drawing' &&
          this._model.checkIfIsADrawVectorLayer(oldLayer as IJGISLayer)
        ) {
          this._model.currentMode = 'panning';
          this._notifyInteractionModeCommands();
        }
        return;
      }

      const mapLayer = this._mapViewer.getLayer(id);
      const layerTree = JupyterGISModel.getOrderedLayerIds(this._model);

      if (layerTree.includes(id)) {
        this._mapViewer.updateLayer(id, newLayer, mapLayer, oldLayer);

        if (mapLayer) {
          this._mapViewer.trackLayerViewState(id, mapLayer);
        }
      } else {
        this._mapViewer.updateLayers(layerTree);
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
    this._mapViewer.updateLayers(
      JupyterGISModel.getOrderedLayerIds(this._model),
    );
  }

  /**
   * Rebuild every OpenEO tile source in this document whose `serverUrl`
   * matches the freshly-signed-in server. Called when the shared
   * `openEOEvents.connected` signal fires (i.e. right after `connect()`
   * caches a new live connection). Without this, layers created before
   * the user signed in stay broken because their constructor already
   * threw on the empty cache.
   */
  private _onOpenEOConnected(
    _: unknown,
    { serverUrl }: { serverUrl: string },
  ): void {
    if (!this._ready) {
      return;
    }
    const sources = this._model.sharedModel.sources ?? {};
    for (const [sourceId, source] of Object.entries(sources)) {
      if (source?.type !== 'OpenEOTileSource') {
        continue;
      }
      const sourceServerUrl = (source.parameters as any)?.serverUrl as
        | string
        | undefined;
      if (!sourceServerUrl) {
        continue;
      }
      // Match the normalization `connect()` does so a saved `localhost:8080`
      // matches the live connection at `https://localhost:8080`.
      const normalize = (u: string) =>
        u.match(/^https?:\/\//i) ? u : `https://${u}`;
      if (normalize(sourceServerUrl) === normalize(serverUrl)) {
        // updateSource removes the OL source and reconstructs it; the new
        // OpenEOTileSource finds the cached connection and renders.
        void this._mapViewer.updateSource(sourceId, source);
      }
    }
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
        this._mapViewer.removeSource(change.id);
      } else {
        const source = this._model.getSource(change.id);
        if (source) {
          this._mapViewer.updateSource(change.id, source);
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
    if (
      this._model.currentMode !== 'identifying' &&
      this._highlightLayerRef.current
    ) {
      this._highlightLayerRef.current?.getSource()?.clear();
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
    this._cleanupStoryScrollListener();
    this._removeAllInteractions();
    this._setupStoryScrollListener();

    // Ensure keybindings have a focused target in Specta mode.
    window.requestAnimationFrame(() => {
      this.mainViewRef.current?.focus();
    });
  };

  private _removeAllInteractions = (): void => {
    if (!this._Map) {
      return;
    }

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

    this._spectaRemovedInteractions = [];

    interactionsToRemove.forEach(InteractionClass => {
      const interaction = interactionArray.find(
        interaction => interaction instanceof InteractionClass,
      );
      if (interaction) {
        this._spectaRemovedInteractions.push(interaction);
        this._Map.removeInteraction(interaction);
      }
    });

    if (this._zoomControl) {
      this._spectaZoomControlWasRemoved = true;
      this._Map.removeControl(this._zoomControl);
    } else {
      this._spectaZoomControlWasRemoved = false;
    }
  };

  private _restoreMapInteractions = (): void => {
    if (!this._Map) {
      return;
    }

    for (const interaction of this._spectaRemovedInteractions) {
      this._Map.addInteraction(interaction);
    }
    this._spectaRemovedInteractions = [];

    if (this._spectaZoomControlWasRemoved && this._zoomControl) {
      this._Map.addControl(this._zoomControl);
      this._spectaZoomControlWasRemoved = false;
    }
  };

  private _setupStoryScrollListener = (): void => {
    // Guard: block wheel-driven segment change until transition has ended
    let segmentChangeInProgress = false;
    const clearGuard = (): void => {
      segmentChangeInProgress = false;
    };
    this._clearStoryScrollGuard = clearGuard;

    let accumulatedDeltaY = 0;
    let scrollContainer: HTMLDivElement | null = null;

    const resolveStoryScrollContainer = (): HTMLDivElement | null => {
      const fromStageHost = this.storyScrollContainerRef.current;

      if (fromStageHost && document.contains(fromStageHost)) {
        return fromStageHost;
      }

      const fromPanel =
        this.storyViewerPanelRef.current?.getScrollContainer() ?? null;

      if (fromPanel && document.contains(fromPanel)) {
        return fromPanel;
      }

      return null;
    };

    scrollContainer = resolveStoryScrollContainer();

    const processStoryScrollFrame = (): void => {
      this._pendingStoryScrollRafId = null;

      if (!scrollContainer || !document.contains(scrollContainer)) {
        scrollContainer = resolveStoryScrollContainer();
      }

      const currentPanelHandle = this.storyViewerPanelRef.current;
      const storyType = this._model.getSelectedStory().story?.storyType;

      if (!scrollContainer) {
        accumulatedDeltaY = 0;
        return;
      }

      const deltaY = accumulatedDeltaY;
      accumulatedDeltaY = 0;

      // Don't want to handle next/prev logic in list mode
      if (isVerticalScrollPresentation(getStoryPresentationMode(storyType))) {
        scrollContainer.scrollBy({ top: deltaY });
        return;
      }

      if (!currentPanelHandle) {
        return;
      }

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
      const wheelEvent = event as WheelEvent;

      event.preventDefault();

      if (!scrollContainer || !document.contains(scrollContainer)) {
        scrollContainer = resolveStoryScrollContainer();
      }
      if (!scrollContainer) {
        return;
      }
      // One physical scroll tick often fires ~4 wheel events (sometimes across
      // frames on slow hardware). We accumulate deltaY and run flush once per
      // frame via rAF—the frame boundary batches events without adding delay.
      // So one scroll means one segment/scroll decision.
      accumulatedDeltaY += wheelEvent.deltaY;
      if (this._pendingStoryScrollRafId === null) {
        this._pendingStoryScrollRafId = requestAnimationFrame(
          processStoryScrollFrame,
        );
      }
    };

    this._storyScrollHandler = handleScroll;
    const container = this.props.containerRef.current;
    if (container) {
      this._storyScrollContainerEl = container;
      container.addEventListener('wheel', handleScroll, { passive: false });
    }
  };

  private _cleanupStoryScrollListener = (): void => {
    if (this._pendingStoryScrollRafId !== null) {
      cancelAnimationFrame(this._pendingStoryScrollRafId);
      this._pendingStoryScrollRafId = null;
    }
    if (this._storyScrollHandler && this._storyScrollContainerEl) {
      this._storyScrollContainerEl.removeEventListener(
        'wheel',
        this._storyScrollHandler,
      );
      this._storyScrollHandler = null;
      this._storyScrollContainerEl = null;
    }
  };

  private _teardownSpectaMode = (): void => {
    this._cleanupStoryScrollListener();
    this._restoreMapInteractions();
  };

  private _onAnnotationsChanged = (_: IJupyterGISModel, changes: MapChange) => {
    const newState = { ...this.state.annotations };
    changes.forEach((val, key) => {
      const data = this._model.sharedModel.getAnnotation(key);

      if (data && (val.action === 'add' || val.action === 'update')) {
        newState[key] = data;
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
    if (this._model.currentMode !== 'marking') {
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
      symbologyState: { layers: [] },
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
    await this._mapViewer.addSource(sourceId, sourceModel);

    this._model.addLayer(layerId, layerModel);
    await this._mapViewer.addLayer(
      layerId,
      layerModel,
      this._mapViewer.getLayerIDs().length,
    );
  }

  private _identifyFeature(e: MapBrowserEvent<any>) {
    if (this._model.currentMode !== 'identifying') {
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
      case 'VectorLayer':
        // Handled by selectInteraction (createSelectInteraction).
        break;

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
              this._featureAttributeCache.set(fid, props);
            }
          } else if (fid !== null && this._featureAttributeCache.has(fid)) {
            props = this._featureAttributeCache.get(fid);
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

      case 'GeoTiffLayer':
      case 'GeoZarrLayer': {
        const layer = this._mapViewer.getLayer(layerId) as RasterLayer;
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
    const olLayer = this._mapViewer.getLayer(layerId);

    if (isSourceType) {
      this._mapViewer.updateSource(layerId, jgisLayer);
    }
    if (!jgisLayer || !olLayer) {
      this._log('error', 'Failed to update layer -- layer not found');
      return;
    }
    this._mapViewer.updateLayer(layerId, jgisLayer, olLayer);
  }

  private _convertFeatureToMs(_: IJupyterGISModel, args: string) {
    const json = JSON.parse(args);
    const { id: layerId, selectedFeature } = json;
    const olLayer = this._mapViewer.getLayer(layerId);
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
      this._mapViewer.flyToPosition(newPosition, zoom);
    } else {
      throw new Error(
        'Could not move to geolocation, because current zoom is not defined.',
      );
    }
  }

  private _handleLocationIndicatorToggled(
    _sender: IJupyterGISModel,
    uiState: IJGISUIState,
  ): void {
    const active = Boolean(uiState.locationIndicatorActive);
    if (active === this._locationIndicatorActive) {
      return;
    }
    this._locationIndicatorActive = active;
    if (active) {
      this._startLocationIndicator();
    } else {
      this._stopLocationIndicator();
    }
  }

  private _startLocationIndicator(): void {
    if (
      !this._geolocation ||
      !this._geolocationSource ||
      !this._geolocationAccuracyFeature ||
      !this._geolocationPositionFeature
    ) {
      throw new Error('State incorrectly initialized. This is a bug.');
    }
    this._geolocation.setTracking(true);
    this._geolocationSource.clear();
    this._geolocationSource.addFeatures([
      this._geolocationAccuracyFeature,
      this._geolocationPositionFeature,
    ]);
  }

  private _stopLocationIndicator(): void {
    if (!this._geolocation || !this._geolocationSource) {
      throw new Error('State incorrectly initialized. This is a bug.');
    }
    this._geolocation.setTracking(false);
    this._geolocationSource.clear();
  }

  private _handleThemeChange = (): void => {
    const lightTheme = isLightTheme();

    // TODO SOMETHING

    this.setState(old => ({ ...old, lightTheme }));
  };

  private _handleWindowResize = (): void => {
    // TODO SOMETHING
  };

  private _handleSegmentTransitionChange = (
    payload: IListStorySegmentTransition | null,
  ): void => {
    this.setState({ segmentTransition: payload });
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

  private _handleModeChanged = (): void => {
    const isDrawing = this._model.currentMode === 'drawing';
    this.setState(old => ({ ...old, isDrawing }));

    if (isDrawing) {
      this._editVectorLayer();
    }

    if (!isDrawing && this._draw) {
      this._removeDrawInteraction();
      this._setCurrentDrawLayerId(undefined);
    }
  };

  private _notifyInteractionModeCommands(): void {
    const commands = this._mainViewModel.commands;
    commands.notifyCommandChanged(CommandIDs.identify);
    commands.notifyCommandChanged(CommandIDs.addMarker);
    commands.notifyCommandChanged(CommandIDs.toggleDrawFeatures);
  }

  private _setCurrentDrawLayerId(layerId: string | undefined): void {
    this._currentDrawLayerID = layerId;
    this.setState(old =>
      old.currentDrawLayerId === layerId
        ? old
        : { ...old, currentDrawLayerId: layerId },
    );
  }

  private _handleDrawGeometryTypeChange = (
    /* handle with the change of geometry and instantiate new draw interaction and other ones accordingly*/
    drawGeometryLabel: string,
  ) => {
    // Clicking the active geometry toggles drawing off.
    if (this._currentDrawGeometry === drawGeometryLabel) {
      this._currentDrawGeometry = undefined;
      this._removeInteractions();

      this.setState(old => ({
        ...old,
        drawGeometryLabel: '',
      }));
      return;
    }

    this._currentDrawGeometry = drawGeometryLabel as Type;

    if (this._currentDrawLayerID) {
      this._currentVectorSource = this._getVectorSourceFromLayerID(
        this._currentDrawLayerID,
      );
    }

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
    this._setCurrentDrawLayerId(selectedLayerID);

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

  _removeInteractions = () => {
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
  };

  _updateInteractions = () => {
    this._removeInteractions();

    if (!this._currentDrawGeometry) {
      return;
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

    const layerId = this._currentDrawLayerID;
    const customAttributes = layerId
      ? this._model.getDrawCustomAttributes(layerId)
      : [];
    applyDrawCustomAttributesToFeature(feature, customAttributes);
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
    await this._mapViewer.updateSource(id, source);
  };

  private _renderAnnotationFloaters(): React.ReactNode {
    const annotationModel = this._model.annotationModel;
    if (!annotationModel) {
      return null;
    }

    return Object.entries(this.state.annotations).map(([key, annotation]) => {
      const screenPosition = this._computeAnnotationPosition(annotation);
      if (!screenPosition) {
        return null;
      }

      return (
        <PositionedFloater
          key={key}
          id={key}
          className="jGIS-Popup-Wrapper"
          left={screenPosition.x}
          top={screenPosition.y}
        >
          <AnnotationFloater itemId={key} annotationModel={annotationModel} />
        </PositionedFloater>
      );
    });
  }

  private _renderFeatureFloaters(): React.ReactNode {
    return this._getVisibleDrawIdentifiedFeatures().map(
      ([floaterKey, feature]) => {
        const screenPosition = this._computeFeatureFloaterPosition(feature);
        if (!screenPosition) {
          return null;
        }

        const id = `feature-floater-${floaterKey}`;
        return (
          <PositionedFloater
            key={id}
            id={id}
            className="jGIS-Popup-Wrapper jGIS-FeatureFloater-Wrapper"
            left={screenPosition.x}
            top={screenPosition.y}
          >
            <FeatureFloater feature={feature} />
          </PositionedFloater>
        );
      },
    );
  }

  render(): JSX.Element {
    const {
      clientPointers,
      displayTemporalController,
      drawGeometryLabel,
      isDrawing,
      currentDrawLayerId,
      filterStates,
      initialLayersReady,
      isSpectaPresentation,
      jgisSettings,
      loading,
      loadingLayer,
      remoteUser,
      scale,
      segmentTransition,
      viewProjection,
    } = this.state;
    const { isMobile } = this.props;
    const selectedStory = this._model.getSelectedStory().story;
    const storyPresentationMode = isSpectaPresentation
      ? getStoryPresentationMode(selectedStory?.storyType)
      : 'column';
    const showSidePanels = !isSpectaPresentation;
    const showMergedMobilePanel =
      isMobile &&
      Boolean(this._state) &&
      Boolean(this._formSchemaRegistry) &&
      Boolean(this._annotationModel);
    const spectaMobileTouch = isSpectaPresentation && isMobile;

    return (
      <>
        <MainViewOverlayLayer
          annotationFloaters={this._renderAnnotationFloaters()}
          featureFloaters={this._renderFeatureFloaters()}
          isDrawing={isDrawing}
          drawGeometryLabel={drawGeometryLabel}
          drawLayerId={currentDrawLayerId}
          onDrawGeometryTypeChange={this._handleDrawGeometryTypeChange}
          model={this._model}
        />

        <div className="jGIS-Mainview-Container" ref={this.props.containerRef}>
          {displayTemporalController ? (
            <TemporalSlider model={this._model} filterStates={filterStates} />
          ) : null}
          <MainViewMapSurface
            mainViewRef={this.mainViewRef}
            loading={loading}
            remoteUser={remoteUser}
            clientPointers={clientPointers}
            spectaMobileTouch={spectaMobileTouch}
            onTouchStart={this._handleSpectaTouchStart}
            onTouchEnd={this._handleSpectaTouchEnd}
          >
            <MainViewStoryStage
              model={this._model}
              storyPresentationMode={storyPresentationMode}
              isMobile={isMobile}
              segmentTransition={segmentTransition}
              initialLayersReady={initialLayersReady}
              isSpectaPresentation={isSpectaPresentation}
              stageRef={this.divRef}
              controlsToolbarRef={this.controlsToolbarRef}
              storyScrollContainerRef={this.storyScrollContainerRef}
              columnPanelContainerRef={this.spectaContainerRef}
              storyViewerPanelRef={this.storyViewerPanelRef}
              addLayer={this._addLayerForPanels}
              removeLayer={this._removeLayerForPanels}
              onSegmentTransitionChange={this._handleSegmentTransitionChange}
              onSegmentTransitionEnd={this._clearStoryScrollGuard}
            />
            {showSidePanels ? (
              <div className="jgis-panels-wrapper">
                <MainViewSidePanels
                  model={this._model}
                  commands={this._mainViewModel.commands}
                  settings={jgisSettings}
                  showMergedMobilePanel={showMergedMobilePanel}
                  state={this._state}
                  formSchemaRegistry={this._formSchemaRegistry}
                  annotationModel={this._annotationModel}
                  patchGeoJSONFeatureAttributes={
                    this._patchGeoJSONFeatureAttributes
                  }
                />
              </div>
            ) : null}
          </MainViewMapSurface>
          {!isSpectaPresentation ? (
            <StatusBar
              jgisModel={this._model}
              loading={loadingLayer}
              projection={viewProjection}
              scale={scale}
            />
          ) : null}
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
  private storyScrollContainerRef = React.createRef<HTMLDivElement>();
  private _Map: OlMap;
  private _mapViewer: IMapViewer;
  private _lastMapViewerType: MapViewerType = 'openlayers';
  private _lastCenter: Coordinate | undefined;
  private _lastZoom: number | undefined;
  private _zoomControl?: Zoom;
  private _model: IJupyterGISModel;
  private _geolocation?: Geolocation;
  private _geolocationSource?: VectorSource;
  private _geolocationPositionFeature?: Feature;
  private _geolocationAccuracyFeature?: Feature;
  private _locationIndicatorActive = false;
  private _mainViewModel: MainViewModel;
  private _ready = false;
  private _documentPath?: string;
  private _contextMenu: ContextMenu;
  private _highlightLayerRef: {
    current: VectorImageLayer<VectorSource> | null;
  } = { current: null };
  private _draw: Draw;
  private _snap: Snap;
  private _modify: Modify;
  private _select: Select;
  private _currentDrawLayerID: string | undefined;
  private _previousDrawLayerID: string | undefined;
  private _currentDrawSource: IJGISSource | undefined;
  private _currentVectorSource: VectorSource | undefined;
  private _currentDrawSourceID: string | undefined;
  private _currentDrawGeometry: Type | undefined;
  private _updateCenter: CallableFunction;
  private _state?: IStateDB;
  private _formSchemaRegistry?: IJGISFormSchemaRegistry;
  private _annotationModel?: IAnnotationModel;
  private _loggerRegistry?: ILoggerRegistry;
  private _addLayerForPanels = (id: string, layer: IJGISLayer, index: number) =>
    this._mapViewer.addLayer(id, layer, index);
  private _removeLayerForPanels = (id: string) =>
    this._mapViewer.removeLayer(id);
  private _patchGeoJSONFeatureAttributes: PatchGeoJSONFeatureAttributes;

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

  private _featureAttributeCache: Map<string | number, any> = new Map();
  private _contextMenuAttached = false;
  private _spectaModeSetupDone = false;
  private _spectaRemovedInteractions: Interaction[] = [];
  private _spectaZoomControlWasRemoved = false;
  private _storyScrollHandler: ((e: Event) => void) | null = null;
  private _storyScrollContainerEl: HTMLDivElement | null = null;
  private _clearStoryScrollGuard: () => void;
  private _pendingStoryScrollRafId: number | null = null;
  private _initialLayersCount: number;
  private _spectaTouchStartX = 0;
}

// ! TODO make mainview a modern react component instead of a class
/* thin React wrapper to resize the panels on window resize with the help of ResizeObserver */
function MainViewWithObserver(
  props: Omit<IMainViewProps, 'isMobile' | 'containerRef'>,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(containerRef);

  React.useEffect(() => {
    containerRef.current?.classList.toggle('jgis-narrow', isMobile);
  }, [isMobile]);

  return (
    <MainView {...props} isMobile={isMobile} containerRef={containerRef} />
  );
}

export { MainViewWithObserver };
