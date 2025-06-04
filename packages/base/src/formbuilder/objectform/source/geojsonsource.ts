import { IDict } from '@jupytergis/schema';
import * as geojson from '@jupytergis/schema/src/schema/geojson.json';
import { Ajv, ValidateFunction } from 'ajv';

import { loadFile } from '@/src/tools';
import { PathBasedSourcePropertiesForm } from './pathbasedsource';
import { ISourceFormProps } from './sourceform';

/**
 * The form to modify a GeoJSON source.
 */
export class GeoJSONSourcePropertiesForm extends PathBasedSourcePropertiesForm {
  private _validate: ValidateFunction;

  constructor(props: ISourceFormProps) {
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
  }

  /**
   * Validate the path, to avoid invalid path or invalid GeoJSON.
   *
   * @param path - the path to validate.
   */
  protected async _validatePath(path: string) {
    const extraErrors: IDict = this.state.extraErrors;

    let error = '';
    let valid = false;
    if (path) {
      try {
        const geoJSONData = await loadFile({
          filepath: path,
          type: this.props.sourceType,
          model: this.props.model
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
}
