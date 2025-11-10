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

import { IColorMap } from '@/src/dialogs/symbology/colorRampUtils';

interface IColorRampSelectorEntryProps {
  index: number;
  colorMap: IColorMap;
  onClick: (item: any) => void;
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

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    for (let i = 0; i <= 255; i++) {
      ctx.beginPath();

      const color = colorMap.colors[i];
      ctx.fillStyle = color;

      ctx.fillRect(i * 2, 0, 2, canvasHeight);
    }
  }, []);

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
