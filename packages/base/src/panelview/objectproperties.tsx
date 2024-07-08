import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISLayerDocChange,
  IJGISSource,
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

import { deepCopy } from '../tools';
import { IControlPanelModel } from '../types';
import { LayerPropertiesForm, RasterSourcePropertiesForm } from './formbuilder';
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
      filePath: this.props.cpModel.filePath,
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
          clientId: changed.context.model.getClientId()
        }));
      } else {
        this.setState({
          jGISOption: undefined,
          filePath: undefined,
          selectedObject: undefined
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

  private _sharedJGISModelChanged = (
    _: IJupyterGISDoc,
    changed: IJGISLayerDocChange
  ): void => {
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
    const model = this.props.cpModel.jGISModel;
    const selectedObject = this.state.selectedObject;

    if (!selectedObject || !model) {
      return <div></div>;
    }

    let selectedObj: IJGISLayer | IJGISSource | undefined;
    // This will be the layer source in case where the selected object is a layer
    let selectedObjSource: IJGISSource | undefined;

    selectedObj = this.props.cpModel.jGISModel?.getLayer(selectedObject);

    if (!selectedObj) {
      selectedObj = this.props.cpModel.jGISModel?.getSource(selectedObject);
    }

    if (selectedObj && selectedObj.parameters?.source) {
      selectedObjSource = this.props.cpModel.jGISModel?.getSource(
        selectedObj!.parameters?.source
      );
    }

    if (!selectedObj) {
      return <div></div>;
    }

    let schema: IDict<any> | undefined;
    let selectedObjectSourceId: string | undefined;
    const selectedObjectData = deepCopy(selectedObj.parameters);
    if (selectedObj.type) {
      schema = deepCopy(this._formSchema.get(selectedObj.type));

      if (selectedObjectData && selectedObjectData.source) {
        selectedObjectSourceId = selectedObjectData.source;
      }
    }

    if (!selectedObjectData) {
      return <div></div>;
    }

    // We selected a source and only show a form for it
    if (!selectedObjSource) {
      return (
        selectedObjSource!.type === 'RasterSource' && (
          <div>
            <h3>Source Properties</h3>
            <RasterSourcePropertiesForm
              model={model}
              filePath={`${this.state.filePath}::panel`}
              schema={schema}
              sourceData={selectedObjectData}
              syncData={(properties: { [key: string]: any }) => {
                this.syncObjectProperties(
                  this.state.selectedObject,
                  properties
                );
              }}
            />
          </div>
        )
      );
    }

    // We selected a layer, we show a form for the layer and one for its source
    const sourceSchema = deepCopy(this._formSchema.get(selectedObjSource.type));
    const selectedObjectSourceData = deepCopy(selectedObjSource.parameters);

    return (
      <div>
        <h3>Layer Properties</h3>
        <LayerPropertiesForm
          sourceType={selectedObjSource.type}
          model={model}
          filePath={`${this.state.filePath}::panel`}
          schema={schema}
          sourceData={selectedObjectData}
          syncData={(properties: { [key: string]: any }) => {
            this.syncObjectProperties(this.state.selectedObject, properties);
          }}
        />
        <h3>Source Properties</h3>
        {selectedObjSource.type === 'RasterSource' && (
          <RasterSourcePropertiesForm
            model={model}
            filePath={`${this.state.filePath}::panel`}
            schema={sourceSchema}
            sourceData={selectedObjectSourceData}
            syncData={(properties: { [key: string]: any }) => {
              this.syncObjectProperties(selectedObjectSourceId, properties);
            }}
          />
        )}
        {/* {selectedObjSource.type === 'GeoJSONSource' && (
          <GeoJSONSourcePropertiesForm

        } */}
      </div>
    );
  }

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
