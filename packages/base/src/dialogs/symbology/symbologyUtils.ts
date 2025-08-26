import { IJGISLayer } from '@jupytergis/schema';
import colormap from 'colormap';

import { IStopRow } from './symbologyDialog';

const MAPBOX_INDEX = 3;
export namespace VectorUtils {
  export const buildColorInfo = (layer: IJGISLayer) => {
    // This it to parse a color object on the layer
    if (!layer.parameters?.color) {
      return [];
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return [];
    }

    const keys = ['fill-color', 'circle-fill-color'];
    const valueColorPairs: IStopRow[] = [];
    const seenPairs = new Set<string>();

    for (const key of keys) {
      if (!color[key]) {
        continue;
      }

      switch (color[key][0]) {
        case 'interpolate':
          // First element is interpolate for linear selection
          // Second element is type of interpolation (ie linear)
          // Third is input value that stop values are compared with
          // Fourth and on is value:color pairs
          for (let i = MAPBOX_INDEX; i < color[key].length; i += 2) {
            const pairKey = `${color[key][i]}-${color[key][i + 1]}`;
            if (!seenPairs.has(pairKey)) {
              valueColorPairs.push({
                stop: color[key][i],
                output: color[key][i + 1],
              });
              seenPairs.add(pairKey);
            }
          }
          break;

        case 'case':
          for (let i = 1; i < color[key].length - 1; i += 2) {
            const pairKey = `${color[key][i][2]}-${color[key][i + 1]}`;
            if (!seenPairs.has(pairKey)) {
              valueColorPairs.push({
                stop: color[key][i][2],
                output: color[key][i + 1],
              });
              seenPairs.add(pairKey);
            }
          }
          break;
      }
    }

    return valueColorPairs;
  };

  export const buildRadiusInfo = (layer: IJGISLayer) => {
    if (!layer.parameters?.color) {
      return [];
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return [];
    }

    const stopOutputPairs: IStopRow[] = [];

    const circleRadius = color['circle-radius'];

    if (!Array.isArray(circleRadius) || circleRadius.length <= MAPBOX_INDEX) {
      return [];
    }

    for (let i = MAPBOX_INDEX; i < circleRadius.length; i += 2) {
      const obj: IStopRow = {
        stop: circleRadius[i],
        output: circleRadius[i + 1],
      };
      stopOutputPairs.push(obj);
    }

    return stopOutputPairs;
  };
}

export namespace Utils {
  export const getValueColorPairs = (
    stops: number[],
    selectedRamp: string,
    nClasses: number,
  ) => {
    const colorMap = colormap({
      colormap: selectedRamp,
      nshades: 256,
      format: 'rgba',
    });

    const valueColorPairs: IStopRow[] = [];

    // colormap requires 9 classes to generate the ramp
    for (let i = 0; i < nClasses; i++) {
      // Pick evenly spaced colors from the 256-shade ramp
      const idx = Math.floor((i / (nClasses - 1)) * (colorMap.length - 1));
      valueColorPairs.push({ stop: stops[i], output: colorMap[idx] });
    }

    return valueColorPairs;
  };
}
