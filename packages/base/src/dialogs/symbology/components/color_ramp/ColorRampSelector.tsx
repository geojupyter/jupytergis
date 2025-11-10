/**
 * @module ColorRampSelector
 *
 * Dropdown component for selecting a color ramp.
 * - Displays the currently selected ramp as a preview on a canvas.
 * - Expands to show a list of available ramps (`ColorRampSelectorEntry`).
 * - Updates the preview and notifies parent via `setSelected` when a ramp is chosen.
 *
 * Props:
 * - `selectedRamp`: Name of the currently selected color ramp.
 * - `setSelected`: Callback fired with the new ramp when selected.
 */

import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useRef, useState } from 'react';

import { useColorMapList } from '@/src/dialogs/symbology/colorRampUtils';
import { IColorMap } from '@/src/types';
import ColorRampSelectorEntry from './ColorRampSelectorEntry';

interface IColorRampSelectorProps {
  selectedRamp: string;
  setSelected: (item: any) => void;
  reverse: boolean;
  setReverse: React.Dispatch<React.SetStateAction<boolean>>;
}

const ColorRampSelector: React.FC<IColorRampSelectorProps> = ({
  selectedRamp,
  setSelected,
  reverse,
  setReverse,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [colorMaps, setColorMaps] = useState<IColorMap[]>([]);
  const canvasWidth = 512;
  const canvasHeight = 30;

  useColorMapList(setColorMaps);

  useEffect(() => {
    if (colorMaps.length > 0) {
      updateCanvas(selectedRamp);
    }
  }, [selectedRamp, colorMaps, reverse]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectItem = (item: any) => {
    setSelected(item);
    setIsOpen(false);
    updateCanvas(item);
  };

  const handleOutsideClick = (event: any) => {
    if (!containerRef.current) {
      return;
    }
    if (!containerRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  const updateCanvas = (rampName: string) => {
    // update canvas for displayed color ramp
    const canvas = document.getElementById('cv') as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    canvas.style.visibility = 'hidden';
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const ramp = colorMaps.filter(c => c.name === rampName);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    for (let i = 0; i <= 255; i++) {
      ctx.beginPath();

      const color = reverse ? ramp[0].colors[255 - i] : ramp[0].colors[i];
      ctx.fillStyle = color;

      ctx.fillRect(i * 2, 0, 2, canvasHeight);
    }
    canvas.style.visibility = 'initial';
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div ref={containerRef} className="jp-gis-canvas-button-wrapper">
      <Button
        id="jp-gis-canvas-button"
        onClick={toggleDropdown}
        className="jp-Dialog-button jp-gis-canvas-button"
      >
        <div className="jp-gis-color-ramp-entry jp-gis-selected-entry">
          <span className="jp-gis-color-label">{selectedRamp}</span>
          <canvas
            id="cv"
            className="jp-gis-color-canvas-display"
            width={canvasWidth}
            height={canvasHeight}
          ></canvas>
        </div>
      </Button>
      <div
        className={`jp-gis-color-ramp-dropdown ${isOpen ? 'jp-gis-open' : ''}`}
      >
        {colorMaps.map((item, index) => (
          <ColorRampSelectorEntry
            index={index}
            colorMap={item}
            onClick={selectItem}
          />
        ))}
      </div>

      <div className="jp-gis-symbology-row">
        <label className="jp-gis-inline-label">
          <input
            type="checkbox"
            checked={reverse}
            onChange={e => setReverse(e.target.checked)}
          />
          Reverse Color Ramp
        </label>
      </div>
    </div>
  );
};

export default ColorRampSelector;
