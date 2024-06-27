import { MapChange } from '@jupyter/ydoc';
import {
  IJGISLayerDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  IRasterSource
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
    sender: IJupyterGISDoc,
    change: IJGISLayerDocChange
  ): void {
    // TODO Why is this empty?? We need this for granular updates
    // change.layerChange?.forEach((change) => {
    //   console.log('new change', change);
    // })

    for (const layerId of Object.keys(this._model.sharedModel.layers)) {
      const layer = this._model.sharedModel.getLayer(layerId);

      if (!layer) {
        console.log(`Layer id ${layerId} does not exist`);
        continue;
      }

      switch (layer.type) {
        case 'RasterLayer': {
          const sourceId = layer.parameters?.source;
          const source = this.getSource<IRasterSource>(sourceId);

          if (!source) {
            continue;
          }

          // Workaround stupid maplibre issue
          this._Map._lazyInitEmptyStyle();

          // If the source does not exist, create it
          if (!this._Map.getSource(sourceId)) {
            this._Map.addSource(sourceId, {
              type: 'raster',
              tiles: [source.url],
              tileSize: 256
            });
          } else {
            // TODO If the source already existed, update it
          }

          const mapLayer = this._Map.getLayer(layerId);
          if (!mapLayer) {
            this._Map.addLayer({
              id: layerId,
              type: 'raster',
              layout: {
                visibility: layer.visible ? 'visible' : 'none'
              },
              source: sourceId,
              minzoom: source.minZoom || 0,
              maxzoom: source.maxZoom || 24
            });
          } else {
            mapLayer.source = sourceId;
            this._Map.setLayoutProperty(
              layerId,
              'visibility',
              layer.visible ? 'visible' : 'none'
            );
          }
        }
      }
    }
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

  private divRef = React.createRef<HTMLDivElement>(); // Reference of render div

  private _Map: MapLibre.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
}
