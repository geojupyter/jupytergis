import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';

import { BaseForm, IBaseFormProps } from './baseform';
import { FileSelectorWidget } from './fileselectorwidget';
import { getMimeType } from '../../tools';

/**
 * The form to modify a GeoTiff source.
 */
export class GeoTiffSourcePropertiesForm extends BaseForm {
  private _isSubmitted: boolean;

  constructor(props: IBaseFormProps) {
    super(props);

    this._isSubmitted = false;
    this._validateUrls(props.sourceData?.urls ?? []);
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

    // Customize the widget for urls
    if (schema.properties && schema.properties.urls) {
      const docManager =
        this.props.formChangedSignal?.sender.props.formSchemaRegistry.getDocManager();

      uiSchema.urls = {
        ...uiSchema.urls,
        items: {
          ...uiSchema.urls.items,
          url: {
            'ui:widget': FileSelectorWidget,
            'ui:options': {
              docManager,
              formOptions: this.props
            }
          }
        }
      };
    }

    // This is not user-editable
    delete schema.properties.valid;
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);
    if (e.formData?.urls) {
      this._validateUrls(e.formData.urls);
    }
  }

  protected onFormBlur(id: string, value: any) {
    // Is there a better way to spot the url text entry?
    if (!id.endsWith('_urls')) {
      return;
    }
    this._validateUrls(value);
  }

  protected async onFormSubmit(e: ISubmitEvent<any>) {
    this._isSubmitted = true;

    // validate urls.url only when submitting for better performance
    const { valid, errors } = await this._validateUrls(e.formData.urls);
    if (!valid) {
      if (errors.length > 0) {
        showErrorMessage('Invalid URLs', errors[0]);
      }
      return;
    }
    super.onFormSubmit(e);
  }

  /**
   * Validate the URLs, ensuring that there is at least one object with required fields.
   *
   * @param urls - the URLs array to validate.
   */
  private async _validateUrls(urls: Array<IDict>) {
    const extraErrors: IDict = this.state.extraErrors;
    const errors: string[] = [];
    let valid = true;

    if (urls && urls.length > 0) {
      for (let i = 0; i < urls.length; i++) {
        const { url, min, max } = urls[i];
        if (this._isSubmitted) {
          const mimeType = getMimeType(url);
          if (!mimeType || !mimeType.startsWith('image/tiff')) {
            valid = false;
            errors.push(
              `"${url}" is not a valid ${this.props.sourceType} file.`
            );
          }
        } else {
          if (!url || typeof url !== 'string' || url.trim() === '') {
            valid = false;
            errors.push(
              `URL at index ${i} is required and must be a valid string.`
            );
          }

          if (min === undefined || typeof min !== 'number') {
            errors.push(
              `Min value at index ${i} is required and must be a number.`
            );
            valid = false;
          }

          if (max === undefined || typeof max !== 'number') {
            errors.push(
              `Max value at index ${i} is required and must be a number.`
            );
            valid = false;
          }

          if (
            typeof min === 'number' &&
            typeof max === 'number' &&
            max <= min
          ) {
            errors.push(`Max value at index ${i} must be greater than Min.`);
            valid = false;
          }
        }
      }
    } else {
      errors.push('At least one valid URL with min/max values is required.');
      valid = false;
    }

    if (!valid) {
      this.setState(old => ({
        ...old,
        extraErrors: { ...extraErrors, urls: { __errors: errors } }
      }));
    } else {
      this.setState(old => ({
        ...old,
        extraErrors: { ...extraErrors, urls: { __errors: [] } }
      }));
    }

    if (this.props.formErrorSignal) {
      this.props.formErrorSignal.emit(!valid);
    }
    return { valid, errors };
  }
}
