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
    console.log('props', props);

    // fetch feature names
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
    // props.model.clientStateChanged.connect(() => {
    //   if (!props.model.localState?.selected.value) {
    //     return;
    //   }
    //   const l = this.props.model.getLayer(
    //     Object.keys(props.model.localState.selected.value)[0]
    //   );
    //   const source = this.props.model.getSource(l?.parameters!.source);

    //   if (!source || source.type !== 'GeoJSONSource') {
    //     return;
    //   }

    //   const sourceData = source.parameters as IGeoJSONSource;

    //   this.fetchFeatureNames(this.currentFormData, sourceData);
    // });
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);

    // We only force update if we just updated the source
    // if (this.currentSourceId === e.formData.source) {
    //   return;
    // }

    const source = this.props.model.getSource(e.formData.source);
    if (!source || source.type !== 'GeoJSONSource') {
      return;
    }

    this.fetchFeatureNames(
      this.currentFormData,
      source.parameters as IGeoJSONSource
    );

    // this.forceUpdate();
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    console.log('schema', schema);
    super.processSchema(data, schema, uiSchema);
    console.log('uiSchema', uiSchema);
    uiSchema['features'] = { enum: Object.keys(this.features) };

    if (!data) {
      return;
    }

    console.log('this.features in process', this.features);

    if (this.features.length !== 0) {
      schema.properties.features.enum = Object.keys(this.features);
      console.log('wooooooo');
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
          //   this.forceUpdate();
          return;
        }

        sourceData = currentSource.parameters as IGeoJSONSource;
      }
    }

    const source = this.props.model.getSource(data.source);
    // console.log('source', source);

    if (!source?.parameters?.path) {
      console.log('return');
      return;
    }

    const jsonData = await loadFile({
      filepath: source.parameters.path,
      type: 'GeoJSONSource',
      model: this.props.model
    });
    // console.log('jsonData', jsonData);

    const featureProps = jsonData.features[0].properties;

    const fs: { [key: string]: string } = {};
    for (const feature of Object.keys(featureProps)) {
      fs[feature] = feature;
    }

    console.log('fs', fs);

    this.features = fs;
    // this.features = Object.keys(featureProps);
    console.log('this.features', this.features);
    console.log('this.features array1', Array.from(this.features));

    this.forceUpdate();
  }
}
