import type { IJupyterGISModel } from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CheckIcon, RotateCcw } from 'lucide-react';
import React, { type RefObject } from 'react';

import { SegmentOverrideSheet } from '@/src/features/story/components/SegmentOverrideSheet';
import {
  buildSegmentLayerRows,
  resetSegmentLayerOverride,
  setSegmentLayerOpacity,
  setSegmentLayerVisibility,
} from '@/src/features/story/utils/storySegmentLayerOverrides';
import { Button } from '@/src/shared/components/Button';
import { Slider } from '@/src/shared/components/Slider';
import { Switch } from '@/src/shared/components/Switch';
import { SYMBOLOGY_VALID_LAYER_TYPES } from '@/src/types';

export interface ISegmentLayerOverridesProps {
  model: IJupyterGISModel;
  state: IStateDB;
  segmentId: string;
  portalContainerRef: RefObject<HTMLElement | null>;
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
      <p className="jgis-story-editor-help">No map layers in this project.</p>
    );
  }

  return (
    <div className="jgis-story-editor-segment-layer-grid">
      <div
        className="jgis-story-editor-segment-layer-header"
        aria-hidden="true"
      >
        <span>Layer Name</span>
        <span>Visibility</span>
        <span>Opacity</span>
        <span>Symbology</span>
        <span>Override</span>
        <span>Reset</span>
      </div>
      <ul className="jgis-story-editor-segment-layer-list">
        {rows.map(row => {
          const layer = model.getLayer(row.layerId);
          const canEditSymbology =
            layer !== undefined &&
            SYMBOLOGY_VALID_LAYER_TYPES.includes(layer.type);

          return (
            <li
              key={row.layerId}
              className="jgis-story-editor-segment-layer-row"
            >
              <span
                className="jgis-story-editor-segment-layer-name-text"
                title={row.layerName}
              >
                {row.layerName}
              </span>
              <span className="jgis-story-editor-segment-layer-visibility">
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
              </span>
              <span className="jgis-story-editor-segment-layer-opacity">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(row.effectiveOpacity * 100)]}
                  aria-label={`Opacity for ${row.layerName}`}
                  onValueChange={([opacity]) => {
                    setSegmentLayerOpacity(
                      model,
                      segmentId,
                      row.layerId,
                      opacity / 100,
                    );
                  }}
                />
                <span className="jgis-story-editor-segment-layer-opacity-value">
                  {Math.round(row.effectiveOpacity * 100)}%
                </span>
              </span>
              <span className="jgis-story-editor-segment-layer-symbology">
                {canEditSymbology ? (
                  <SegmentOverrideSheet
                    model={model}
                    segmentId={segmentId}
                    layerId={row.layerId}
                    portalContainerRef={portalContainerRef}
                  />
                ) : null}
              </span>
              <span className="jgis-story-editor-segment-layer-override">
                {row.isChanged ? (
                  <CheckIcon
                    className="jgis-story-editor-segment-layer-override-icon"
                    aria-label="Override applied"
                  />
                ) : null}
              </span>
              <span className="jgis-story-editor-segment-layer-reset">
                <Button
                  type="button"
                  variant="icon"
                  size="icon-sm"
                  disabled={!row.isChanged}
                  aria-label={`Reset overrides for ${row.layerName}`}
                  onClick={() => {
                    resetSegmentLayerOverride(model, segmentId, row.layerId);
                  }}
                >
                  <RotateCcw />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
