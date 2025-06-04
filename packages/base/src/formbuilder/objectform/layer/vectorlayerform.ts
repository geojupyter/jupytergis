import { IDict, IVectorLayer } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';

import { ILayerProps, LayerPropertiesForm } from './layerform';

/**
 * The form to modify a vector layer.
 */
export class VectorLayerPropertiesForm extends LayerPropertiesForm {
  protected currentFormData: IVectorLayer;
  private currentSourceId: string;

  constructor(props: ILayerProps) {
    super(props);
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);

    // We only force update if we just updated the source
    if (this.currentSourceId === e.formData.source) {
      return;
    }

    const source = this.props.model.getSource(e.formData.source);
    if (!source || source.type !== 'VectorTileSource') {
      return;
    }
  }

  protected processSchema(
    data: IVectorLayer | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    this.removeFormEntry('color', data, schema, uiSchema);
    this.removeFormEntry('symbologyState', data, schema, uiSchema);
    super.processSchema(data, schema, uiSchema);

    if (!data) {
      return;
    }
  }
}
