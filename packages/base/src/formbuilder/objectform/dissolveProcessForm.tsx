import { IDict } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';
import { BaseForm, IBaseFormProps } from './baseform';

export interface IDissolveFormOptions extends IBaseFormProps {
title: string;
cancelButton: (() => void) | boolean;
}

export class DissolveFormDialog extends Dialog<IDict> {
constructor(options: IDissolveFormOptions) {
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
        schema={options.schema}
        syncData={options.syncData}
        cancel={cancelCallback}
        />
    </div>
    );

    super({ title: options.title, body, buttons: [Dialog.cancelButton()] });
    this.addClass('jGIS-property-DissolveFormDialog');
}
}
