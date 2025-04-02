import { BaseForm, IBaseFormProps, IBaseFormStates } from '../baseform'; // Ensure BaseForm imports states
import { IDict, IJupyterGISModel, IGeoJSONSource } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';
import { loadFile } from '../../../tools';

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
  private features: string[] = [];

  constructor(options: IDissolveFormOptions) {
    super(options);
    this.model = options.model;

    // Ensure initial state matches IBaseFormStates
    this.state = {
      schema: options.schema ?? {} // Ensure schema is never undefined
    };

    this.onFormChange = this.handleFormChange.bind(this);

    this.fetchFieldNames(options.sourceData.inputLayer);
  }

  private async fetchFieldNames(layerId: string) {
    const layer = this.model.getLayer(layerId);
    if (!layer?.parameters?.source) {
      return;
    }

    const source = this.model.getSource(layer.parameters.source);
    if (!source || source.type !== 'GeoJSONSource') {
      return;
    }

    const sourceData = source.parameters as IGeoJSONSource;
    if (!sourceData?.path) {
      return;
    }

    try {
      const jsonData = await loadFile({
        filepath: sourceData.path,
        type: 'GeoJSONSource',
        model: this.model
      });

      if (!jsonData?.features?.length) {
        return;
      }

      this.features = Object.keys(jsonData.features[0].properties);
      this.updateSchema();
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  }

  public handleFormChange(e: IChangeEvent) {
    super.onFormChange(e);

    if (e.formData.inputLayer) {
      this.fetchFieldNames(e.formData.inputLayer);
    }
  }

  private updateSchema() {
    this.setState(
      (prevState: IBaseFormStates) => ({
        schema: {
          ...prevState.schema,
          properties: {
            ...prevState.schema?.properties,
            dissolveField: {
              ...prevState.schema?.properties?.dissolveField,
              enum: [...this.features]
            }
          }
        }
      }),
      () => {
        this.forceUpdate();
      }
    );
  }
}
