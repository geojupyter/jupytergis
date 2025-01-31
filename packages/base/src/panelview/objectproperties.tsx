import {
  IJGISFormSchemaRegistry,
  IJupyterGISClientState,
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidgetContext
} from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import * as React from 'react';
import { v4 as uuid } from 'uuid';

import { IControlPanelModel } from '../types';
import { EditForm } from '../formbuilder/editform';

export class ObjectProperties extends PanelWithToolbar {
  constructor(params: ObjectProperties.IOptions) {
    super(params);
    this.title.label = 'Objects Properties';
    const body = ReactWidget.create(
      <ObjectPropertiesReact
        cpModel={params.controlPanelModel}
        tracker={params.tracker}
        formSchemaRegistry={params.formSchemaRegistry}
      />
    );
    this.addWidget(body);
    this.addClass('jGIS-sidebar-propertiespanel');
  }
}

interface IStates {
  context: IJupyterGISWidgetContext | undefined;
  selectedObject?: string;
  clientId: number | null; // ID of the yjs client
  id: string; // ID of the component, it is used to identify which component
  //is the source of awareness updates.
}

interface IProps {
  cpModel: IControlPanelModel;
  tracker: IJupyterGISTracker;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

class ObjectPropertiesReact extends React.Component<IProps, IStates> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      context: props.tracker.currentWidget?.context,
      clientId: null,
      id: uuid()
    };

    this.props.cpModel.jGISModel?.sharedLayersChanged.connect(
      this._sharedJGISModelChanged
    );
    this.props.cpModel.jGISModel?.sharedSourcesChanged.connect(
      this._sharedJGISModelChanged
    );
    this.props.cpModel.documentChanged.connect((_, changed) => {
      if (changed) {
        this.props.cpModel.disconnect(this._sharedJGISModelChanged);
        this.props.cpModel.disconnect(this._onClientSharedStateChanged);

        changed.context.model.sharedLayersChanged.connect(
          this._sharedJGISModelChanged
        );
        changed.context.model.sharedSourcesChanged.connect(
          this._sharedJGISModelChanged
        );
        changed.context.model.clientStateChanged.connect(
          this._onClientSharedStateChanged
        );
        this.setState(old => ({
          ...old,
          context: changed.context,
          filePath: changed.context.path,
          clientId: changed.context.model.getClientId()
        }));
      } else {
        this.setState({
          context: undefined,
          selectedObject: undefined
        });
      }
    });
  }

  private _sharedJGISModelChanged = (): void => {
    this.forceUpdate();
  };

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>
  ): void => {
    let newState: IJupyterGISClientState | undefined;
    const clientId = this.state.clientId;

    const localState = clientId ? clients.get(clientId) : null;
    if (
      localState &&
      localState.selected?.emitter &&
      localState.selected.emitter !== this.state.id &&
      localState.selected?.value
    ) {
      newState = localState;
    }
    if (newState) {
      const selection = newState.selected.value;
      const selectedObjectIds = Object.keys(selection || {});
      // Only show object properties if ONE object is selected
      if (selection === undefined || selectedObjectIds.length !== 1) {
        this.setState(old => ({
          ...old,
          selectedObject: undefined
        }));
        return;
      }

      const selectedObject = selectedObjectIds[0];
      if (selectedObject !== this.state.selectedObject) {
        this.setState(old => ({
          ...old,
          selectedObject
        }));
      }
    }
  };

  render(): React.ReactNode {
    const selectedObject = this.state.selectedObject;

    if (!selectedObject || !this.state.context) {
      return <div></div>;
    }

    let layerId: string | undefined = undefined;
    let sourceId: string | undefined = undefined;
    const layer = this.state.context.model.getLayer(selectedObject);
    if (layer) {
      layerId = selectedObject;
      sourceId = layer.parameters?.source;
    } else {
      const source = this.state.context.model.getSource(selectedObject);

      if (source) {
        sourceId = selectedObject;
      }
    }

    return (
      <EditForm
        layer={layerId}
        source={sourceId}
        formSchemaRegistry={this.props.formSchemaRegistry}
        context={this.state.context}
      />
    );
  }
}

export namespace ObjectProperties {
  /**
   * Instantiation options for `ObjectProperties`.
   */
  export interface IOptions extends Panel.IOptions {
    controlPanelModel: IControlPanelModel;
    formSchemaRegistry: IJGISFormSchemaRegistry;
    tracker: IJupyterGISTracker;
  }
}
