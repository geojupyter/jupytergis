import { IDict } from '@jupytergis/schema';
import { BaseForm } from './baseform';

export class TileSourcePropertiesForm extends BaseForm {
  private _urlParameters: string[] = [];

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);

    if (!schema.properties || !data) {
      return;
    }

    // Grep all url-parameters from the url
    const regex = /\{([^}]+)\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(data.url)) !== null) {
      if (['max_zoom', 'min_zoom', 'x', 'y', 'z'].includes(match[1])) {
        continue;
      }
      matches.push(match[1]);
    }

    this._urlParameters = matches;

    if (matches.length === 0) {
      this.removeFormEntry('urlParameters', data, schema, uiSchema);
      return;
    }

    // Dynamically inject url parameters schema based of the url
    const propertiesSchema: {[name: string]: any} = {};
    schema.properties.urlParameters = {
      type: 'object',
      required: this._urlParameters,
      properties: propertiesSchema
    };

    for (const parameterName of this._urlParameters) {
      switch (parameterName) {
        // Special case for "time" where a date picker widget is nicer
        case 'time':
          propertiesSchema[parameterName] = {
            type: 'string',
            format: 'date'
          };
          break;
        default:
          propertiesSchema[parameterName] = {
            type: 'string'
          };
          break;
      }
    }
  }

  protected onFormBlur(id: string, value: any) {
    super.onFormBlur(id, value);

    // Is there a better way to spot the url text entry?
    if (!id.endsWith('_url')) {
      return;
    }

    // Force a rerender on url change, as it probably changes the schema
    this.forceUpdate();
  }
}
