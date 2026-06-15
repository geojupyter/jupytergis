import type { IJupyterGISModel } from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import React, { type RefObject } from 'react';

import { SymbologyWidget } from '@/src/features/layers/symbology/symbologyDialog';
import {
  buildSegmentLayerRows,
  setSegmentLayerVisibility,
} from '@/src/features/story/utils/storySegmentLayerOverrides';
import { Button } from '@/src/shared/components/Button';
import { Switch } from '@/src/shared/components/Switch';
import { SYMBOLOGY_VALID_LAYER_TYPES } from '@/src/types';
import { SegmentOverrideSheet } from './SegmentOverrideSheet';

const SELECTION_SETTLE_MS = 100;

export interface ISegmentLayerOverridesProps {
  model: IJupyterGISModel;
  state: IStateDB;
  segmentId: string;
  portalContainerRef: RefObject<HTMLElement | null>;
}

async function openSegmentLayerSymbology(
  model: IJupyterGISModel,
  state: IStateDB,
  segmentId: string,
  targetLayerId: string,
): Promise<void> {
  const targetLayer = model.getLayer(targetLayerId);
  if (!targetLayer || !SYMBOLOGY_VALID_LAYER_TYPES.includes(targetLayer.type)) {
    return;
  }

  const previousSelection = model.selected;
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
}

export function SegmentLayerOverrides({
  model,
  state,
  segmentId,
  portalContainerRef,
}: ISegmentLayerOverridesProps): JSX.Element {
  const rows = buildSegmentLayerRows(model, segmentId);

  if (rows.length === 0) {
    return (
      <p className="jgis-story-editor-segment-layer-empty">
        No map layers in this project.
      </p>
    );
  }

  return (
    <ul className="jgis-story-editor-segment-layer-list">
      {rows.map(row => {
        const layer = model.getLayer(row.layerId);
        const canEditStyle =
          layer !== undefined &&
          SYMBOLOGY_VALID_LAYER_TYPES.includes(layer.type);

        return (
          <li key={row.layerId} className="jgis-story-editor-segment-layer-row">
            <span className="jgis-story-editor-segment-layer-name">
              <span className="jgis-story-editor-segment-layer-name-text">
                {row.layerName}
              </span>
              {row.isChanged ? (
                <span className="jgis-story-editor-segment-layer-override-pill">
                  Override
                </span>
              ) : null}
            </span>
            <Switch
              checked={row.effectiveVisible}
              onCheckedChange={checked => {
                setSegmentLayerVisibility(
                  model,
                  segmentId,
                  row.layerId,
                  checked,
                );
              }}
              aria-label={`Toggle visibility for ${row.layerName}`}
            />
            {canEditStyle ? (
              <SegmentOverrideSheet
                model={model}
                segmentId={segmentId}
                layerId={row.layerId}
                portalContainerRef={portalContainerRef}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
