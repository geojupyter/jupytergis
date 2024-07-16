import { IDict, SourceType } from '@jupytergis/schema';
import { BaseForm, IBaseFormProps } from './baseform';

export interface ILayerProps extends IBaseFormProps {
  sourceType: SourceType;
}

export class LayerPropertiesForm extends BaseForm {
  props: ILayerProps;

  constructor(props: ILayerProps) {
    super(props);
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ): void {
    super.processSchema(data, schema, uiSchema);

    if (!schema.properties.source) {
      return;
    }

    // Replace the source text box by a dropdown menu
    const availableSources = this.props.model.getSourcesByType(
      this.props.sourceType
    );

    schema.properties.source.enumNames = Object.values(availableSources);
    schema.properties.source.enum = Object.keys(availableSources);
  }
}
