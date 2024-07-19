import { IDict } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { LabIcon, errorIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { ErrorObject } from 'ajv';
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

/**
 * The return value of the dialog to add a source.
 */
interface IDialogAddDataSourceValue {
  /**
   * The path of the data file.
   */
  path: string;
  /**
   * Whether to save date in the shared document or not.
   */
  saveDataInShared: boolean;
}

/**
 * The body of the dialog to add a source.
 */
export class DialogAddDataSourceBody
  extends Widget
  implements Dialog.IBodyWidget<IDialogAddDataSourceValue>
{
  constructor() {
    super();
    this.addClass('jp-gis-addDataSourceBody');

    const pathLabel = document.createElement('label');
    const pathLabelText = document.createElement('div');
    pathLabelText.textContent = 'Local path to the data file';
    const pathInput = (this._pathInput = document.createElement('input'));
    pathInput.type = 'text';
    pathInput.placeholder = '/path/to/the/data/file';
    pathLabel.append(pathLabelText, pathInput);

    const saveSharedLabel = document.createElement('label');
    pathLabelText.textContent = 'Local path to the data file';
    const saveSharedLabelInput = (this._saveSharedInput =
      document.createElement('input'));
    saveSharedLabelInput.type = 'checkbox';
    saveSharedLabel.append(saveSharedLabelInput, 'Embed Data in File');

    this.node.append(pathLabel, saveSharedLabel);
  }

  /**
   * Get the values specified by the user
   */
  getValue(): IDialogAddDataSourceValue {
    return {
      path: this._pathInput.value,
      saveDataInShared: this._saveSharedInput.checked
    };
  }

  private _pathInput: HTMLInputElement;
  private _saveSharedInput: HTMLInputElement;
}

namespace DataErrorDialog {
  /**
   * The options for the data error dialog.
   */
  export interface IOptions {
    title: string;
    errors?: ErrorObject[] | null;
    saveDataInShared?: boolean;
  }
}

/**
 * A dialog opened when a data file is invalid.
 */
export class DataErrorDialog extends Dialog<null> {
  constructor(options: DataErrorDialog.IOptions) {
    const title = (
      <div className={'jp-gis-dataErrorHeader'}>
        <LabIcon.resolveReact
          icon={errorIcon}
          height={32}
          width={32}
        ></LabIcon.resolveReact>
        <div>{options.title}</div>
      </div>
    );
    const body = (
      <div className={'jp-gis-dataErrorBody'}>
        <div>It can't be used as it in a layer.</div>
        <details>
          <summary>Errors</summary>
          <pre className={'jp-gis-dataErrorDetails'}>
            {options.errors?.reverse().map(error => (
              <>
                {error.message}
                <br />
              </>
            ))}
          </pre>
        </details>
        {!options.saveDataInShared && (
          <div>Do you want to save it in source and modify it later ?</div>
        )}
      </div>
    );

    const buttons = [Dialog.okButton()];
    if (!options.saveDataInShared) {
      buttons.unshift(Dialog.cancelButton());
    }
    super({
      title,
      body,
      buttons
    });
    this.addClass('jp-gis-dataError');
  }
}
