import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import { deepCopy } from '@/src/tools';
import { getLayerTypeForm, getSourceTypeForm } from './formselectors';
import { LayerPropertiesForm } from './objectform/layer';
import { SourcePropertiesForm } from './objectform/source';

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
  model: IJupyterGISModel;
}

/**
 * Form for editing a source, a layer or both at the same time
 */
export class EditForm extends React.Component<IEditFormProps, any> {
  async syncObjectProperties(
    id: string | undefined,
    properties: { [key: string]: any },
  ) {
    if (!id) {
      return;
    }

    this.props.model.sharedModel.updateObjectParameters(id, properties);
  }

  render() {
    let layerSchema: IDict | undefined = undefined;
    let LayerForm: typeof LayerPropertiesForm | undefined = undefined;
    let layerData: IDict | undefined = undefined;
    let layer: IJGISLayer | undefined = undefined;

    if (this.props.layer) {
      layer = this.props.model.getLayer(this.props.layer);
      if (!layer) {
        return;
      }

      LayerForm = getLayerTypeForm(layer?.type || 'RasterLayer');
      layerData = deepCopy(layer?.parameters || {});
      layerSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(layer.type),
      );

      if (!layerSchema) {
        console.error(`Cannot find schema for ${layer.type}`);
        return;
      }
    }

    let sourceSchema: IDict | undefined = undefined;
    let SourceForm: typeof SourcePropertiesForm | undefined = undefined;
    let sourceData: IDict | undefined = undefined;
    let source: IJGISSource | undefined = undefined;
    if (this.props.source) {
      source = this.props.model.getSource(this.props.source);
      if (!source) {
        return;
      }

      SourceForm = getSourceTypeForm(source?.type || 'RasterSource');
      sourceData = deepCopy(source?.parameters || {});
      sourceSchema = deepCopy(
        this.props.formSchemaRegistry.getSchemas().get(source.type),
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
              key={`${this.props.layer}-${source?.type}`}
              formContext="update"
              sourceType={source?.type || 'RasterSource'}
              model={this.props.model}
              filePath={this.props.model.filePath}
              schema={layerSchema}
              sourceData={layerData}
              syncData={(properties: { [key: string]: any }) => {
                this.syncObjectProperties(this.props.layer, properties);
              }}
              formSchemaRegistry={this.props.formSchemaRegistry}
            />
          </div>
        )}
        {this.props.source && SourceForm && (
          <div>
            <h3 style={{ paddingLeft: '5px' }}>Source Properties</h3>
            <SourceForm
              key={`${this.props.source}-${layer?.type}`}
              formContext="update"
              model={this.props.model}
              filePath={this.props.model.filePath}
              schema={sourceSchema}
              sourceData={sourceData}
              syncData={(properties: { [key: string]: any }) => {
                this.syncObjectProperties(this.props.source, properties);
              }}
              formChangedSignal={this.sourceFormChangedSignal}
              sourceType={source?.type || 'RasterSource'}
            />
          </div>
        )}
      </div>
    );
  }
  private sourceFormChangedSignal: Signal<React.Component<any>, IDict<any>> =
    new Signal(this);
}
