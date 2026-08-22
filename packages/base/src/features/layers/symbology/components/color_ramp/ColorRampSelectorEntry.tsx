/**
 * @module ColorRampSelectorEntry
 *
 * Represents a single selectable color map option in the `ColorRampSelector`.
 * Renders a preview ColorRamp on a canvas and triggers `onClick` when selected.
 *
 * Props:
 * - `colorMap`: Ramp definition including name and colors.
 * - `onClick`: Callback fired with the ramp name when clicked.
 */

import React, { useEffect, useRef } from 'react';

import {
  COLOR_RAMP_WARNINGS,
  ColorRampName,
  IColorMap,
  drawColorRamp,
} from '@/src/features/layers/symbology/colorRampUtils';
import { InfoTip } from '@/src/shared/components/InfoTip';

interface IColorRampSelectorEntryProps {
  colorMap: IColorMap;
  onClick: (item: ColorRampName) => void;
}

const ColorRampSelectorEntry: React.FC<IColorRampSelectorEntryProps> = ({
  colorMap,
  onClick,
}) => {
  // A ref rather than a DOM id: several selectors can be mounted at once (one
  // per mapping card), and shared ids made every entry paint onto the first
  // selector's canvas, leaving the others blank.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWidth = 512;
  const canvasHeight = 30;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    drawColorRamp(canvas, colorMap);
  }, [colorMap]);

  const warning = COLOR_RAMP_WARNINGS[colorMap.name];

  return (
    <div
      onClick={() => onClick(colorMap.name)}
      className="jp-gis-color-ramp-entry"
    >
      <span className="jp-gis-color-label">{colorMap.name}</span>
      {warning && (
        <span
          className="jp-gis-color-ramp-warning"
          onClick={e => e.stopPropagation()}
        >
          <InfoTip text={warning.reason}>
            {warning.link && (
              <a href={warning.link} target="_blank" rel="noreferrer">
                Learn more
              </a>
            )}
          </InfoTip>
        </span>
      )}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="jp-gis-color-canvas"
      ></canvas>
    </div>
  );
};

export default ColorRampSelectorEntry;
