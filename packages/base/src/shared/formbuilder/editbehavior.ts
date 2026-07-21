import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { LayerType } from '@jupytergis/schema';

import { editOpenEOLayer } from '@/src/features/layers/openeo';
import { ObjectPropertiesWidget } from '@/src/features/objectproperties/objectPropertiesDialog';

/**
 * Context passed to a layer edit handler when the user asks to edit the
 * currently selected object.
 */
export interface ILayerEditContext {
  model: IJupyterGISModel;
  /**
   * The id of the selected object. This may be a layer or a source; handlers
   * that only deal with layers should look the layer up from the model.
   */
  selectedId: string;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

/**
 * A function describing how a given layer type is edited. Each handler is
 * responsible for opening whatever UI (dialog, editor, ...) that layer type
 * needs.
 */
export type LayerEditHandler = (context: ILayerEditContext) => Promise<void>;

/**
 * The default edit behavior: open the Layer Properties dialog. This is used for
 * every layer type (and for sources) that does not declare its own handler.
 */
const defaultLayerEdit: LayerEditHandler = async ({
  model,
  formSchemaRegistry,
}) => {
  const dialog = new ObjectPropertiesWidget({ model, formSchemaRegistry });
  await dialog.launch();
};

/**
 * Per-layer-type edit behavior. Add an entry here to give a layer type its own
 * edit UI instead of the default Layer Properties dialog.
 */
const layerEditHandlers: Partial<Record<LayerType, LayerEditHandler>> = {
  // OpenEO layers are edited through the process-graph editor, which is a
  // dialog itself. Opening the Layer Properties dialog first would block it (a
  // dialog cannot open while another is open), so go straight to the
  // process-graph editor instead. See #1653.
  OpenEOTileLayer: async ({ model, selectedId }) => {
    await editOpenEOLayer(model, selectedId);
  },

  // ADD MORE EDIT BEHAVIORS HERE
};

/**
 * Return the edit handler for the given layer type, falling back to the default
 * Layer Properties dialog. Pass `undefined` (e.g. when a source is selected) to
 * get the default handler.
 */
export function getLayerEditHandler(layerType?: LayerType): LayerEditHandler {
  return (layerType && layerEditHandlers[layerType]) || defaultLayerEdit;
}
