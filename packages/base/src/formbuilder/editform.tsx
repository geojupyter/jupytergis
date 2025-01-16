import { DocumentRegistry } from '@jupyterlab/docregistry';

import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISSource,
  IJupyterGISModel
} from '@jupytergis/schema';

import { deepCopy } from '../tools';

import * as React from 'react';
import { getLayerTypeForm, getSourceTypeForm } from './formselectors';
import { LayerPropertiesForm } from './objectform/layerform';
import { BaseForm } from './objectform/baseform';
import { Signal } from '@lumino/signaling';

export interface IEditFormProps {
  /**
   * The layer to edit
   */
  layer: string | undefined;

  /**
   * The source to edit
   */
  source: string | undefined;

  formSchemaRegistry: IJGISFormSchemaRegistry;
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

/**
 * Form for editing a source, a layer or both at the same time
 */
export class EditForm extends React.Component<IEditFormProps, any> {
  async syncObjectProperties(
    id: string | undefined,
    properties: { [key: string]: any }
  ) {
    if (!id) {
      return;
    }

    this.props.context.model.sharedModel.updateObjectParameters(id, properties);
  }

  render() {
    let layerSchema: IDict | undefined = undefined;
    let LayerForm: typeof LayerPropertiesForm | undefined = undefined;
    let layerData: IDict | undefined = undefined;
    if (this.props.layer) {
      const layer = this.props.context.model.getLayer(this.props.layer);
      if (!layer) {
        return;
      }

      LayerForm = getLayerTypeForm(layer?.type || 'RasterLayer');
      layerData = deepCopy(layer?.parameters || {});
      layerSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(layer.type)
      );

      if (!layerSchema) {
        console.error(`Cannot find schema for ${layer.type}`);
        return;
      }
    }

    let sourceSchema: IDict | undefined = undefined;
    let SourceForm: typeof BaseForm | undefined = undefined;
    let sourceData: IDict | undefined = undefined;
    let source: IJGISSource | undefined = undefined;
    if (this.props.source) {
      source = this.props.context.model.getSource(this.props.source);
      if (!source) {
        return;
      }

      SourceForm = getSourceTypeForm(source?.type || 'RasterSource');
      sourceData = deepCopy(source?.parameters || {});
      sourceSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(source.type)
      );

      if (!sourceSchema) {
        console.error(`Cannot find schema for ${source.type}`);
        return;
      }
    }

    return (
      <div>
        {this.props.layer && LayerForm && (
          <div>
            <h3 style={{ paddingLeft: '5px' }}>Layer Properties</h3>
            <LayerForm
              formContext="create"
              sourceType={source?.type || 'RasterSource'}
              model={this.props.context.model}
              filePath={`${this.props.context.path}::panel`}
              schema={layerSchema}
              sourceData={layerData}
              syncData={(properties: { [key: string]: any }) => {
                this.syncObjectProperties(this.props.layer, properties);
              }}
            />
          </div>
        )}
        {this.props.source && SourceForm && (
          <div>
            <h3 style={{ paddingLeft: '5px' }}>Source Properties</h3>
            <SourceForm
              formContext="create"
              model={this.props.context.model}
              filePath={`${this.props.context.path}::panel`}
              schema={sourceSchema}
              sourceData={sourceData}
              syncData={(properties: { [key: string]: any }) => {
                this.syncObjectProperties(this.props.source, properties);
              }}
              formChangedSignal={this.sourceFormChangedSignal}
            />
          </div>
        )}
      </div>
    );
  }
  private sourceFormChangedSignal: Signal<React.Component<any>, IDict<any>> =
    new Signal(this);
}
