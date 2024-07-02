import { MapChange } from '@jupyter/ydoc';
import {
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISSource,
  IJGISSourceDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  JupyterGISModel
} from '@jupytergis/schema';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue } from '@lumino/coreutils';
import * as React from 'react';

import * as MapLibre from 'maplibre-gl';

// import 'maplibre-gl.css';

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
  }

  componentDidMount(): void {
    window.addEventListener('resize', this._handleWindowResize);
    this.generateScene();
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

  generateScene = (): void => {
    if (this.divRef.current) {
      this._Map = new MapLibre.Map({
        container: this.divRef.current
      });

      this.setState(old => ({ ...old, loading: false }));
    }
  };

  /**
   * MapLibre function to execute operation on `style` (add/update/remove layer/source),
   * avoiding "Map.style undefined" error.
   * This is required because of the lack of 'ready' promise in the Map object.
   *
   * @param callback - the function updating the Map.
   */
  private _mapLibreExecute(callback: () => void) {
    // Workaround to avoid "Map.style undefined" error, because of the miss of a
    // 'ready' promise.
    if (this._Map.loaded()) {
      callback();
    } else {
      this._Map.on('load', callback);
    }
  }

  /**
   * Add a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  addSource(id: string, source: IJGISSource): void {
    // Workaround stupid maplibre issue
    this._Map._lazyInitEmptyStyle();

    switch (source.type) {
      case 'RasterSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.RasterTileSource;
        if (!mapSource) {
          this._Map.addSource(id, {
            type: 'raster',
            tiles: [source.parameters?.url],
            tileSize: 256
          });
        }
      }
    }
  }

  /**
   * Update a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  updateSource(id: string, source: IJGISSource): void {
    // Workaround stupid maplibre issue
    this._Map._lazyInitEmptyStyle();

    switch (source.type) {
      case 'RasterSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.RasterTileSource;
        if (!mapSource) {
          console.log(`Source id ${id} does not exist`);
          return;
        }
        mapSource.setTiles([source.parameters?.url]);
      }
    }
  }

  /**
   * Remove a source from the map.
   *
   * @param id - the source id.
   */
  removeSource(id: string): void {
    const mapLayer = this._Map.getLayer(id);
    if (mapLayer) {
      this._Map.removeSource(id);
    }
  }

  /**
   * Add or move the layers of the map.
   *
   * @param layerIds - the list of layers in the depth order (beneath first).
   */
  updateLayers(layerIds: string[]) {
    const callback = () => {
      const previousLayerIds = this._Map
        .getStyle()
        .layers.map(layer => layer.id);

      // We use the reverse order of the list to add the layer from the top to the
      // bottom.
      // This is to ensure that the beforeId (layer on top of the one we add/move)
      // is already added/moved in the map.
      layerIds
        .slice()
        .reverse()
        .forEach(layerId => {
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
            this.addLayer(layerId, layer, indexInMap);
          }

          // Remove the element of the previous list as treated.
          const index = previousLayerIds.indexOf(layerId);
          if (index > -1) {
            previousLayerIds.splice(index, 1);
          }
        });

      // Remove the layers not used anymore.
      previousLayerIds.forEach(layerId => {
        this._Map.removeLayer(layerId);
      });
    };

    this._mapLibreExecute(callback);
  }

  /**
   * Add a layer to the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   * @param index - expected index of the layer.
   */
  addLayer(id: string, layer: IJGISLayer, index: number) {
    // Add the source if necessary.
    const sourceId = layer.parameters?.source;
    const source = this._model.sharedModel.getSource(sourceId);
    if (!source) {
      return;
    }
    if (!this._Map.getSource(sourceId)) {
      this.addSource(sourceId, source);
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
            source: sourceId,
            minzoom: source.parameters?.minZoom || 0,
            maxzoom: source.parameters?.maxZoom || 24
          },
          beforeId
        );
      }
    }
  }

  /**
   * Move a layer in the stack.
   *
   * @param id - id of the layer.
   * @param index - expected index of the layer.
   */
  moveLayer(id: string, index: number | undefined) {
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
  updateLayer(id: string, layer: IJGISLayer): void {
    const callback = () => {
      const sourceId = layer.parameters?.source;
      const source = this._model.sharedModel.getSource(sourceId);
      if (!source) {
        return;
      }

      if (!this._Map.getSource(sourceId)) {
        this.addSource(sourceId, source);
      }

      // Check if the layer already exist in the map.
      const mapLayer = this._Map.getLayer(id);
      if (mapLayer) {
        mapLayer.source = sourceId;
        this._Map.setLayoutProperty(
          id,
          'visibility',
          layer.visible ? 'visible' : 'none'
        );
      }
    };

    this._mapLibreExecute(callback);
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
    sender: IJupyterGISDoc,
    change: MapChange
  ): void {
    // TODO SOMETHING
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
    change.layerChange?.forEach(change => {
      const layer = change.newValue;
      if (!layer) {
        this.removeLayer(change.id);
      } else {
        if (JupyterGISModel.getOrderedLayerIds(this._model).includes(change.id)) {
          this.updateLayer(change.id, layer);
        }
      }
    });
  }

  private _onLayerTreeChange(
    sender: IJupyterGISDoc,
    change: IJGISLayerTreeDocChange
  ): void {
    // We can't properly use the change, because of the nested groups in the the shared
    // document which is flattened for the map tool.
    this.updateLayers(JupyterGISModel.getOrderedLayerIds(this._model));
  }

  private _onSourcesChange(
    _: IJupyterGISDoc,
    change: IJGISSourceDocChange
  ): void {
    change.sourceChange?.forEach(change => {
      if (!change.newValue) {
        this.removeSource(change.id);
      } else {
        const source = this._model.getSource(change.id);
        if (source) {
          this.updateSource(change.id, source);
        }
      }
    });
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

  private divRef = React.createRef<HTMLDivElement>(); // Reference of render div

  private _Map: MapLibre.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
}
