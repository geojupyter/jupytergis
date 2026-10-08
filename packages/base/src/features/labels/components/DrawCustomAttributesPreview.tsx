import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { findMatchingPresetName } from '@/src/features/labels/drawCustomAttributes';
import { useDrawCustomAttributes } from '@/src/features/labels/hooks/useDrawCustomAttributes';

interface IDrawCustomAttributesPreviewProps {
  model: IJupyterGISModel;
  drawLayerId: string;
}

export function DrawCustomAttributesPreview({
  model,
  drawLayerId,
}: IDrawCustomAttributesPreviewProps): JSX.Element | null {
  const { attributes, presets } = useDrawCustomAttributes(model, drawLayerId);

  if (attributes.length === 0) {
    return null;
  }

  const presetName = findMatchingPresetName(attributes, presets);
  const summary = attributes
    .map(attribute => `${attribute.key} = ${attribute.value}`)
    .join(', ');

  return (
    <div
      className="jgis-draw-custom-attributes-preview"
      title={presetName ? `${presetName}: ${summary}` : summary}
    >
      <span className="jgis-draw-custom-attributes-preview-name">
        {presetName ?? 'Custom attributes'}
      </span>
      <span className="jgis-draw-custom-attributes-preview-summary">
        {summary}
      </span>
    </div>
  );
}
