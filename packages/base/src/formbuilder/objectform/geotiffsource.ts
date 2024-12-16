import { IDict } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IChangeEvent, ISubmitEvent } from '@rjsf/core';

import { BaseForm, IBaseFormProps } from './baseform';

/**
 * The form to modify a GeoTiff source.
 */
export class GeoTiffSourcePropertiesForm extends BaseForm {
  constructor(props: IBaseFormProps) {
    super(props);
    this._validateUrls(props.sourceData?.urls ?? []);
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);
    if (e.formData?.urls) {
      this._validateUrls(e.formData.urls);
    }
  }

  protected onFormSubmit(e: ISubmitEvent<any>) {
    if (this.state.extraErrors?.urls?.__errors?.length >= 1) {
      showErrorMessage('Invalid URLs', this.state.extraErrors.urls.__errors[0]);
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

        if (!url || typeof url !== 'string' || url.trim() === '') {
          errors.push(
            `URL at index ${i} is required and must be a valid string.`
          );
          valid = false;
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

        if (typeof min === 'number' && typeof max === 'number' && max <= min) {
          errors.push(`Max value at index ${i} must be greater than Min.`);
          valid = false;
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
  }
}
