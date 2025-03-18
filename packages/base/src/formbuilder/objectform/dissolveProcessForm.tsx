import { FormDialog } from '../formdialog';
import { IDict, IJupyterGISModel, IGeoJSONSource } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';
import { loadFile } from '../../tools';
import { IBaseFormProps } from './baseform';

interface IDissolveFormOptions extends IBaseFormProps{
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  model: IJupyterGISModel;
}

export class DissolveFormDialog extends FormDialog {
  private model: IJupyterGISModel;
  private schema: IDict;
  private features: string[] = [];

  constructor(options: IDissolveFormOptions) {
    super(options);
    this.model = options.model;
    this.schema = options.schema;

    console.log('DissolveFormDialog initialized with options:', options);

    this.fetchFieldNames(options.sourceData.inputLayer);
    this.handleFormChange = this.handleFormChange.bind(this);
  }

  /**
   * Fetch field names from the selected layer and update the dropdown.
   */
  private async fetchFieldNames(layerId: string) {
    const layer = this.model.getLayer(layerId);
    console.log('Layer:', layer);

    if (!layer?.parameters?.source) {
      console.error(`⚠️ Layer ${layerId} has no associated source!`);
      return;
    }

    const sourceId = layer.parameters.source;
    console.log('🔍 Extracted sourceId:', sourceId);

    // Fetch the actual source
    const source = this.model.getSource(sourceId);
    if (!source || source.type !== 'GeoJSONSource') {
      console.log('Invalid source:', source);
      this.features = [];
      return;
    }

    const sourceData = source.parameters as IGeoJSONSource;

    if (!sourceData?.path) {
      console.log('No path found in source data:', sourceData);
      this.features = [];
      return;
    }

    try {
      console.log('Loading file from path:', sourceData.path);
      const jsonData = await loadFile({
        filepath: sourceData.path,
        type: 'GeoJSONSource',
        model: this.model
      });

      if (!jsonData?.features?.length) {
        console.log('No features found in GeoJSON.');
        this.features = [];
        return;
      }

      this.features = Object.keys(jsonData.features[0].properties);
      console.log('Extracted features:', this.features);

      this.updateSchema();
    } catch (error) {
      console.error('Error loading GeoJSON file:', error);
    }
  }

  /**
   * Handle form changes and update available fields.
   */
  public handleFormChange(e: IChangeEvent) {
    console.log('Form changed:', e.formData);

    if (e.formData.inputLayer) {
      console.log('New inputLayer detected:', e.formData.inputLayer);
      this.fetchFieldNames(e.formData.inputLayer);
    }
  }

  /**
   * Updates the schema when new field names are fetched.
   */
  private updateSchema() {
    console.log('Updating schema with new field names:', this.features);

    if (this.schema.properties?.dissolveField) {
      this.schema.properties.dissolveField.enum = this.features;
    }

    this.refreshForm();
  }

  /**
   * Refreshes the form.
   */
  private refreshForm() {
    console.log('Refreshing form...');

    if (typeof (this as any).updateFormData === 'function') {
      (this as any).updateFormData();
    } else {
      console.warn('updateFormData method not found on FormDialog. Relaunching the dialog.');
      this.launch(); // Relaunching to update UI
    }
  }
}
