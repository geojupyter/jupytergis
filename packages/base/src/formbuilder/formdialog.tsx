import {
  IDict,
  IJupyterGISModel
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';
import { BaseForm } from './objectform/baseform';

export interface IFormDialogOptions {
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  syncSelectedPropField?: (
    id: string | null,
    value: any,
    parentType: 'dialog' | 'panel'
  ) => void;
  model: IJupyterGISModel;
}

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
    const layers = options.model.sharedModel.layers ?? {};

    const layerOptions = Object.keys(layers).map(layerId => ({
      value: layerId,
      label: layers[layerId].name
    }));

    if (options.schema && options.schema.properties?.inputLayer) {
      options.schema.properties.inputLayer.enum = layerOptions.map(
        option => option.value
      );
      options.schema.properties.inputLayer.enumNames = layerOptions.map(
        option => option.label
      );
    }

    const filePath = options.model.filePath;
    const jgisModel = options.model;
    const body = (
      <div style={{ overflow: 'hidden' }}>
        <BaseForm
          formContext="create"
          filePath={filePath}
          model={jgisModel}
          sourceData={options.sourceData}
          sourceType={options.sourceData.type}
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
