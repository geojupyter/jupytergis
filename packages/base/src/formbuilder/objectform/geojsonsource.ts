import { Ajv, ValidateFunction } from 'ajv';
import * as geojson from 'geojson-schema/GeoJSON.json';

import { BaseForm, IBaseFormProps } from './baseform';
import { IDict } from '@jupytergis/schema';
import { ISubmitEvent } from '@rjsf/core';

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

  protected onFormSubmit = (e: ISubmitEvent<any>) => {
    if (this.state.extraErrors?.path?.__errors?.includes('Invalid path')) {
      return;
    }
    super.onFormSubmit(e);
  };

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
          extraErrors.path.__errors = [
            "GeoJSON data invalid (you can still validate but the source can't be used)"
          ];
          this._validate.errors?.reverse().forEach(error => {
            extraErrors.path.__errors.push(error.message);
          });
        }
        this.setState({ extraErrors });
      })
      .catch(e => {
        extraErrors.path.__errors = ['Invalid path'];
        this.setState({ extraErrors });
      });
  }

  private _validate: ValidateFunction;
}
