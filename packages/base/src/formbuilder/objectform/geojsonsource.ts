import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ISubmitEvent } from '@rjsf/core';
import { Ajv, ValidateFunction } from 'ajv';
import * as geojson from '@jupytergis/schema/src/schema/geojson.json';

import { BaseForm, IBaseFormProps } from './baseform';
import { loadFile } from '../../tools';

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
    const extraErrors: IDict = this.state.extraErrors;

    let error = '';
    let valid = false;
    if (path) {
      try {
        this.props.model.getContentsManager();
        const geoJSONData = await loadFile({
          filepath: path,
          type: 'GeoJSONSource',
          contentsManager: this.props.model.getContentsManager(),
          filePath: this.props.model.getFilePath()
        });
        valid = this._validate(geoJSONData);
        if (!valid) {
          error = `"${path}" is not a valid GeoJSON file`;
        }
      } catch (e) {
        error = `"${path}" is not a valid GeoJSON file: ${e}`;
      }
    } else {
      error = 'Path is required';
    }

    if (!valid) {
      extraErrors.path = {
        __errors: [error]
      };
      this._validate.errors?.reverse().forEach(error => {
        extraErrors.path.__errors.push(error.message);
      });

      this.setState(old => ({ ...old, extraErrors }));
    } else {
      this.setState(old => ({
        ...old,
        extraErrors: { ...extraErrors, path: { __errors: [] } }
      }));
    }

    if (this.props.formErrorSignal) {
      this.props.formErrorSignal.emit(!valid);
    }
  }

  private _validate: ValidateFunction;
}
