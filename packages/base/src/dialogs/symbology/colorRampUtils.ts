import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import { useEffect } from 'react';

import rawCmocean from '@/src/dialogs/symbology/components/color_ramp/cmocean.json';

export interface IColorMap {
  name: ColorRampName;
  colors: string[];
}

const { __license__: _, ...cmocean } = rawCmocean as any;

Object.assign(colorScale, cmocean);

export const COLOR_RAMP_NAMES = [
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
  'velocity-green',
  // 'cubehelix' 16 steps min
  'ice',
  'oxy',
  'matter',
  'amp',
  'tempo',
  'rain',
  'topo',
  'balance',
  'delta',
  'curl',
  'diff',
  'tarn',
] as const;

export type ColorRampName = (typeof COLOR_RAMP_NAMES)[number];

export const getColorMapList = (): IColorMap[] => {
  const colorMapList: IColorMap[] = [];

  COLOR_RAMP_NAMES.forEach(name => {
    const colorRamp = colormap({
      colormap: name,
      nshades: 255,
      format: 'rgbaString',
    });

    colorMapList.push({ name, colors: colorRamp });
  });

  return colorMapList;
};

/**
 * Hook that loads and sets color maps.
 */
export const useColorMapList = (setColorMaps: (maps: IColorMap[]) => void) => {
  useEffect(() => {
    setColorMaps(getColorMapList());
  }, [setColorMaps]);
};

/**
 * Ensure we always get a valid hex string from either an RGB(A) array or string.
 */
export const ensureHexColorCode = (color: number[] | string): string => {
  if (typeof color === 'string') {
    return color;
  }

  // color must be an RGBA array
  const hex = color
    .slice(0, -1) // Color input doesn't support hex alpha values so cut that out
    .map((val: { toString: (arg0: number) => string }) => {
      return val.toString(16).padStart(2, '0');
    })
    .join('');

  return '#' + hex;
};

/**
 * Convert hex to [r,g,b,a] array.
 */
export function hexToRgb(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result) {
    console.warn('Unable to parse hex value, defaulting to black');
    return [0, 0, 0, 255];
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    255, // TODO: Make alpha customizable?
  ];
}
