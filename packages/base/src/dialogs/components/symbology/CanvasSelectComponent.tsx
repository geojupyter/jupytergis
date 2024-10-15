import { Button } from '@jupyterlab/ui-components';
import colormap from 'colormap';
import React, { useEffect, useRef, useState } from 'react';
import ColorRampEntry from './ColorRampEntry';

export interface IColorMap {
  name: string;
  colors: string[];
}

interface ICanvasSelectComponentProps {
  selectedRamp: string;
  setSelected: (item: any) => void;
}

const CanvasSelectComponent = ({
  selectedRamp,
  setSelected
}: ICanvasSelectComponentProps) => {
  const colorRampNames = [
    'jet',
    // 'hsv', 11 steps min
    'hot',
    'cool',
    'spring',
    'summer',
    'autumn',
    'winter',
    'bone',
    'copper',
    'greys',
    'YiGnBu',
    'greens',
    'YiOrRd',
    'bluered',
    'RdBu',
    // 'picnic', 11 steps min
    'rainbow',
    'portland',
    'blackbody',
    'earth',
    'electric',
    'viridis',
    'inferno',
    'magma',
    'plasma',
    'warm',
    // 'rainbow-soft', 11 steps min
    'bathymetry',
    'cdom',
    'chlorophyll',
    'density',
    'freesurface-blue',
    'freesurface-red',
    'oxygen',
    'par',
    'phase',
    'salinity',
    'temperature',
    'turbidity',
    'velocity-blue',
    'velocity-green'
    // 'cubehelix' 16 steps min
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [colorMaps, setColorMaps] = useState<IColorMap[]>([]);

  useEffect(() => {
    const colorMapList: IColorMap[] = [];

    colorRampNames.forEach(name => {
      const colorRamp = colormap({
        colormap: name,
        nshades: 255,
        format: 'rgbaString'
      });
      const ting = { name: name, colors: colorRamp };
      colorMapList.push(ting);

      setColorMaps(colorMapList);
    });
  }, []);

  useEffect(() => {
    if (colorMaps.length > 0) {
      updateCanvas(selectedRamp);
    }
  }, [selectedRamp]);

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
    const cv = document.getElementById('cv') as HTMLCanvasElement;
    if (!cv) {
      return;
    }
    cv.style.visibility = 'hidden';
    const ctx = cv.getContext('2d');

    if (!ctx) {
      return;
    }

    const ramp = colorMaps.filter(c => c.name === rampName);

    for (let i = 0; i <= 255; i++) {
      ctx.beginPath();

      const color = ramp[0].colors[i];
      ctx.fillStyle = color;

      ctx.fillRect(i * 2, 0, 2, 50);
    }
    cv.style.visibility = '';
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div ref={containerRef} className="jp-select-wrapper">
      <Button
        onClick={toggleDropdown}
        className="jp-Dialog-button jp-mod-accept jp-mod-styled"
      >
        <canvas width="354" height="30" id="cv"></canvas>
      </Button>
      <div className={`dropdown ${isOpen ? 'open' : ''}`}>
        {colorMaps.map((item, index) => (
          <ColorRampEntry index={index} colorMap={item} onClick={selectItem} />
        ))}
      </div>
    </div>
  );
};

export default CanvasSelectComponent;
