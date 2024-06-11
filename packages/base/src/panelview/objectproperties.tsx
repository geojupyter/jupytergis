import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISModel,
  IJGISLayerDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { ReactWidget, showErrorMessage } from '@jupyterlab/apputils';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import * as React from 'react';
import { v4 as uuid } from 'uuid';

import {
  focusInputField,
  itemFromName,
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
  jGISObject?: IJGISModel;
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
      jGISObject: this.props.cpModel.jGISModel?.getLayers(),
      clientId: null,
      id: uuid()
    };
    this._formSchema = props.formSchemaRegistry.getSchemas();

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
          jGISObject: this.props.cpModel.jGISModel?.getLayers(),
          clientId: changed.context.model.getClientId()
        }));
      } else {
        this.setState({
          jGISOption: undefined,
          filePath: undefined,
          jGISObject: undefined,
          selectedObjectData: undefined,
          selectedObject: undefined,
          schema: undefined
        });
      }
    });
  }

  async syncObjectProperties(
    objectName: string | undefined,
    properties: { [key: string]: any }
  ) {
    if (!this.state.jGISObject || !objectName) {
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

    // getContent already returns a deep copy of the content, we can change it safely here
    const updatedContent = model.getContent();
    for (const object of updatedContent.objects) {
      if (object.name === objectName) {
        object.parameters = {
          ...object.parameters,
          ...properties
        };
      }
    }

    const obj = model.sharedModel.getObjectByName(objectName);
    if (obj) {
      model.sharedModel.updateObjectByName(objectName, 'parameters', {
        ...obj['parameters'],
        ...properties
      });
    }
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
        const jGISObject = this.props.cpModel.jGISModel?.getLayers();
        if (jGISObject) {
          const selectedObj = itemFromName(old.selectedObject, jGISObject);
          if (!selectedObj) {
            return old;
          }
          const selectedObjectData = selectedObj['parameters'];
          return {
            ...old,
            jGISObject: jGISObject,
            selectedObjectData
          };
        } else {
          return old;
        }
      } else {
        return {
          ...old,
          jGISObject: this.props.cpModel.jGISModel?.getLayers()
        };
      }
    });
  };

  private _onClientSharedStateChanged = (
    sender: IJupyterGISModel,
    clients: Map<number, IJupyterGISClientState>
  ): void => {
    const remoteUser = this.props.cpModel.jGISModel?.localState?.remoteUser;
    const clientId = this.state.clientId;
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
      const localState = clientId ? clients.get(clientId) : null;
      if (this._lastSelectedPropFieldId) {
        removeStyleFromProperty(
          `${this.state.filePath}::panel`,
          this._lastSelectedPropFieldId,
          ['border-color', 'box-shadow']
        );

        this._lastSelectedPropFieldId = undefined;
      }
      if (
        localState &&
        localState.selected?.emitter &&
        localState.selected.emitter !== this.state.id &&
        localState.selected?.value
      ) {
        newState = localState;
      }
    }
    if (newState) {
      const selection = newState.selected.value;
      const selectedObjectNames = Object.keys(selection || {});
      // Only show object properties if ONE object is selected and it's a shape
      if (selection === undefined || selectedObjectNames.length !== 1) {
        this.setState(old => ({
          ...old,
          schema: undefined,
          selectedObject: '',
          selectedObjectData: undefined
        }));
        return;
      }

      let selectedObject = selectedObjectNames[0];
      if (
        selection[selectedObject] &&
        selection[selectedObject].type !== 'shape'
      ) {
        selectedObject = selection[selectedObject].parent as string;
      }

      if (selectedObject !== this.state.selectedObject) {
        const objectData = this.props.cpModel.jGISModel?.getLayers();
        if (objectData) {
          let schema;
          const selectedObj = itemFromName(selectedObject, objectData);
          if (!selectedObj) {
            return;
          }

          if (selectedObj.shape) {
            schema = this._formSchema.get(selectedObj.shape);
          }
          const selectedObjectData = selectedObj['parameters'];
          this.setState(old => ({
            ...old,
            selectedObjectData,
            selectedObject,
            schema
          }));
        }
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
  private _formSchema: Map<string, IDict>;
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
