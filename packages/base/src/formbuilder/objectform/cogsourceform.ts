import { IDict } from '@jupytergis/schema';
import { BaseForm } from './baseform';
import { deepCopy } from '../../tools';
import { cogInfo } from '../../cog';

export class COGSourcePropertiesForm extends BaseForm {
  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);

    // Those properties are readonly even when creating the source (not user-editable)
    // though they are still shown in the form for information
    schema.properties.bands && (schema.properties.bands.readOnly = true);
    schema.properties.bounds && (schema.properties.bounds.readOnly = true);
    schema.properties.maxZoom && (schema.properties.maxZoom.readOnly = true);
    schema.properties.minZoom && (schema.properties.minZoom.readOnly = true);
  }

  protected async onFormBlur(id: string, value: any) {
    super.onFormBlur(id, value);

    // Is there a better way to spot the url text entry?
    if (!id.endsWith('_url')) {
      return;
    }

    const formData = deepCopy(this.currentFormData);

    const url = formData?.url;

    if (!url) {
      return;
    }

    // TODO Handle request failure and report to user properly
    const info = await cogInfo({ url });

    info.maxzoom && (formData.maxZoom = info.maxzoom);
    info.minzoom && (formData.minZoom = info.minzoom);
    info.bounds && (formData.bounds = deepCopy(info.bounds));
    info.band_metadata &&
      (formData.bands = info.band_metadata.map((band: string[]) => band[0]));

    this.setState({ ...this.state, data: formData });

    this.props.onChange && this.props.onChange(formData);
  }
}
