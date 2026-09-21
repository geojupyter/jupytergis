import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  LayerType,
  ProcessingType,
  SourceType,
} from '@jupytergis/schema';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import type {
  IRenderMimeRegistry,
  IUrlResolverFactory,
} from '@jupyterlab/rendermime';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';

import { LayerBrowserWidget } from '@/src/features/layer-browser';
import { LayerCreationFormDialog } from '@/src/features/layers/layerCreationFormDialog';
import { SymbologyWidget } from '@/src/features/layers/symbology/symbologyDialog';
import {
  ObjectPropertiesTab,
  ObjectPropertiesWidget,
} from '@/src/features/objectproperties/objectPropertiesDialog';
import { ProcessingFormDialog } from '@/src/features/processing/ProcessingFormDialog';
import { StoryEditorWidget } from '@/src/features/story/storyEditorDialog';
import { registerFollowDialog } from './followDialogs';

export interface IRegisterFollowDialogsOptions {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  layerBrowserRegistry: IJGISLayerBrowserRegistry;
  state: IStateDB;
  commands: CommandRegistry;
  editorServices: IEditorServices;
  rendermime: IRenderMimeRegistry;
  urlResolverFactory?: IUrlResolverFactory;
}

/**
 * Teach the follow-mode mirror how to rebuild each dialog locally. The leader
 * only broadcasts ids, so every service a dialog needs is taken from this
 * client.
 */
export function registerFollowDialogs({
  formSchemaRegistry,
  layerBrowserRegistry,
  state,
  commands,
  editorServices,
  rendermime,
  urlResolverFactory,
}: IRegisterFollowDialogsOptions): void {
  registerFollowDialog('symbology', (model, params) => {
    const layerId = params.layerId as string | undefined;
    if (layerId && !model.getLayer(layerId)) {
      return null;
    }
    return new SymbologyWidget({
      model,
      state,
      layerId,
      followMirror: true,
    });
  });

  registerFollowDialog('layerProperties', (model, params) => {
    const objectId = params.objectId as string | undefined;
    if (objectId && !model.getLayerOrSource(objectId)) {
      return null;
    }
    return new ObjectPropertiesWidget({
      model,
      formSchemaRegistry,
      objectId,
      followMirror: true,
      initialTab: params.initialTab as ObjectPropertiesTab | undefined,
    });
  });

  registerFollowDialog(
    'layerBrowser',
    model =>
      new LayerBrowserWidget({
        model,
        registry: layerBrowserRegistry.getRegistryLayers(),
        formSchemaRegistry,
        followMirror: true,
      }),
  );

  registerFollowDialog(
    'layerCreation',
    (model, params) =>
      new LayerCreationFormDialog({
        model,
        formSchemaRegistry,
        followMirror: true,
        title: params.title as string,
        createLayer: params.createLayer as boolean,
        createSource: params.createSource as boolean,
        sourceData: params.sourceData as IDict | undefined,
        layerData: params.layerData as IDict | undefined,
        sourceType: params.sourceType as SourceType,
        layerType: params.layerType as LayerType | undefined,
      }),
  );

  registerFollowDialog('processing', (model, params) => {
    const processingType = params.processingType as 'Export' | ProcessingType;
    const schema = {
      ...(formSchemaRegistry.getSchemas().get(params.schemaId as string) ?? {}),
    };

    return new ProcessingFormDialog({
      model,
      schema,
      followMirror: true,
      title: params.title as string,
      sourceData: (params.sourceData ?? {}) as IDict,
      formContext: params.formContext as 'create' | 'update',
      processingType,
      syncData: () => undefined,
    });
  });

  registerFollowDialog(
    'storyEditor',
    model =>
      new StoryEditorWidget({
        model,
        commands,
        state,
        formSchemaRegistry,
        editorServices,
        rendermime,
        urlResolverFactory,
      }),
  );
}
