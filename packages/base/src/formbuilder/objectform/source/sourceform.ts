import { IDict, SourceType } from '@jupytergis/schema';
import { Signal } from '@lumino/signaling';
import { IChangeEvent } from '@rjsf/core';

import {
  BaseForm,
  IBaseFormProps
} from '@/src/formbuilder/objectform/baseform';

export interface ISourceFormProps extends IBaseFormProps {
  /**
   * The source type for this form.
   */
  sourceType: SourceType;

  /**
   * The signal emitted when the source form has changed.
   */
  sourceFormChangedSignal?: Signal<any, IDict<any>>;

  /**
   * Configuration options for the dialog, including settings for source data and other parameters.
   */
  dialogOptions?: any;
}

export class SourcePropertiesForm extends BaseForm {
  props: ISourceFormProps;
  protected sourceFormChangedSignal: Signal<any, IDict<any>> | undefined;

  constructor(props: ISourceFormProps) {
    super(props);
    this.sourceFormChangedSignal = props.sourceFormChangedSignal;
  }

  protected onFormChange(e: IChangeEvent): void {
    super.onFormChange(e);
    if (this.props.dialogOptions) {
      this.props.dialogOptions.sourceData = { ...e.formData };
    }
  }
}
