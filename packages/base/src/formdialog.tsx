import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import * as React from 'react';

import { ObjectPropertiesForm } from './panelview/formbuilder';

export interface IFormDialogOptions {
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

// TODO This is currently not used, shall we remove it or will we need it later?
export class FormDialog extends Dialog<IDict> {
  constructor(options: IFormDialogOptions) {
    let cancelCallback: (() => void) | undefined = undefined;
    if (options.cancelButton) {
      cancelCallback = () => {
        if (options.cancelButton !== true && options.cancelButton !== false) {
          options.cancelButton();
        }
        this.resolve(0);
      };
    }
    const filePath = options.context.path;
    const jGISModel = options.context.model;
    const body = (
      <div style={{ overflow: 'hidden' }}>
        <ObjectPropertiesForm
          model={jGISModel}
          filePath={`${filePath}::dialog`}
          sourceData={options.sourceData}
          schema={options.schema}
          syncData={options.syncData}
          cancel={cancelCallback}
        />
      </div>
    );

    super({ title: options.title, body, buttons: [Dialog.cancelButton()] });
    this.addClass('jGIS-property-FormDialog');
  }
}
