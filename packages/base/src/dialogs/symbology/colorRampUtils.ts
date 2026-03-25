import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import { useEffect } from 'react';

import rawCmocean from '@/src/dialogs/symbology/components/color_ramp/cmocean.json';

export type RgbaColor = [number, number, number, number];

/** OpenLayers default blue, used as the fallback color throughout symbology dialogs. */
export const DEFAULT_COLOR: RgbaColor = [51, 153, 204, 1];

/**
 * Returns true if `val` is a usable solid color: either a hex string or a
 * plain [r,g,b,a] number array. Returns false for OL expression arrays like
 * ['interpolate', ...] whose first element is a string.
 */
export function isColor(val: unknown): boolean {
  if (typeof val === 'string') {
    return /^#?[0-9A-Fa-f]{3,8}$/.test(val);
  }
  return Array.isArray(val) && val.length >= 3 && typeof val[0] === 'number';
}

export interface IColorMap {
  name: ColorRampName;
  colors: string[];
}

const { __license__: _, ...cmocean } = rawCmocean;

Object.assign(colorScale, cmocean);

export const COLOR_RAMP_NAMES = [
  'jet',
  'hsv',
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
  'picnic',
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
  'rainbow-soft',
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
  'cubehelix',
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

export const COLOR_RAMP_DEFAULTS: Partial<Record<ColorRampName, number>> = {
  hsv: 11,
  picnic: 11,
  'rainbow-soft': 11,
  cubehelix: 16,
} as const;

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
 * Convert any color value (hex string or [r,g,b,a] array) to RgbaColor.
 * Alpha must be in 0-1 range; a warning is logged if it is not.
 */
export function colorToRgba(color: unknown): RgbaColor {
  if (typeof color === 'string') {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (!result) {
      console.warn('Unable to parse hex color, using default');
      return DEFAULT_COLOR;
    }
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      1,
    ];
  }
  if (isColor(color)) {
    const [r, g, b, a] = color as number[];
    const alpha = a ?? 1;
    if (alpha > 1) {
      console.warn(`Color alpha ${alpha} is out of 0-1 range`);
    }
    return [r, g, b, alpha];
  }
  return DEFAULT_COLOR;
}
