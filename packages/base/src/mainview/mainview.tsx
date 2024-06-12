import { MapChange } from '@jupyter/ydoc';
import {
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { JSONValue } from '@lumino/coreutils';
import * as React from 'react';

import * as OpenLayer from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import 'ol/ol.css';

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
      this._openLayersMap = new OpenLayer.Map({
        target: this.divRef.current,
        layers: [
          new TileLayer({
            source: new XYZ({
              url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
          })
        ],
        view: new OpenLayer.View({
          center: [0, 0],
          zoom: 2
        })
      });

      console.log('created map', this._openLayersMap);

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

  private _openLayersMap: OpenLayer.Map;

  private _model: IJupyterGISModel;
  private _mainViewModel: MainViewModel;
}
