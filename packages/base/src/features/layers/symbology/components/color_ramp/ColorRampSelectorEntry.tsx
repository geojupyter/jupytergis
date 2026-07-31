/**
 * @module ColorRampSelectorEntry
 *
 * Represents a single selectable color map option in the `ColorRampSelector`.
 * Renders a preview ColorRamp on a canvas and triggers `onClick` when selected.
 *
 * Props:
 * - `index`: Unique index for canvas ID.
 * - `colorMap`: Ramp definition including name and colors.
 * - `onClick`: Callback fired with the ramp name when clicked.
 */

import React, { useEffect } from 'react';

import {
  COLOR_RAMP_WARNINGS,
  ColorRampName,
  IColorMap,
  drawColorRamp,
} from '@/src/features/layers/symbology/colorRampUtils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/src/shared/components/HoverCard';

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

  const warning = COLOR_RAMP_WARNINGS[colorMap.name];

  return (
    <div
      key={colorMap.name}
      onClick={() => onClick(colorMap.name)}
      className="jp-gis-color-ramp-entry"
    >
      <span className="jp-gis-color-label">{colorMap.name}</span>
      {warning && (
        <span
          className="jp-gis-color-ramp-warning"
          onClick={e => e.stopPropagation()}
        >
          <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger aria-label="Color map warning">
              ⚠️
            </HoverCardTrigger>
            <HoverCardContent className="jgis-info-tip-content">
              {warning.reason}
              {warning.link && (
                <>
                  {' '}
                  <a href={warning.link} target="_blank" rel="noreferrer">
                    Learn more
                  </a>
                </>
              )}
            </HoverCardContent>
          </HoverCard>
        </span>
      )}
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
