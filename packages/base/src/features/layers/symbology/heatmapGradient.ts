/**
 * Heatmap gradient shared by every map adapter.
 *
 * A KDE (heatmap) grammar layer stores its color ramp as a `pixel-color`
 * colorMap mapping. OpenLayers and MapLibre both draw heatmaps from a plain
 * list of colors, so the extraction lives here instead of in either adapter.
 */

import { IEncodingRule } from '@jupytergis/schema';

import { getColorMap } from './colorRampUtils';

// Default OL heatmap gradient (cool → warm).
export const DEFAULT_HEATMAP_GRADIENT = [
  '#00f',
  '#0ff',
  '#0f0',
  '#ff0',
  '#f00',
];

/**
 * Look for a pixel-color colorRamp mapping in the rules and convert it to a
 * gradient string array.  Returns undefined when absent.
 */
export function extractHeatmapGradient(
  rules: IEncodingRule[],
): string[] | undefined {
  for (const rule of rules) {
    for (const mapping of rule.mappings) {
      const isPixelEncoding = (mapping.encodings as string[]).some(
        ch => ch === 'pixel-color' || ch.startsWith('pixel-'),
      );
      if (!isPixelEncoding || mapping.scale.scheme !== 'colorMap') {
        continue;
      }

      // Prefer explicit colorStops when present (e.g. a heatmap round-tripped
      // through QGIS, which stores the gradient as stops rather than a named
      // ramp). Without this the unknown name falls through to DEFAULT_GRADIENT
      // (a blue→red ramp), so a viridis heatmap would render with a red core.
      const colorStops = (mapping.scale.params as any).colorStops as
        | { stop: number; color: [number, number, number, number] }[]
        | undefined;
      if (Array.isArray(colorStops) && colorStops.length > 0) {
        const stops = [...colorStops].sort((a, b) => a.stop - b.stop);
        return stops.map(({ color: [r, g, b, a = 1] }) => {
          return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
        });
      }

      const colorMap = getColorMap(mapping.scale.params.name as any);
      if (!colorMap || colorMap.colors.length === 0) {
        continue;
      }

      // Sample 5 evenly spaced stops from the 255-entry color array.
      const n = 5;
      const colors = colorMap.colors;
      const step = (colors.length - 1) / (n - 1);
      const gradient = Array.from(
        { length: n },
        (_, i) => colors[Math.round(i * step)],
      );
      return mapping.scale.params.reverse ? [...gradient].reverse() : gradient;
    }
  }
  return undefined;
}
