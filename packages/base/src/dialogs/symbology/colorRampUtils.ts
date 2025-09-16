import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import { useEffect } from 'react';

import rawCmocean from '@/src/dialogs/symbology/components/color_ramp/cmocean.json';
import { COLOR_RAMP_DEFINITIONS } from '@/src/dialogs/symbology/rampNames';
import { objectEntries, objectKeys } from '@/src/tools';
import { IColorMap } from '@/src/types';

const { __license__: _, ...cmocean } = rawCmocean;

Object.assign(colorScale, cmocean);

export const COLOR_RAMP_NAMES = objectKeys(COLOR_RAMP_DEFINITIONS);
export type ColorRampName = (typeof COLOR_RAMP_NAMES)[number];

export const getColorMapList = (): IColorMap[] => {
  const colorMapList: IColorMap[] = [];

  for (const [name, definition] of objectEntries(COLOR_RAMP_DEFINITIONS)) {
    const colors = colormap({
      colormap: name,
      nshades: 255,
      format: 'rgbaString',
    });

    colorMapList.push({ name, colors, definition });
  }

  return colorMapList;
};

/**
 * Hook that loads and sets color maps.
 */
export const useColorMapList = (
  setColorMaps: React.Dispatch<React.SetStateAction<IColorMap[]>>,
) => {
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
