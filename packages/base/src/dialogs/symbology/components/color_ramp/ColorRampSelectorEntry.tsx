/**
 * @module ColorRampSelectorEntry
 *
 * Represents a single selectable color ramp option in the `ColorRampSelector`.
 * Renders a preview ColorRamp on a canvas and triggers `onClick` when selected.
 *
 * Props:
 * - `index`: Unique index for canvas ID.
 * - `colorMap`: Ramp definition including name and colors.
 * - `onClick`: Callback fired with the ramp name when clicked.
 */

import React, { useEffect } from 'react';

import {
  ColorRampName,
  IColorMap,
  drawColorRamp,
} from '@/src/dialogs/symbology/colorRampUtils';

interface IColorRampSelectorEntryProps {
  index: number;
  colorMap: IColorMap;
  onClick: (item: ColorRampName) => void;
}

const ColorRampSelectorEntry: React.FC<IColorRampSelectorEntryProps> = ({
  index,
  colorMap,
  onClick,
}) => {
  const canvasWidth = 512;
  const canvasHeight = 30;

  useEffect(() => {
    const canvas = document.getElementById(`cv-${index}`) as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    drawColorRamp(canvas, colorMap);
  }, [colorMap, index]);

  return (
    <div
      key={colorMap.name}
      onClick={() => onClick(colorMap.name)}
      className="jp-gis-color-ramp-entry"
    >
      <span className="jp-gis-color-label">{colorMap.name}</span>
      <canvas
        id={`cv-${index}`}
        width={canvasWidth}
        height={canvasHeight}
        className="jp-gis-color-canvas"
      ></canvas>
    </div>
  );
};

export default ColorRampSelectorEntry;
