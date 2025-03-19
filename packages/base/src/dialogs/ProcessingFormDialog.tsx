import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';
import { BaseForm, IBaseFormProps } from '../formbuilder/objectform/baseform';
import { DissolveForm } from '../formbuilder/objectform/dissolveProcessForm';
import { BufferForm } from '../formbuilder/objectform/bufferProcessForm';

export interface IProcessingFormDialogOptions extends IBaseFormProps {
  formContext: 'update' | 'create';
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
  processingType: 'buffer' | 'dissolve' | 'export';
}

export class ProcessingFormDialog extends Dialog<IDict> {
  constructor(options: IProcessingFormDialogOptions) {
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

    let FormComponent;
    switch (options.processingType) {
      case 'dissolve':
        FormComponent = DissolveForm;
        break;
      case 'buffer':
        FormComponent = BufferForm;
        break;
      case 'export':
        FormComponent = BaseForm;
        break;
      default:
        FormComponent = BaseForm;
    }

    const body = (
      <div style={{ overflow: 'hidden' }}>
        <FormComponent
          formContext={options.formContext}
          filePath={filePath}
          model={jgisModel}
          sourceData={options.sourceData}
          schema={options.schema}
          syncData={options.syncData}
          cancel={cancelCallback}
        />
      </div>
    );

    super({ title: options.title, body, buttons: [Dialog.cancelButton()] });
    this.addClass('jGIS-processing-FormDialog');
  }
}
