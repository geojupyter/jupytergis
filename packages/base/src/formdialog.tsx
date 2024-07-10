import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
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
