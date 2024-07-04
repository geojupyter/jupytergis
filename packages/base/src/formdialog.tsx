import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { LabIcon, errorIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { ErrorObject } from 'ajv';
import * as React from 'react';

import { ObjectPropertiesForm } from './panelview/formbuilder';

export interface IFormDialogOptions {
  schema: IDict;
  sourceData: IDict;
  title: string;
  syncData: (props: IDict) => void;
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

// TODO This is currently not used, shall we remove it or will we need it later?
export class FormDialog extends Dialog<IDict> {
  constructor(options: IFormDialogOptions) {
    const filePath = options.context.path;
    const jGISModel = options.context.model;
    const body = (
      <div style={{ overflow: 'hidden' }}>
        <ObjectPropertiesForm
          formContext="create"
          model={jGISModel}
          filePath={`${filePath}::dialog`}
          sourceData={options.sourceData}
          schema={options.schema}
          syncData={options.syncData}
        />
      </div>
    );

    super({ title: options.title, body, buttons: [Dialog.cancelButton()] });
    this.addClass('jGIS-property-FormDialog');
  }
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
    saveSharedLabel.append(saveSharedLabelInput, 'Save data in shared model');

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
