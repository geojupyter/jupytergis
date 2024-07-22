import { Ajv, ValidateFunction } from 'ajv';
import * as geojson from 'geojson-schema/GeoJSON.json';

import { BaseForm, IBaseFormProps } from './baseform';
import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';

/**
 * The form to modify a GeoJSON source.
 */
export class GeoJSONSourcePropertiesForm extends BaseForm {
  constructor(props: IBaseFormProps) {
    super(props);
    const ajv = new Ajv();
    this._validate = ajv.compile(geojson);
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    super.processSchema(data, schema, uiSchema);
    if (!schema.properties || !data) {
      return;
    }

    // This is not user-editable
    delete schema.properties.valid;

    if (data.path !== '') {
      this.removeFormEntry('data', data, schema, uiSchema);
    }
  }

  protected onFormBlur(id: string, value: any) {
    // Is there a better way to spot the path text entry?
    if (!id.endsWith('_path')) {
      return;
    }

    this._validatePath(value);
  }

  protected syncData(properties: IDict<any> | undefined) {
    if (this.state.extraErrors?.path?.__errors?.length >= 1) {
      showErrorMessage(
        'Invalid JSON file',
        this.state.extraErrors.path.__errors[0]
      );

      return;
    }

    super.syncData(properties);
  }

  /**
   * Validate the path, to avoid invalid path or invalid GeoJSON.
   *
   * @param path - the path to validate.
   */
  private async _validatePath(path: string) {
    const extraErrors: IDict = {
      path: {
        __errors: []
      }
    };

    this.props.model
      .readGeoJSON(path)
      .then(async geoJSONData => {
        const valid = this._validate(geoJSONData);
        if (!valid) {
          extraErrors.path.__errors = [`"${path}" is not a valid GeoJSON file`];
          this._validate.errors?.reverse().forEach(error => {
            extraErrors.path.__errors.push(error.message);
          });
        }
        this.setState({ extraErrors });
      })
      .catch(e => {
        extraErrors.path.__errors = [`Cannot read "${path}"`];
        this.setState({ extraErrors });
      });
  }

  private _validate: ValidateFunction;
}
