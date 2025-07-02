import { IDict, SourceType } from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';
import { IChangeEvent } from '@rjsf/core';

import {
  BaseForm,
  IBaseFormProps,
} from '@/src/formbuilder/objectform/baseform';

export interface ILayerProps extends IBaseFormProps {
  /**
   * The source type for the layer
   */
  sourceType: SourceType;

  /**
   * The signal emitted when the attached source form has changed, if it exists
   */
  sourceFormChangedSignal?: Signal<any, IDict<any>>;

  /**
   * Configuration options for the dialog, including settings for layer data, source data,
   * and other form-related parameters.
   */
  dialogOptions?: any;
}

export class LayerPropertiesForm extends BaseForm {
  props: ILayerProps;
  protected sourceFormChangedSignal: Signal<any, IDict<any>> | undefined;

  constructor(props: ILayerProps) {
    super(props);

    this.sourceFormChangedSignal = props.sourceFormChangedSignal;
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict,
  ): void {
    super.processSchema(data, schema, uiSchema);

    if (!schema.properties?.source) {
      return;
    }

    // Replace the source text box by a dropdown menu
    const availableSources = this.props.model.getSourcesByType(
      this.props.sourceType,
    );

    schema.properties.source.enumNames = Object.values(availableSources);
    schema.properties.source.enum = Object.keys(availableSources);
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);
    if (this.props.dialogOptions) {
      this.props.dialogOptions.layerData = { ...e.formData };
    }
  }
}
