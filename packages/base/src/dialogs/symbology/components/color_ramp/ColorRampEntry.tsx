import React, { useEffect } from 'react';
import { IColorMap } from './CanvasSelectComponent';

interface IColorRampEntryProps {
  index: number;
  colorMap: IColorMap;
  onClick: (item: any) => void;
}

const ColorRampEntry = ({ index, colorMap, onClick }: IColorRampEntryProps) => {
  const canvasHeight = 30;

  useEffect(() => {
    const canvas = document.getElementById(`cv-${index}`) as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
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
        height={canvasHeight}
        className="jp-gis-color-canvas"
      ></canvas>
    </div>
  );
};

export default ColorRampEntry;
