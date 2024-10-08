import { Button } from '@jupyterlab/ui-components';
import colormap from 'colormap';
import React, { useEffect, useRef, useState } from 'react';
import ColorRampEntry from './ColorRampEntry';

export interface IColorMap {
  name: string;
  colors: string[];
}

interface ICanvasSelectComponentProps {
  setSelected: (item: any) => void;
}

const CanvasSelectComponent = ({
  setSelected
}: ICanvasSelectComponentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const colorRampList = [
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
    'cool',
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

  const [colorMap, setColorMap] = useState<IColorMap[]>([]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectItem = (item: any) => {
    setSelected(item);
    setIsOpen(false);
  };

  const handleOutsideClick = (event: any) => {
    if (!containerRef.current) {
      return;
    }
    if (!containerRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const colorMapT: IColorMap[] = [];

    colorRampList.forEach(name => {
      const t = colormap({
        colormap: name,
        nshades: 255,
        format: 'rgbaString'
      });
      const ting = { name: name, colors: t };
      colorMapT.push(ting);

      setColorMap(colorMapT);
    });

    // const cv = document.getElementById('cv') as HTMLCanvasElement;
    // if (!cv) {
    //   return;
    // }
    // const ctx = cv.getContext('2d');

    // if (!ctx) {
    //   return;
    // }

    // for (let i = 0; i <= 255; i++) {
    //   ctx.beginPath();

    //   const color = colorMapT[0].colors[i];
    //   ctx.fillStyle = color;

    //   ctx.fillRect(i * 2, 0, 2, 50);
    // }
  }, []);

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
        {/* <canvas width="512" height="50" id="cv"></canvas> */}
        Select Colormap
      </Button>
      <div className={`dropdown ${isOpen ? 'open' : ''}`}>
        {colorMap.map((item, index) => (
          <ColorRampEntry index={index} colorMap={item} onClick={selectItem} />
        ))}
      </div>
    </div>
  );
};

export default CanvasSelectComponent;
