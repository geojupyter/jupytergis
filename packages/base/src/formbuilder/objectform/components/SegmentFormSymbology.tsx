import type { IStorySegmentLayer } from '@jupytergis/schema';
import { ArrayFieldTemplateProps } from '@rjsf/core';
import React from 'react';

import { SymbologyWidget } from '@/src/dialogs/symbology/symbologyDialog';
import { Button } from '@/src/shared/components/Button';
import { GlobalStateDbManager } from '@/src/store';
import { SYMBOLOGY_VALID_LAYER_TYPES } from '@/src/types';
import type { IJupyterGISFormContext } from '../baseform';

interface ILayerOverrideItemProps {
  item: ArrayFieldTemplateProps['items'][0];
  formContext: IJupyterGISFormContext<IStorySegmentLayer | undefined>;
}

const SELECTION_SETTLE_MS = 100;

function LayerOverrideItem({ item, formContext }: ILayerOverrideItemProps) {
  const model = formContext?.model;
  if (!model) {
    return null;
  }

  const state = GlobalStateDbManager.getInstance().getStateDb();
  const currentItem = formContext?.formData?.layerOverride?.[item.index];
  const targetLayerId = currentItem?.targetLayer;
  const selectedLayer = targetLayerId
    ? model.getLayer(targetLayerId)
    : undefined;
  const canOpenSymbology = Boolean(
    targetLayerId &&
    selectedLayer &&
    SYMBOLOGY_VALID_LAYER_TYPES.includes(selectedLayer.type),
  );

  const handleOpenSymbology = async () => {
    if (!targetLayerId || !state || !selectedLayer) {
      return;
    }
    const previousSelection = model.selected;
    const segmentId = Object.keys(previousSelection ?? {}).find(
      key => model.getLayer(key)?.type === 'StorySegmentLayer',
    );

    // Temporarily set the selected layer to the target layer
    model.syncSelected({ [targetLayerId]: { type: 'layer' } });
    await new Promise(resolve => setTimeout(resolve, SELECTION_SETTLE_MS));

    const dialog = new SymbologyWidget({
      model,
      state,
      isStorySegmentOverride: true,
      segmentId,
    });
    await dialog.launch();

    model.syncSelected(previousSelection ?? {});
  };

  return (
    <div className="jGIS-symbology-override-item">
      <div style={{ flex: 1 }}>{item.children}</div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Button
          title="Edit layer override for the target layer"
          onClick={handleOpenSymbology}
          style={{ width: '100%' }}
          disabled={!canOpenSymbology}
        >
          <span className="fa fa-brush" style={{ marginRight: '4px' }} />
          Edit Symbology
        </Button>
        {item.hasRemove && (
          <Button
            variant="destructive"
            onClick={item.onDropIndexClick(item.index)}
            title="Remove item"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  return (
    <>
      <div>{props.title}</div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {props.items.map(item => (
          <LayerOverrideItem
            key={item.key}
            item={item}
            formContext={props.formContext}
          />
        ))}
        {props.canAdd && (
          <Button onClick={props.onAddClick}>Add Layer Override</Button>
        )}
      </div>
    </>
  );
}
