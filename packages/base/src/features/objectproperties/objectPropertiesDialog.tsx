import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';

import { EditForm } from '@/src/shared/formbuilder/editform';

export interface IObjectPropertiesWidgetOptions {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

/**
 * A dialog wrapping the object properties form for the currently selected
 * layer (or source). This gives the property form room to breathe on narrow /
 * mobile layouts where the merged side panel is too cramped to edit in.
 */
export class ObjectPropertiesWidget extends Dialog<void> {
  constructor(options: IObjectPropertiesWidgetOptions) {
    const { model, formSchemaRegistry } = options;

    const selected = model.localState?.selected?.value ?? {};
    const selectedId = Object.keys(selected)[0];

    let layerId: string | undefined = undefined;
    let sourceId: string | undefined = undefined;
    const layer = selectedId ? model.getLayer(selectedId) : undefined;
    if (layer) {
      layerId = selectedId;
      sourceId = layer.parameters?.source;
    } else if (selectedId && model.getSource(selectedId)) {
      sourceId = selectedId;
    }

    const body = (
      <EditForm
        layer={layerId}
        source={sourceId}
        formSchemaRegistry={formSchemaRegistry}
        model={model}
      />
    );

    super({
      title: layer?.name ?? 'Layer Properties',
      body,
      buttons: [Dialog.okButton({ label: 'Close' })],
    });

    this.id = 'jupytergis::objectPropertiesWidget';
    this.addClass('jp-gis-object-properties-dialog');
  }
}

export default ObjectPropertiesWidget;
