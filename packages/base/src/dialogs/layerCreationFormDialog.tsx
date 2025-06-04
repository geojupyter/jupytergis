import { IDict } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import { CreationForm, ICreationFormProps } from '@/src/formbuilder';

export interface ICreationFormWrapperProps extends ICreationFormProps {
  /**
   * A promise resolving when the dialog is ready.
   * Return a signal emitting when OK button is pressed.
   */
  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  /**
   * A promise resolving when the dialog is ready.
   * Return a signal emitting when the form changed, with a boolean whether there are
   * some extra errors or not.
   */
  formErrorSignalPromise?: PromiseDelegate<Signal<Dialog<any>, boolean>>;
  /**
   * Configuration options for the dialog, including settings for layer data, source data,
   * and other form-related parameters.
   */
  dialogOptions?: any;
}

export interface ICreationFormDialogOptions extends ICreationFormProps {
  title: string;
}

export const CreationFormWrapper = (props: ICreationFormWrapperProps) => {
  const [ready, setReady] = React.useState<boolean>(false);

  const okSignal = React.useRef<Signal<Dialog<any>, number>>();
  const formErrorSignal = React.useRef<Signal<Dialog<any>, boolean>>();

  Promise.all([
    props.okSignalPromise.promise,
    props.formErrorSignalPromise?.promise
  ]).then(([ok, formChanged]) => {
    okSignal.current = ok;
    formErrorSignal.current = formChanged;
    setReady(true);
  });

  return (
    ready && (
      <CreationForm
        model={props.model}
        formSchemaRegistry={props.formSchemaRegistry}
        createLayer={props.createLayer}
        createSource={props.createSource}
        layerType={props.layerType}
        sourceType={props.sourceType}
        sourceData={props.sourceData}
        layerData={props.layerData}
        ok={okSignal.current}
        cancel={props.cancel}
        formErrorSignal={formErrorSignal.current}
        dialogOptions={props.dialogOptions}
      />
    )
  );
};

/**
 * Form for creating a source, a layer or both at the same time
 */
export class LayerCreationFormDialog extends Dialog<IDict> {
  constructor(options: ICreationFormDialogOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, number>
    >();
    const formErrorSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, boolean>
    >();

    const body = (
      <div style={{ overflow: 'auto' }}>
        <CreationFormWrapper
          model={options.model}
          formSchemaRegistry={options.formSchemaRegistry}
          createLayer={options.createLayer}
          createSource={options.createSource}
          layerType={options.layerType}
          sourceType={options.sourceType}
          sourceData={options.sourceData}
          layerData={options.layerData}
          okSignalPromise={okSignalPromise}
          cancel={cancelCallback}
          formErrorSignalPromise={formErrorSignalPromise}
          dialogOptions={options}
        />
      </div>
    );

    super({
      title: options.title,
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    });

    this.okSignal = new Signal(this);
    const formErrorSignal = new Signal<Dialog<any>, boolean>(this);

    /**
     * Disable the OK button if the form is invalid.
     */
    formErrorSignal.connect((_, extraErrors) => {
      const invalid = extraErrors || !!this.node.querySelector(':invalid');
      if (invalid) {
        this.node
          .getElementsByClassName('jp-mod-accept')[0]
          .setAttribute('disabled', '');
      } else {
        this.node
          .getElementsByClassName('jp-mod-accept')[0]
          .removeAttribute('disabled');
      }
    });

    okSignalPromise.resolve(this.okSignal);
    formErrorSignalPromise.resolve(formErrorSignal);

    this.addClass('jGIS-layer-CreationFormDialog');
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(1);
    }
  }

  private okSignal: Signal<Dialog<any>, number>;
}
