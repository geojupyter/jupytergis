import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import { useEffect } from 'react';

import rawCmocean from '@/src/dialogs/symbology/components/color_ramp/cmocean.json';
import { objectKeys } from '@/src/tools';
import { IColorMap, IColorRampDefinition } from '@/src/types';

const { __license__: _, ...cmocean } = rawCmocean;

Object.assign(colorScale, cmocean);

export const COLOR_RAMP_DEFINITIONS = {
  jet: { type: 'Sequential' },
  // 'hsv': {type: 'Sequential'}, 11 steps min
  hot: { type: 'Sequential' },
  cool: { type: 'Sequential' },
  spring: { type: 'Sequential' },
  summer: { type: 'Sequential' },
  autumn: { type: 'Sequential' },
  winter: { type: 'Sequential' },
  bone: { type: 'Sequential' },
  copper: { type: 'Sequential' },
  greys: { type: 'Sequential' },
  YiGnBu: { type: 'Sequential' },
  greens: { type: 'Sequential' },
  YiOrRd: { type: 'Sequential' },
  bluered: { type: 'Sequential' },
  RdBu: { type: 'Sequential' },
  // 'picnic': {type: 'Sequential'}, 11 steps min
  rainbow: { type: 'Sequential' },
  portland: { type: 'Sequential' },
  blackbody: { type: 'Sequential' },
  earth: { type: 'Sequential' },
  electric: { type: 'Sequential' },
  viridis: { type: 'Sequential' },
  inferno: { type: 'Sequential' },
  magma: { type: 'Sequential' },
  plasma: { type: 'Sequential' },
  warm: { type: 'Sequential' },
  // 'rainbow-soft': {type: 'Sequential'}, 11 steps min
  bathymetry: { type: 'Sequential' },
  cdom: { type: 'Sequential' },
  chlorophyll: { type: 'Sequential' },
  density: { type: 'Sequential' },
  'freesurface-blue': { type: 'Sequential' },
  'freesurface-red': { type: 'Sequential' },
  oxygen: { type: 'Sequential' },
  par: { type: 'Sequential' },
  phase: { type: 'Cyclic' },
  salinity: { type: 'Sequential' },
  temperature: { type: 'Sequential' },
  turbidity: { type: 'Sequential' },
  'velocity-blue': { type: 'Sequential' },
  'velocity-green': { type: 'Sequential' },
  // 'cubehelix': {type: 'Sequential'}, 16 steps min
  ice: { type: 'Sequential' },
  oxy: { type: 'Sequential' },
  matter: { type: 'Sequential' },
  amp: { type: 'Sequential' },
  tempo: { type: 'Sequential' },
  rain: { type: 'Sequential' },
  topo: { type: 'Sequential' },
  balance: { type: 'Divergent', criticalValue: 0.5 },
  delta: { type: 'Divergent', criticalValue: 0.5 },
  curl: { type: 'Divergent', criticalValue: 0.5 },
  diff: { type: 'Divergent', criticalValue: 0.5 },
  tarn: { type: 'Divergent', criticalValue: 0.5 },
} as const satisfies { [key: string]: IColorRampDefinition };

export const COLOR_RAMP_NAMES = objectKeys(COLOR_RAMP_DEFINITIONS);
export type ColorRampName = (typeof COLOR_RAMP_NAMES)[number];

export const getColorMapList = (): IColorMap[] => {
  const colorMapList: IColorMap[] = [];

  COLOR_RAMP_NAMES.forEach(name => {
    const definition = COLOR_RAMP_DEFINITIONS[name];
    const colors = colormap({
      colormap: name,
      nshades: 255,
      format: 'rgbaString',
    });

    colorMapList.push({ name, colors, definition });
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
