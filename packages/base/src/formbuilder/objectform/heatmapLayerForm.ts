import { IDict, IGeoJSONSource, IHeatmapLayer } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';
import { loadFile } from '../../tools';
import { ILayerProps, LayerPropertiesForm } from './layerform';

export class HeatmapLayerPropertiesForm extends LayerPropertiesForm {
  protected currentFormData: IHeatmapLayer;
  private features: any = [];
  private currentSourceId: string;

  constructor(props: ILayerProps) {
    super(props);

    this.fetchFeatureNames(this.props.sourceData as IHeatmapLayer);

    if (this.sourceFormChangedSignal) {
      this.sourceFormChangedSignal.connect((sender, sourceData) => {
        if (this.props.sourceType === 'GeoJSONSource') {
          this.fetchFeatureNames(
            this.currentFormData,
            sourceData as IGeoJSONSource
          );
        }
      });
    }
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);

    const source = this.props.model.getSource(e.formData.source);
    if (!source || source.type !== 'GeoJSONSource') {
      return;
    }

    this.fetchFeatureNames(
      this.currentFormData,
      source.parameters as IGeoJSONSource
    );
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    this.removeFormEntry('color', data, schema, uiSchema);
    this.removeFormEntry('symbologyState', data, schema, uiSchema);

    uiSchema['feature'] = { enum: this.features };

    if (!data) {
      return;
    }

    if (this.features.length !== 0) {
      schema.properties.feature.enum = this.features;
    }
  }

  private async fetchFeatureNames(
    data: IHeatmapLayer,
    sourceData?: IGeoJSONSource
  ) {
    console.log('data', data);
    if (data && data.source) {
      this.currentSourceId = data.source;

      if (!sourceData) {
        const currentSource = this.props.model.getSource(data.source);

        if (!currentSource || currentSource.type !== 'GeoJSONSource') {
          this.features = [];
          return;
        }

        sourceData = currentSource.parameters as IGeoJSONSource;
      }
    }

    const source = this.props.model.getSource(data.source);

    if (!source?.parameters?.path) {
      return;
    }

    const jsonData = await loadFile({
      filepath: source.parameters.path,
      type: 'GeoJSONSource',
      model: this.props.model
    });

    const featureProps = jsonData.features[0].properties;

    this.features = Object.keys(featureProps);
    this.forceUpdate();
  }
}
