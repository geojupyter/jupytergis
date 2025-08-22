import colormap from 'colormap';

import { ICmoceanColormaps } from '@/src/dialogs/symbology/symbologyDialog';
import rawCmocean from '../../components/color_ramp/cmocean.json';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { license, ...cmocean } = rawCmocean;

const cmoceanMaps: ICmoceanColormaps = cmocean;

/**
 * Convert an [r,g,b] array to hex string.
 */
function rgbToHex(rgb: number[]): string {
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Convert hex to rgba string.
 */
function hexToRgba(hex: string, alpha = 1): string {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolve a color ramp name into an array of colors.
 */
export function resolveColorRamp(
  rampName: string,
  nshades: number,
  format: 'hex' | 'rgba' = 'hex',
  alpha = 1,
  mode: 'graduated' | 'categorized' = 'graduated',
): string[] {
  const rampData = cmoceanMaps[rampName];

  let colors: string[] = [];

  if (Array.isArray(rampData)) {
    if (typeof rampData[0] === 'string') {
      colors = rampData as string[];
    } else if (Array.isArray(rampData[0])) {
      colors = (rampData as unknown as number[][]).map(rgbToHex);
    }

    if (nshades <= 1) {
      colors = [colors[0]];
    } else if (mode === 'categorized') {
      colors = colors.slice(0, nshades);
    } else {
      const step = (colors.length - 1) / (nshades - 1);
      colors = Array.from(
        { length: nshades },
        (_, i) => colors[Math.round(i * step)],
      );
    }
  } else {
    colors = colormap({
      colormap: rampName,
      nshades,
      format: 'hex',
    });
  }

  if (format === 'rgba') {
    return colors.map(c => hexToRgba(c, alpha));
  }

  return colors;
}
