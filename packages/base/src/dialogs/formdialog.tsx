import { IDict } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';

import { CreationForm, ICreationFormProps } from '../formbuilder';
import { Signal } from '@lumino/signaling';
import { PromiseDelegate } from '@lumino/coreutils';

export interface ICreationFormWrapperProps extends ICreationFormProps {
  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
}

export interface ICreationFormDialogOptions extends ICreationFormProps {
  title: string;
}

export const CreationFormWrapper = (props: ICreationFormWrapperProps) => {
  const [ok, setOk] = React.useState<Signal<Dialog<any>, number> | undefined>(
    undefined
  );

  props.okSignalPromise.promise.then(value => {
    setOk(value);
  });

  return (
    ok && (
      <CreationForm
        context={props.context}
        formSchemaRegistry={props.formSchemaRegistry}
        createLayer={props.createLayer}
        createSource={props.createSource}
        layerType={props.layerType}
        sourceType={props.sourceType}
        sourceData={props.sourceData}
        layerData={props.layerData}
        ok={ok}
        cancel={props.cancel}
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
        />
      </div>
    );

    super({
      title: options.title,
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    });

    // Disable ok button by default. It will be enabled automatically once the form is valid.
    this.node
      .getElementsByClassName('jp-mod-accept')[0]
      .setAttribute('disabled', '');

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);

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
