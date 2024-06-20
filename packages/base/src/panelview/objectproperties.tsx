import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayerDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { ReactWidget } from '@jupyterlab/apputils';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import * as React from 'react';
import { v4 as uuid } from 'uuid';

import {
  focusInputField,
  removeStyleFromProperty
} from '../tools';
import { IControlPanelModel } from '../types';
import { ObjectPropertiesForm } from './formbuilder';
import { JupyterGISWidget } from '../widget';

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
  jGISOption?: IDict;
  filePath?: string;
  selectedObjectData?: IDict;
  selectedObject?: string;
  schema?: IDict;
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
      filePath: this.props.cpModel.filePath,
      clientId: null,
      id: uuid()
    };

    this.props.cpModel.jGISModel?.sharedLayersChanged.connect(
      this._sharedJGISModelChanged
    );
    this.props.cpModel.documentChanged.connect((_, changed) => {
      if (changed) {
        this.props.cpModel.disconnect(this._sharedJGISModelChanged);
        this.props.cpModel.disconnect(this._onClientSharedStateChanged);

        changed.context.model.sharedLayersChanged.connect(
          this._sharedJGISModelChanged
        );
        changed.context.model.clientStateChanged.connect(
          this._onClientSharedStateChanged
        );
        this.setState(old => ({
          ...old,
          filePath: changed.context.localPath,
          clientId: changed.context.model.getClientId()
        }));
      } else {
        this.setState({
          jGISOption: undefined,
          filePath: undefined,
          selectedObjectData: undefined,
          selectedObject: undefined,
          schema: undefined
        });
      }
    });
  }

  async syncObjectProperties(
    id: string | undefined,
    properties: { [key: string]: any }
  ) {
    if (!id) {
      return;
    }

    const currentWidget = this.props.tracker
      .currentWidget as JupyterGISWidget | null;
    if (!currentWidget) {
      return;
    }

    const model = this.props.cpModel.jGISModel;
    if (!model) {
      return;
    }

    model.sharedModel.updateObjectParameters(id, properties);
  }

  syncSelectedField = (
    id: string | null,
    value: any,
    parentType: 'panel' | 'dialog'
  ) => {
    let property: string | null = null;
    if (id) {
      const prefix = id.split('_')[0];
      property = id.substring(prefix.length);
    }
    this.props.cpModel.jGISModel?.syncSelectedPropField({
      parentType,
      id: property,
      value
    });
  };

  private _sharedJGISModelChanged = (
    _: IJupyterGISDoc,
    changed: IJGISLayerDocChange
  ): void => {
    this.setState(old => {
      if (old.selectedObject) {
        const selectedObject = this.props.cpModel.jGISModel?.sharedModel.getObject(old.selectedObject);
        if (selectedObject) {
          const selectedObjectData = selectedObject.parameters;
          return {
            ...old,
            selectedObjectData
          };
        } else {
          return old;
        }
      } else {
        return old;
      }
    });
  };

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>
  ): void => {
    const remoteUser = this.props.cpModel.jGISModel?.localState?.remoteUser;
    let newState: IJupyterGISClientState | undefined;
    if (remoteUser) {
      newState = clients.get(remoteUser);

      const id = newState?.selectedPropField?.id;
      const value = newState?.selectedPropField?.value;
      const parentType = newState?.selectedPropField?.parentType;
      if (parentType === 'panel') {
        this._lastSelectedPropFieldId = focusInputField(
          `${this.state.filePath}::panel`,
          id,
          value,
          newState?.user?.color,
          this._lastSelectedPropFieldId
        );
      }
    } else {
      if (this._lastSelectedPropFieldId) {
        removeStyleFromProperty(
          `${this.state.filePath}::panel`,
          this._lastSelectedPropFieldId,
          ['border-color', 'box-shadow']
        );

        this._lastSelectedPropFieldId = undefined;
      }
    }
  };

  render(): React.ReactNode {
    return this.state.schema && this.state.selectedObjectData ? (
      <ObjectPropertiesForm
        parentType="panel"
        filePath={`${this.state.filePath}::panel`}
        schema={this.state.schema}
        sourceData={this.state.selectedObjectData}
        syncData={(properties: { [key: string]: any }) => {
          this.syncObjectProperties(this.state.selectedObject, properties);
        }}
        syncSelectedField={this.syncSelectedField}
      />
    ) : (
      <div></div>
    );
  }

  private _lastSelectedPropFieldId?: string;
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
