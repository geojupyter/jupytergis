import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import * as d3Chromatic from 'd3-scale-chromatic';
import { useEffect } from 'react';

import rawCmocean from '@/src/dialogs/symbology/components/color_ramp/cmocean.json';

// RgbaColor is an array because OpenLayers and colormap expect arrays directly.
// RGBA_INDEX bridges that to the named-channel style used by react-colorful and the color picker UI.
export type RgbaColor = [number, number, number, number];
export const RGBA_INDEX = { r: 0, g: 1, b: 2, a: 3 } as const;
export type RgbaChannel = keyof typeof RGBA_INDEX;

/** OpenLayers default blue, used as the fallback color throughout symbology dialogs. */
export const DEFAULT_COLOR: RgbaColor = [51, 153, 204, 1];

/** Default stroke width in pixels, used as the initial value in all symbology dialogs. */
export const DEFAULT_STROKE_WIDTH = 1.25;

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

/**
 * Recursively searches an OL expression tree for the first node whose first
 * element matches `operator` (e.g. `'interpolate'`, `'case'`).
 * Returns the matching sub-expression, or `null` if not found.
 */
export function findExprNode(
  expr: unknown,
  operator: string,
): unknown[] | null {
  if (!Array.isArray(expr)) {
    return null;
  }
  if (expr[0] === operator) {
    return expr;
  }
  for (const child of expr) {
    const found = findExprNode(child, operator);
    if (found) {
      return found;
    }
  }
  return null;
}

export interface IColorMap {
  name: ColorRampName;
  colors: string[];
  type: 'continuous' | 'categorical';
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

export const D3_CATEGORICAL_SCHEMES = {
  schemeCategory10: d3Chromatic.schemeCategory10,
  schemeAccent: d3Chromatic.schemeAccent,
  schemeDark2: d3Chromatic.schemeDark2,
  schemeObservable10: d3Chromatic.schemeObservable10,
  schemePaired: d3Chromatic.schemePaired,
  schemePastel1: d3Chromatic.schemePastel1,
  schemePastel2: d3Chromatic.schemePastel2,
  schemeSet1: d3Chromatic.schemeSet1,
  schemeSet2: d3Chromatic.schemeSet2,
  schemeSet3: d3Chromatic.schemeSet3,
  schemeTableau10: d3Chromatic.schemeTableau10,
} as const;

export type D3SchemeName = keyof typeof D3_CATEGORICAL_SCHEMES;

export type ColorRampName = (typeof COLOR_RAMP_NAMES)[number] | D3SchemeName;

export const getColorMapList = (): IColorMap[] => {
  const colorMapList: IColorMap[] = [];

  COLOR_RAMP_NAMES.forEach(name => {
    const colorRamp = colormap({
      colormap: name,
      nshades: 255,
      format: 'rgbaString',
    });

    colorMapList.push({ name, colors: colorRamp, type: 'continuous' });
  });

  Object.entries(D3_CATEGORICAL_SCHEMES).forEach(([name, colors]) => {
    colorMapList.push({
      name: name as ColorRampName,
      colors: colors.map(c => c.toString()),
      type: 'categorical',
    });
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

/**
 * Draw a color ramp to a canvas.
 */
export const drawColorRamp = (
  ctx: CanvasRenderingContext2D,
  colors: string[],
  type: 'continuous' | 'categorical',
  width: number,
  height: number,
) => {
  if (!ctx || !colors || colors.length === 0) {
    return;
  }

  if (type === 'categorical') {
    const blockWidth = width / colors.length;

    colors.forEach((color, i) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.fillRect(i * blockWidth, 0, blockWidth, height);
    });
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const step = 1 / (colors.length - 1);

    colors.forEach((color, i) => {
      gradient.addColorStop(i * step, color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
};
