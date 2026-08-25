import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';

import { MetadataView } from '@/src/features/metadata';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import { EditForm } from '@/src/shared/formbuilder/editform';

/**
 * The tabs of the Layer Properties dialog.
 *
 * `properties` edits the object, `information` describes the data behind it.
 */
export type ObjectPropertiesTab = 'properties' | 'information';

export interface IObjectPropertiesWidgetOptions {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  /**
   * Which tab to open on. Defaults to the property form.
   */
  initialTab?: ObjectPropertiesTab;
}

/**
 * A dialog wrapping the object properties form for the currently selected
 * layer (or source). This gives the property form room to breathe on narrow /
 * mobile layouts where the merged side panel is too cramped to edit in.
 *
 * The Information tab alongside it reports what JupyterGIS can read about the
 * underlying data: its projection, extent, bands and tile pyramid.
 */
export class ObjectPropertiesWidget extends Dialog<void> {
  constructor(options: IObjectPropertiesWidgetOptions) {
    const { model, formSchemaRegistry, initialTab = 'properties' } = options;

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

    // Both panels get the same fixed height and scroll internally, so the
    // dialog does not jump when the user switches tabs: the property form and
    // the metadata view are rarely the same length.
    const panelClass = 'h-[min(60vh,32rem)] overflow-y-auto';

    const body = (
      <Tabs defaultValue={initialTab} className="jgis-object-properties-tabs">
        <TabsList>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="information">Information</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className={panelClass}>
          <EditForm
            layer={layerId}
            source={sourceId}
            formSchemaRegistry={formSchemaRegistry}
            model={model}
          />
        </TabsContent>

        {/* Radix unmounts inactive tabs, so metadata is only read — and only
            fetched — once the user actually opens this tab. */}
        <TabsContent value="information" className={panelClass}>
          <MetadataView model={model} selectedId={selectedId} />
        </TabsContent>
      </Tabs>
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
