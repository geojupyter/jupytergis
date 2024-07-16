import {
  IDict,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  LayerType,
  SourceType
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { LabIcon, errorIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { ErrorObject } from 'ajv';
import * as React from 'react';

import { BaseForm } from '../formbuilder/baseform';
import { deepCopy } from '../tools';

export interface ICreationFormDialogOptions {
  /**
   * The type of layer to create.
   */
  layerType?: LayerType;

  /**
   * The type of source to create.
   */
  sourceType?: SourceType;

  /**
   * The initial layer data, if it applies.
   */
  layerData?: IDict;

  /**
   * The initial source data, if it applies.
   */
  sourceData?: IDict;

  formSchemaRegistry: IJGISFormSchemaRegistry;
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

/**
 * Form for creating a source, a layer or both at the same time
 */
export class CreationFormDialog extends Dialog<IDict> {
  constructor(options: ICreationFormDialogOptions) {
    const filePath = options.context.path;
    const jGISModel = options.context.model;

    let layerSchema: IDict | undefined = undefined;
    if (options.layerType) {
      layerSchema = deepCopy(
        options.formSchemaRegistry.getSchemas().get(options.layerType)
      );

      if (!layerSchema) {
        console.log(`Cannot find schema for ${options.layerType}`);
        return;
      }

      // If a source is created as part of this form, remove the source selection from the layer form
      if (options.sourceType) {
        delete layerSchema.properties?.source;
      }
      layerSchema['properties'] = {
        name: { type: 'string', description: 'The name of the layer' },
        ...layerSchema['properties']
      };
    }

    let sourceSchema: IDict | undefined = undefined;
    if (options.sourceType) {
      sourceSchema = deepCopy(
        options.formSchemaRegistry.getSchemas().get(options.sourceType)
      );
    }

    if (!layerSchema && !sourceSchema) {
      // Unreachable
      console.log(
        `Cannot find schema for ${options.layerType}, ${options.sourceType}`
      );
      return;
    }

    const body = (
      <div style={{ overflow: 'hidden' }}>
        <BaseForm
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
    this.addClass('jGIS-layer-CreationFormDialog');
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
