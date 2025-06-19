import {
  IJGISFormSchemaRegistry,
  IJupyterGISClientState,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Panel } from '@lumino/widgets';
import * as React from 'react';
import { v4 as uuid } from 'uuid';

import { EditForm } from '@/src/formbuilder/editform';

interface IStates {
  model: IJupyterGISModel | undefined;
  clientId: number | null; // ID of the yjs client
  id: string; // ID of the component, it is used to identify which component
  selectedObject?: string;
  setSelectedObject: any;
}

interface IProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  model: IJupyterGISModel;
  selectedObject: string | undefined;
  setSelectedObject: any;
}

export class ObjectPropertiesReact extends React.Component<IProps, IStates> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      clientId: props.model.getClientId(),
      id: uuid(),
      model: props.model,
      selectedObject: props.selectedObject,
      setSelectedObject: props.setSelectedObject,
    };

    this.props.model.clientStateChanged.connect(
      this._onClientSharedStateChanged,
    );

    this.props.model?.sharedLayersChanged.connect(this._sharedJGISModelChanged);
    this.props.model?.sharedSourcesChanged.connect(
      this._sharedJGISModelChanged,
    );
  }

  private _sharedJGISModelChanged = (): void => {
    this.forceUpdate();
  };

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>,
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
        this.state.setSelectedObject(undefined);
        this.setState(old => ({
          ...old,
          selectedObject: undefined,
        }));
        return;
      }

      const selectedObject = selectedObjectIds[0];
      if (selectedObject !== this.state.selectedObject) {
        this.state.setSelectedObject(selectedObject);
        this.setState(old => ({
          ...old,
          selectedObject,
        }));
      }
    }
  };

  render(): React.ReactNode {
    const selectedObject = this.state.selectedObject;

    if (!selectedObject || !this.state.model) {
      return <div style={{ textAlign: 'center' }}>No layer selected</div>;
    }

    let layerId: string | undefined = undefined;
    let sourceId: string | undefined = undefined;
    const layer = this.state.model.getLayer(selectedObject);
    if (layer) {
      layerId = selectedObject;
      sourceId = layer.parameters?.source;
    } else {
      const source = this.state.model.getSource(selectedObject);

      if (source) {
        sourceId = selectedObject;
      }
    }

    return (
      <EditForm
        layer={layerId}
        source={sourceId}
        formSchemaRegistry={this.props.formSchemaRegistry}
        model={this.state.model}
      />
    );
  }
}

export namespace ObjectProperties {
  /**
   * Instantiation options for `ObjectProperties`.
   */
  export interface IOptions extends Panel.IOptions {
    model: IJupyterGISModel;
    formSchemaRegistry: IJGISFormSchemaRegistry;
  }
}
