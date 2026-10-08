import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import * as React from 'react';

import {
  FollowMirrorContext,
  useFollowedState,
} from '@/src/features/follow/useFollowedState';
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
export type ObjectPropertiesTab = 'properties' | 'metadata';

export interface IObjectPropertiesWidgetOptions {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  /**
   * Which tab to open on. Defaults to the property form.
   */
  initialTab?: ObjectPropertiesTab;
  /**
   * Describe this object instead of the locally selected one.
   */
  objectId?: string;
  /**
   * Render as a read-only mirror of the collaborator we are following.
   */
  followMirror?: boolean;
}

interface IObjectPropertiesBodyProps {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  initialTab: ObjectPropertiesTab;
  selectedId: string | undefined;
  layerId: string | undefined;
  sourceId: string | undefined;
  panelClass: string;
}

/**
 * The tab lives in React state rather than Radix's own so that a follower
 * switches tabs when the collaborator they follow does.
 */
function ObjectPropertiesBody({
  model,
  formSchemaRegistry,
  initialTab,
  selectedId,
  layerId,
  sourceId,
  panelClass,
}: IObjectPropertiesBodyProps): React.ReactElement {
  const [tab, setTab] = React.useState<ObjectPropertiesTab>(initialTab);

  useFollowedState(model, 'objectProperties:tab', tab, setTab);

  return (
    <Tabs
      value={tab}
      onValueChange={value => setTab(value as ObjectPropertiesTab)}
      className="jgis-object-properties-tabs"
    >
      <TabsList variant="underline">
        <TabsTrigger className="jgis-underline-indicator" value="properties">
          Properties
        </TabsTrigger>
        <TabsTrigger className="jgis-underline-indicator" value="metadata">
          Metadata
        </TabsTrigger>
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
      <TabsContent value="metadata" className={panelClass}>
        <MetadataView model={model} selectedId={selectedId} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * A dialog wrapping the object properties form for the currently selected
 * layer (or source). This gives the property form room to breathe on narrow /
 * mobile layouts where the merged side panel is too cramped to edit in.
 *
 * The Metadata tab alongside it reports what JupyterGIS can read about the
 * underlying data: its projection, extent, bands and tile pyramid.
 */
export class ObjectPropertiesWidget extends Dialog<void> {
  constructor(options: IObjectPropertiesWidgetOptions) {
    const { model, formSchemaRegistry, initialTab = 'properties' } = options;

    const selected = model.localState?.selected?.value ?? {};
    const selectedId = options.objectId ?? Object.keys(selected)[0];

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
      <FollowMirrorContext.Provider value={!!options.followMirror}>
        <ObjectPropertiesBody
          model={model}
          formSchemaRegistry={formSchemaRegistry}
          initialTab={initialTab}
          selectedId={selectedId}
          layerId={layerId}
          sourceId={sourceId}
          panelClass={panelClass}
        />
      </FollowMirrorContext.Provider>
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
