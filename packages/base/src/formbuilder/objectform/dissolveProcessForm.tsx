import { Dialog } from '@jupyterlab/apputils';
import {
  IDict,
  IJupyterGISClientState,
  IJupyterGISModel
} from '@jupytergis/schema';
import * as React from 'react';
import { ObjectPropertiesForm } from '../formbuilder';
import { focusInputField, removeStyleFromProperty } from '../utils';

export interface IDissolveFormDialogOptions {
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

export class DissolveFormDialog extends Dialog<IDict> {
  constructor(options: IDissolveFormDialogOptions) {
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
        <ObjectPropertiesForm
          parentType="dialog"
          filePath={`${filePath}::dialog`}
          sourceData={options.sourceData}
          schema={options.schema}
          syncData={options.syncData}
          cancel={cancelCallback}
          syncSelectedField={options.syncSelectedPropField}
        />
      </div>
    );

    let lastSelectedPropFieldId: string | undefined = undefined;

    const onClientSharedStateChanged = (
      sender: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>
    ): void => {
      const remoteUser = jgisModel?.localState?.remoteUser;
      if (remoteUser) {
        const newState = clients.get(remoteUser);

        const id = newState?.selectedPropField?.id;
        const value = newState?.selectedPropField?.value;
        const parentType = newState?.selectedPropField?.parentType;

        if (parentType === 'dialog') {
          lastSelectedPropFieldId = focusInputField(
            `${filePath}::dialog`,
            id,
            value,
            newState?.user?.color,
            lastSelectedPropFieldId
          );
        }
      } else {
        if (lastSelectedPropFieldId) {
          removeStyleFromProperty(
            `${filePath}::dialog`,
            lastSelectedPropFieldId,
            ['border-color', 'box-shadow']
          );
          lastSelectedPropFieldId = undefined;
        }
      }
    };

    jgisModel?.clientStateChanged.connect(onClientSharedStateChanged);
    super({ title: options.title, body, buttons: [Dialog.cancelButton()] });
    this.addClass('jGIS-DissolveFormDialog');
  }
}
