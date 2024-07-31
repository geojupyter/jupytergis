import { IDict } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';

import { CreationForm, ICreationFormProps } from '../formbuilder';
import { Signal } from '@lumino/signaling';
import { PromiseDelegate } from '@lumino/coreutils';

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
  formChangedSignalPromise?: PromiseDelegate<Signal<Dialog<any>, boolean>>;
}

export interface ICreationFormDialogOptions extends ICreationFormProps {
  title: string;
}

export const CreationFormWrapper = (props: ICreationFormWrapperProps) => {
  const [ready, setReady] = React.useState<boolean>(false);

  const okSignal = React.useRef<Signal<Dialog<any>, number>>();
  const formChangedSignal = React.useRef<Signal<Dialog<any>, boolean>>();

  Promise.all([
    props.okSignalPromise.promise,
    props.formChangedSignalPromise?.promise
  ]).then(([ok, formChanged]) => {
    okSignal.current = ok;
    formChangedSignal.current = formChanged;
    setReady(true);
  });

  return (
    ready && (
      <CreationForm
        context={props.context}
        formSchemaRegistry={props.formSchemaRegistry}
        createLayer={props.createLayer}
        createSource={props.createSource}
        layerType={props.layerType}
        sourceType={props.sourceType}
        sourceData={props.sourceData}
        layerData={props.layerData}
        ok={okSignal.current}
        cancel={props.cancel}
        formChangedSignal={formChangedSignal.current}
      />
    )
  );
};

/**
 * Form for creating a source, a layer or both at the same time
 */
export class CreationFormDialog extends Dialog<IDict> {
  constructor(options: ICreationFormDialogOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, number>
    >();
    const formChangedSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, boolean>
    >();

    const body = (
      <div style={{ overflow: 'auto' }}>
        <CreationFormWrapper
          context={options.context}
          formSchemaRegistry={options.formSchemaRegistry}
          createLayer={options.createLayer}
          createSource={options.createSource}
          layerType={options.layerType}
          sourceType={options.sourceType}
          sourceData={options.sourceData}
          layerData={options.layerData}
          okSignalPromise={okSignalPromise}
          cancel={cancelCallback}
          formChangedSignalPromise={formChangedSignalPromise}
        />
      </div>
    );

    super({
      title: options.title,
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    });

    this.okSignal = new Signal(this);
    const formChangedSignal = new Signal<Dialog<any>, boolean>(this);

    /**
     * Disable the OK button if the form is invalid.
     */
    formChangedSignal.connect((_, extraErrors) => {
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
    formChangedSignalPromise.resolve(formChangedSignal);

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
