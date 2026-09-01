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
  IIdentifiedFeatures,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISDocChange,
  IJupyterGISModel,
  JgisCoordinates,
  JupyterGISModel,
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
import { Geolocation, View } from 'ol';
import Feature from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';
import { getCenter } from 'ol/extent';
import { GeoJSON } from 'ol/format';
import { Type } from 'ol/geom/Geometry';
import { Select } from 'ol/interaction';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { VectorImage as VectorImageLayer } from 'ol/layer';
import { fromLonLat, get as getProjection, toLonLat } from 'ol/proj';
import { Vector as VectorSource } from 'ol/source';
import { Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import * as React from 'react';

import { CommandIDs } from '@/src/constants';
import AnnotationFloater from '@/src/features/annotations/components/AnnotationFloater';
import { DrawToolController } from '@/src/features/draw-tool';
import FeatureFloater from '@/src/features/identify/components/FeatureFloater';
import { getFeatureIdentifier } from '@/src/features/identify/utils/getFeatureIdentifier';
import {
  getStoryPresentationMode,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { useIsMobile } from '@/src/shared/hooks/useIsMobile';
import { isLightTheme } from '@/src/tools';
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
import { createMapAdapter, IMapAdapter, MapAdapterType } from './mapAdapter';
import { openEOEvents } from '../features/layers/openeo/OpenEOTileLayer';
import {
  getZoomExtentForOlLayer,
  isValidExtent,
  transformExtentToViewProjection,
} from './utils/olLayerZoomExtent';
import type { IStoryViewerPanelHandle } from '../features/story/StoryViewerPanel';
import type { IListStorySegmentTransition } from '../features/story/types/types';


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
    this._drawTool = new DrawToolController({
      getMap: () => this._mapAdapter.getMap(),
      getLayer: layerId => this._mapAdapter.getLayer(layerId),
      getModel: () => this._model,
      onDrawLayerIdChange: layerId => this._setCurrentDrawLayerId(layerId),
      onDrawGeometryLabelChange: label =>
        this.setState(old => ({ ...old, drawGeometryLabel: label })),
    });
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
      this._mapAdapter.onZoomToPosition,
      this._mapAdapter,
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
      window.jupytergisMaps[this._documentPath] = this._mapAdapter.getMap();
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
    this._model.sharedLayersChanged.disconnect(this._onLayersChanged, this);
    this._model.sharedLayerTreeChanged.disconnect(
      this._onLayerTreeChange,
      this,
    );
    this._model.sharedSourcesChanged.disconnect(this._onSourcesChange, this);
    this._model.sharedModel.changed.disconnect(this._onSharedModelStateChange);
    this._model.sharedAnnotationsChanged.disconnect(
      this._onAnnotationsChanged,
      this,
    );
    this._model.zoomToPositionSignal.disconnect(
      this._mapAdapter.onZoomToPosition,
      this,
    );
    this._model.updateLayerSignal.disconnect(this._triggerLayerUpdate, this);
    this._model.addFeatureAsMsSignal.disconnect(this._convertFeatureToMs, this);
    this._model.geolocationChanged.disconnect(
      this._handleGeolocationChanged,
      this,
    );
    this._model.flyToGeometrySignal.disconnect(this.flyToGeometry, this);
    this._model.highlightFeatureSignal.disconnect(
      this.highlightFeatureOnMap,
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
    if (this._mapAdapter) {
      this._mapAdapter.destroy();
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

    if (!this.divRef.current) {
      return;
    }

    const mapAdapterSetting =
      this._model.jgisSettings.mapAdapter || 'openlayers';
    const mapAdapterType: MapAdapterType = (
      mapAdapterSetting === 'maplibre' ? 'maplibre' : 'openlayers'
    ) as MapAdapterType;

    this._lastMapAdapterType = mapAdapterType;

    // Create the map adapter using abstraction
    this._mapAdapter = await createMapAdapter(mapAdapterType, this._model);

    await this._mapAdapter.initialize(this.divRef.current, {
      projection,
      center: [center[0], center[1]],
      zoom,
      rotation: 0,
      controlsTarget: this.controlsToolbarRef.current || undefined,
      zoomButtonsEnabled: this._model.jgisSettings.zoomButtonsEnabled,
      isSpectaMode: this._model.isSpectaMode(),
      mainViewId: this._mainViewModel.id,
      callbacks: {
        onPostRender: () => {
          if (this.state.annotations) {
            this._updateAnnotation();
          }
          this._updateFeatureFloaters();
        },
        onScaleChange: scale => {
          this.setState(old => ({
            ...old,
            scale,
          }));
        },
        onContextMenu: (event, lastPointerCoordinate) => {
          if (lastPointerCoordinate) {
            this._clickCoords = lastPointerCoordinate;
          }
          this._contextMenu.open(event);
        },
      },
    });

    const geolocationHandles = this._mapAdapter.getGeolocationHandles();
    this._geolocation = geolocationHandles.geolocation;
    this._geolocationSource = geolocationHandles.source;
    this._geolocationPositionFeature = geolocationHandles.positionFeature;
    this._geolocationAccuracyFeature = geolocationHandles.accuracyFeature;

    if (JupyterGISModel.getOrderedLayerIds(this._model).length !== 0) {
      await this._mapAdapter.updateLayersImpl(
        JupyterGISModel.getOrderedLayerIds(this._model),
      );
      const options = this._model.getOptions();
      this.updateOptions(options);
    }

    const view = this._mapAdapter.getMap().getView();
    this.setState(old => ({
      ...old,
      loading: false,
      viewProjection: {
        code: projection,
        units: (getProjection(projection) ?? view.getProjection()).getUnits(),
      },
    }));
  }

  addContextMenu = (): void => {
    this._commands.addCommand(CommandIDs.deleteSelectedFeatures, {
      label: 'Delete feature',
      isEnabled: () => {
        if (!this._clickCoords || this._model.currentMode !== 'drawing') {
          return false;
        }
        return this._drawTool.hasFeatureAtCoordinate(this._clickCoords);
      },
      execute: () => {
        if (this._clickCoords) {
          this._drawTool.deleteAtCoordinate(this._clickCoords);
        }
      },
    });

    this._commands.addCommand(CommandIDs.addAnnotation, {
      label: 'Add annotation',
      describedBy: {
        args: {
          type: 'object',
          properties: {},
        },
      },
      isEnabled: () => {
        return !!this._mapAdapter?.getMap();
      },
      execute: () => {
        const map = this._mapAdapter?.getMap();
        if (!map) {
          return;
        }

        this._mainViewModel.addAnnotation({
          position: {
            x: this._clickCoords[0],
            y: this._clickCoords[1],
          },
          zoom: map.getView().getZoom() ?? 0,
          label: 'New annotation',
          contents: [],
          parent: map.getViewport().id,
          open: true,
        });
      },
    });

    this._commands.addCommand('Copy-Coordinates-Map-CRS', {
      label: () => {
        const map = this._mapAdapter?.getMap();
        if (!map || !this._clickCoords) {
          return 'Map CRS';
        }

        const proj = map.getView().getProjection().getCode();
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
        const map = this._mapAdapter?.getMap();
        if (!map || !this._clickCoords) {
          return 'Latitude/Longitude';
        }

        const lonLat = toLonLat(
          this._clickCoords,
          map.getView().getProjection(),
        );

        return `Latitude/Longitude: (${lonLat[1].toFixed(6)}N, ${lonLat[0].toFixed(6)}E)`;
      },
      execute: async () => {
        const lonLat = toLonLat(
          this._clickCoords,
          this._mapAdapter.getMap().getView().getProjection(),
        );

        const text = `${lonLat[1].toFixed(6)}, ${lonLat[0].toFixed(6)}`;
        await navigator.clipboard.writeText(text);
      },
    });

    this._contextMenu.addItem({
      command: CommandIDs.deleteSelectedFeatures,
      selector: '.ol-viewport',
      rank: 0,
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

    const view = this._mapAdapter.getMap().getView();
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
          featureProjection: this._mapAdapter
            .getMap()
            .getView()
            .getProjection(),
        });

    const olFeature = new Feature({
      geometry: parsedGeometry,
      ...(geometry !== featureOrGeometry ? featureOrGeometry : {}),
    });

    this._mapAdapter.secureHighlightLayer();
    const source = this._highlightLayerRef.current?.getSource();
    source?.clear();
    source?.addFeature(olFeature);
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
    this._drawTool.setDrawLayerId(selectedLayerId);
    this._drawTool.enterLayer();
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
        const pixel = this._mapAdapter
          .getMap()
          .getPixelFromCoordinate([
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
    if (!this._mapAdapter?.getMap()) {
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

    if (!this._mapAdapter) {
      return;
    }

    // Handle mapAdapter setting changes
    const mapAdapterSetting =
      (this._model.jgisSettings.mapAdapter as string) || 'openlayers';
    const newMapAdapterType: MapAdapterType = (
      mapAdapterSetting === 'maplibre' ? 'maplibre' : 'openlayers'
    ) as MapAdapterType;

    if (newMapAdapterType !== this._lastMapAdapterType) {
      // eslint-disable-next-line no-console
      console.log(
        `Map adapter changed from ${this._lastMapAdapterType} to ${newMapAdapterType}`,
      );
      this._regenerateMap();
      return;
    }

    // Handle other settings changes (existing code)
    const enabled = this._model.jgisSettings.zoomButtonsEnabled;
    this._mapAdapter.setZoomButtonsEnabled(enabled);
  }

  private async _regenerateMap(): Promise<void> {
    try {
      // Dispose old adapter
      if (this._mapAdapter) {
        this._mapAdapter.destroy();
      }

      // Get current view state before regenerating
      const currentView = this._mapAdapter?.getMap()?.getView();
      const center = currentView?.getCenter() || [0, 0];
      const zoom = currentView?.getZoom() || 1;
      const projection = this.state.viewProjection.code || DEFAULT_PROJECTION;

      // Regenerate map with new adapter
      await this.generateMap(center, zoom, projection);

      const layerids = this._mapAdapter.getLayerIDs();

      this._mapAdapter.updateLayers(layerids);
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
    const map = this._mapAdapter.getMap();
    let view = map.getView();
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
    map.setView(view);

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
        this._mapAdapter.removeLayer(id);
        if (
          this._model.currentMode === 'drawing' &&
          this._model.checkIfIsADrawVectorLayer(oldLayer as IJGISLayer)
        ) {
          this._model.currentMode = 'panning';
          this._notifyInteractionModeCommands();
        }
        return;
      }

      const mapLayer = this._mapAdapter.getLayer(id);
      const layerTree = JupyterGISModel.getOrderedLayerIds(this._model);

      if (layerTree.includes(id)) {
        this._mapAdapter.updateLayer(id, newLayer, mapLayer, oldLayer);

        if (mapLayer) {
          this._mapAdapter.trackLayerViewState(id, mapLayer);
        }

        if (
          this._model.currentMode === 'drawing' &&
          id === this._drawTool.currentDrawLayerId
        ) {
          this._drawTool.enterLayer();
        }
      } else {
        this._mapAdapter.updateLayers(layerTree);
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
    this._mapAdapter.updateLayers(
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
        void this._mapAdapter.updateSource(sourceId, source);
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

    change.sourceChange?.forEach(srcChange => {
      if (!srcChange.newValue || Object.keys(srcChange.newValue).length === 0) {
        this._mapAdapter.removeSource(srcChange.id);
      } else {
        const source = this._model.getSource(srcChange.id);
        if (!source) {
          return;
        }
        if (
          this._model.currentMode === 'drawing' &&
          srcChange.id === this._drawTool.currentDrawSourceId
        ) {
          return;
        }
        void this._mapAdapter.updateSource(srcChange.id, source);
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
        window.jupytergisMaps[this._documentPath] = this._mapAdapter.getMap();
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
    this._mapAdapter.enterPresentationMode();
  };

  private _restoreMapInteractions = (): void => {
    this._mapAdapter.exitPresentationMode();
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

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const storyType = this._model.getSelectedStory().story?.storyType;
      if (!isVerticalScrollPresentation(getStoryPresentationMode(storyType))) {
        return;
      }

      if (!scrollContainer || !document.contains(scrollContainer)) {
        scrollContainer = resolveStoryScrollContainer();
      }

      if (!scrollContainer) {
        return;
      }

      event.preventDefault();
      const step = Math.max(5, Math.round(scrollContainer.clientHeight * 0.05));
      scrollContainer.scrollBy({
        top: event.key === 'ArrowDown' ? step : -step,
      });
    };

    this._storyScrollHandler = handleScroll;
    this._storyKeyDownHandler = handleKeyDown;
    const container = this.props.containerRef.current;
    if (container) {
      this._storyScrollContainerEl = container;
      container.addEventListener('wheel', handleScroll, { passive: false });
    }
    // Document-level so arrows work while the map surface holds focus.
    document.addEventListener('keydown', handleKeyDown);
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
    if (this._storyKeyDownHandler) {
      document.removeEventListener('keydown', this._storyKeyDownHandler);
      this._storyKeyDownHandler = null;
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
    const pixels = this._mapAdapter.getMap().getPixelFromCoordinate([x, y]);

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
      const pixels = this._mapAdapter.getMap().getPixelFromCoordinate(center);
      if (pixels) {
        return { x: pixels[0], y: pixels[1] };
      }
      return undefined;
    }

    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
      const pixels = this._mapAdapter
        .getMap()
        .getPixelFromCoordinate(geometry.coordinates);
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
    const view = this._mapAdapter.getMap().getView();
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

  private _triggerLayerUpdate(_: IJupyterGISModel, args: string) {
    // ? could send just the filters object and modify that instead of emitting whole layer
    const json = JSON.parse(args);
    const { layerId, layer: jgisLayer } = json;
    const isSourceType =
      typeof jgisLayer?.type === 'string' && jgisLayer.type.includes('Source');
    const olLayer = this._mapAdapter.getLayer(layerId);

    if (isSourceType) {
      this._mapAdapter.updateSource(layerId, jgisLayer);
    }
    if (!jgisLayer || !olLayer) {
      this._log('error', 'Failed to update layer -- layer not found');
      return;
    }
    this._mapAdapter.updateLayer(layerId, jgisLayer, olLayer);
  }

  private _convertFeatureToMs(_: IJupyterGISModel, args: string) {
    const json = JSON.parse(args);
    const { id: layerId, selectedFeature } = json;
    const olLayer = this._mapAdapter.getLayer(layerId);
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
    const view = this._mapAdapter.getMap().getView();
    const zoom = view.getZoom();
    if (zoom) {
      this._mapAdapter.flyToPosition(newPosition, zoom);
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

    const story = this._model.getSelectedStory().story;
    // Don't treat horizontal swipes as guided prev/next segment navigation.
    if (
      isVerticalScrollPresentation(getStoryPresentationMode(story?.storyType))
    ) {
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - this._spectaTouchStartX;
    const threshold = 50;
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
      this._setHighlightFeatures([]);
      this._drawTool.enterLayer();
      return;
    }

    this._drawTool.leaveDrawMode();
  };

  private _notifyInteractionModeCommands(): void {
    const commands = this._mainViewModel.commands;
    commands.notifyCommandChanged(CommandIDs.identify);
    commands.notifyCommandChanged(CommandIDs.addMarker);
    commands.notifyCommandChanged(CommandIDs.toggleDrawFeatures);
  }

  private _setCurrentDrawLayerId(layerId: string | undefined): void {
    this.setState(old =>
      old.currentDrawLayerId === layerId
        ? old
        : { ...old, currentDrawLayerId: layerId },
    );
  }

  private _handleDrawGeometryTypeChange = (drawGeometryLabel: string): void => {
    this._drawTool.handleGeometryTypeChange(drawGeometryLabel);
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
    await this._mapAdapter.updateSource(id, source);
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
  private _mapAdapter: IMapAdapter;
  private _lastMapAdapterType: MapAdapterType = 'openlayers';
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
  private _drawTool: DrawToolController;
  private _previousDrawLayerID: string | undefined;
  private _updateCenter: CallableFunction;
  private _state?: IStateDB;
  private _formSchemaRegistry?: IJGISFormSchemaRegistry;
  private _annotationModel?: IAnnotationModel;
  private _loggerRegistry?: ILoggerRegistry;
  private _addLayerForPanels = (id: string, layer: IJGISLayer, index: number) =>
    this._mapAdapter.addLayer(id, layer, index);
  private _removeLayerForPanels = (id: string) =>
    this._mapAdapter.removeLayer(id);
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

  private _contextMenuAttached = false;
  private _spectaModeSetupDone = false;
  private _storyScrollHandler: ((e: Event) => void) | null = null;
  private _storyKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
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
