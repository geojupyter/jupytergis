import React, { useEffect } from 'react';
import { IColorMap } from './CanvasSelectComponent';

interface IColorRampEntryProps {
  index: number;
  colorMap: IColorMap;
  onClick: (item: any) => void;
}

const ColorRampEntry = ({ index, colorMap, onClick }: IColorRampEntryProps) => {
  const canvasWidth = 345;
  const canvasHeight = 38;

  useEffect(() => {
    const cv = document.getElementById(`cv-${index}`) as HTMLCanvasElement;
    if (!cv) {
      return;
    }
    const ctx = cv.getContext('2d');

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
      className="jp-gis-color-ramp-entry jp-mod-styled"
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

export default ColorRampEntry;
