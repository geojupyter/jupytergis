import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';

import { FileSelectorWidget } from '@/src/formbuilder/objectform/fileselectorwidget';
import { loadFile } from '@/src/tools';
import { ISourceFormProps, SourcePropertiesForm } from './sourceform';

/**
 * The form to modify a PathBasedSource source.
 */
export class PathBasedSourcePropertiesForm extends SourcePropertiesForm {
  constructor(props: ISourceFormProps) {
    super(props);

    if (this.props.sourceType !== 'GeoJSONSource') {
      this._validatePath(props.sourceData?.path ?? '');
    }
  }

  protected processSchema(
    data: IDict<any> | undefined,
    schema: IDict,
    uiSchema: IDict,
  ) {
    super.processSchema(data, schema, uiSchema);
    if (!schema.properties || !data) {
      return;
    }

    // Customize the widget for path field
    if (schema.properties && schema.properties.path) {
      const docManager =
        this.props.formChangedSignal?.sender.props.formSchemaRegistry.getDocManager();

      uiSchema.path = {
        'ui:widget': FileSelectorWidget,
        'ui:options': {
          docManager,
          formOptions: this.props,
        },
      };
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

  // we need to use `onFormChange` instead of `onFormBlur` because it's no longer a text field
  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);
    if (e.formData?.path !== undefined) {
      this._validatePath(e.formData.path);
    }
  }

  protected onFormSubmit(e: ISubmitEvent<any>) {
    if (this.state.extraErrors?.path?.__errors?.length >= 1) {
      showErrorMessage('Invalid file', this.state.extraErrors.path.__errors[0]);
      return;
    }
    if (!e.formData.path) {
      e.formData.data = {
        type: 'FeatureCollection',
        features: []
      };
    }
    super.onFormSubmit(e);
  }

  /**
   * Validate the path, to avoid invalid path.
   *
   * @param path - the path to validate.
   */
  protected async _validatePath(path: string) {
    const extraErrors: IDict = this.state.extraErrors;

    let error = '';
    let valid = true;
    if (!path) {
      valid = false;
      error = 'Path is required';
    } else {
      try {
        await loadFile({
          filepath: path,
          type: this.props.sourceType,
          model: this.props.model,
        });
      } catch (e) {
        valid = false;
        error = `"${path}" is not a valid ${this.props.sourceType} file.`;
      }
    }

    if (!valid) {
      extraErrors.path = {
        __errors: [error],
      };

      this.setState(old => ({ ...old, extraErrors }));
    } else {
      this.setState(old => ({
        ...old,
        extraErrors: { ...extraErrors, path: { __errors: [] } },
      }));
    }

    if (this.props.formErrorSignal) {
      this.props.formErrorSignal.emit(!valid);
    }
  }
}
