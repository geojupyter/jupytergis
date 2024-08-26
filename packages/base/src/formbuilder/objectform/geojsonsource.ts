import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ISubmitEvent } from '@rjsf/core';
import { Ajv, ValidateFunction } from 'ajv';
import * as geojson from 'geojson-schema/GeoJSON.json';

import { BaseForm, IBaseFormProps } from './baseform';

/**
 * The form to modify a GeoJSON source.
 */
export class GeoJSONSourcePropertiesForm extends BaseForm {
  constructor(props: IBaseFormProps) {
    super(props);
    const ajv = new Ajv();
    this._validate = ajv.compile(geojson);
    this._validatePath(props.sourceData?.path ?? '');
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict
  ) {
    if (data?.path !== '') {
      this.removeFormEntry('data', data, schema, uiSchema);
    }

    super.processSchema(data, schema, uiSchema);
    if (!schema.properties || !data) {
      return;
    }

    // This is not user-editable
    delete schema.properties.valid;
  }

  protected onFormBlur(id: string, value: any) {
    // Is there a better way to spot the path text entry?
    if (!id.endsWith('_path')) {
      return;
    }

    this._validatePath(value);
  }

  protected onFormSubmit(e: ISubmitEvent<any>) {
    if (this.state.extraErrors?.path?.__errors?.length >= 1) {
      showErrorMessage(
        'Invalid JSON file',
        this.state.extraErrors.path.__errors[0]
      );
      return;
    }
    super.onFormSubmit(e);
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
        } else {
          delete extraErrors.path;
        }
        this.setState({ extraErrors });
        if (this.props.formErrorSignal) {
          this.props.formErrorSignal.emit(!valid);
        }
      })
      .catch(e => {
        extraErrors.path.__errors = [`Cannot read "${path}"`];
        this.setState({ extraErrors });
        if (this.props.formErrorSignal) {
          this.props.formErrorSignal.emit(true);
        }
      });
  }

  private _validate: ValidateFunction;
}
