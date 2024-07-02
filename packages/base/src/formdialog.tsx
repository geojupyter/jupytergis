import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { LabIcon, errorIcon } from '@jupyterlab/ui-components';
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

export class JSONErrorDialog extends Dialog<null> {
  constructor(options: { errors?: ErrorObject[] | null }) {
    const title = (
      <div className={'jp-gis-jsonErrorHeader'}>
        <LabIcon.resolveReact
          icon={errorIcon}
          height={32}
          width={32}
        ></LabIcon.resolveReact>
        <div>GeoJSON file invalid</div>
      </div>
    );
    const body = (
      <div className={'jp-gis-jsonErrorBody'}>
        <div>It can't be used as it in a layer.</div>
        <details>
          <summary>Errors</summary>
          <pre className={'jp-gis-jsonErrorDetails'}>
            {options.errors?.reverse().map(error => (
              <>
                {error.message}
                <br />
              </>
            ))}
          </pre>
        </details>
        <div>Do you want to save it in source and modify it later ?</div>
      </div>
    );
    super({
      title,
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    });
    this.addClass('jp-gis-jsonError');
  }
}
