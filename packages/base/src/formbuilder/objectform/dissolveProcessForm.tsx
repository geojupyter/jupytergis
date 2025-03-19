import { BaseForm, IBaseFormProps } from './baseform'; // Import BaseForm
import { IDict, IJupyterGISModel, IGeoJSONSource } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';
import { loadFile } from '../../tools';

interface IDissolveFormOptions extends IBaseFormProps {
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  model: IJupyterGISModel;
}

export class DissolveForm extends BaseForm {
  private model: IJupyterGISModel;
  private schema: IDict;
  private features: string[] = [];

  constructor(options: IDissolveFormOptions) {
    super(options);
    this.model = options.model;
    this.schema = options.schema;

    console.log('DissolveForm initialized with options:', options);
    this.fetchFieldNames(options.sourceData.inputLayer);
  }

  private async fetchFieldNames(layerId: string) {
    const layer = this.model.getLayer(layerId);
    if (!layer?.parameters?.source) {return;}

    const source = this.model.getSource(layer.parameters.source);
    if (!source || source.type !== 'GeoJSONSource') {return;}

    const sourceData = source.parameters as IGeoJSONSource;
    if (!sourceData?.path) {return;}

    try {
      console.log('Loading GeoJSON:', sourceData.path);
      const jsonData = await loadFile({
        filepath: sourceData.path,
        type: 'GeoJSONSource',
        model: this.model
      });

      if (!jsonData?.features?.length) {return;}

      this.features = Object.keys(jsonData.features[0].properties);
      this.updateSchema();
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  }

  public handleFormChange(e: IChangeEvent) {
    if (e.formData.inputLayer) {
      this.fetchFieldNames(e.formData.inputLayer);
    }
  }

  private updateSchema() {
    if (this.schema.properties?.dissolveField) {
      this.schema.properties.dissolveField.enum = this.features;
    }
  }
}
