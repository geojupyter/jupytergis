import { MapChange } from '@jupyter/ydoc';
import {
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISLayersTreeDocChange,
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
    this._model.sharedLayersTreeChanged.connect(this._onLayerTreeChange, this);
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
   * Add or update a source in the map.
   *
   * @param id - the source id.
   * @param source - the source object.
   */
  setSource(id: string, source: IJGISSource): void {
    // Workaround stupid maplibre issue
    this._Map._lazyInitEmptyStyle();

    switch (source.type) {
      case 'RasterSource': {
        const mapSource = this._Map.getSource(id) as MapLibre.RasterTileSource;
        if (mapSource) {
          mapSource.setTiles([source.parameters?.url]);
        } else {
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
    const update = () => {
      const previousLayerIds = this._Map.getStyle().layers.map(layer => layer.id);
      let beforeId: string | undefined = undefined;

      // we use the reverse order of the list to add the layer from the top to the
      // bottom.
      // This is to ensure that the beforeId (layer on top of the one we move or add)
      // is already added in the map.
      layerIds.slice().reverse().forEach(layerId => {
        const layer = this._model.sharedModel.getLayer(layerId);

        if (!layer) {
          console.log(`Layer id ${layerId} does not exist`);
          return;
        }

        if (this._Map.getLayer(layerId)) {
          this._Map.moveLayer(layerId, beforeId);
        } else {
          const sourceId = layer.parameters?.source;
          const source = this._model.sharedModel.getSource(sourceId);
          if (!source) {
            return;
          }

          if (!this._Map.getSource(sourceId)) {
            this.setSource(sourceId, source);
          }

          switch (layer.type) {
            case 'RasterLayer': {
              this._Map.addLayer(
                {
                  id: layerId,
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
        beforeId = layerId;

        // remove the element of the previous list as treated.
        const index = previousLayerIds.indexOf(layerId, 0);
        if (index > -1) {
          previousLayerIds.splice(index, 1);
        }
      });

      // Remove the layers not used anymore.
      previousLayerIds.forEach(layerId => {
        this._Map.removeLayer(layerId);
      })
    }

    // Workaround to avoid "Map.style undefined" error
    if(this._Map.loaded()) {
      update();
    } else {
      this._Map.on('load', update);
    }
  }

  /**
   * Update a layer of the map.
   *
   * @param id - id of the layer.
   * @param layer - the layer object.
   */
  updateLayer(id: string, layer: IJGISLayer): void {
    const update = () => {
      const sourceId = layer.parameters?.source;
      const source = this._model.sharedModel.getSource(sourceId);
      if (!source) {
        return;
      }

      if (!this._Map.getSource(sourceId)) {
        this.setSource(sourceId, source);
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
    }

    // Workaround to avoid "Map.style undefined" error
    if(this._Map.loaded()) {
      update();
    } else {
      this._Map.on('load', update);
    }
  }

  /**
   * Remove a layer from the map.
   *
   * @param id - the id of the layer.
   */
  removeLayer(id: string): void {
    // Check if the layer already exist in the map.
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
    change.layerChange?.forEach((change) => {
      const layer = change.newValue;
      if (!layer) {
        this.removeLayer(change.id);
      } else {
        this.updateLayer(change.id, layer);
      }
    });
  }

  private _onLayerTreeChange(
    sender: IJupyterGISDoc,
    change: IJGISLayersTreeDocChange
  ): void {
    // We can't properly use the change, because of the nested groups in the the shared
    // document which is flattened for the map tool.
    this.updateLayers(JupyterGISModel.getOrderedLayerIds(this._model));
  }

  private _onSourcesChange(
    _: IJupyterGISDoc,
    change: IJGISSourceDocChange
  ): void {
    change.sourceChange?.forEach((change) => {
      if (!change.newValue) {
        this.removeSource(change.id);
      } else {
        const source = this._model.getSource(change.id);
        if (source) {
          this.setSource(change.id, source);
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
