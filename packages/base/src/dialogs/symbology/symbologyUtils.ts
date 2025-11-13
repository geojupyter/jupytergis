import { IJGISLayer } from '@jupytergis/schema';
import colormap from 'colormap';

import { ColorRampName } from './colorRampUtils';
import { IStopRow } from './symbologyDialog';

const COLOR_EXPR_STOPS_START = 3;
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
          for (let i = COLOR_EXPR_STOPS_START; i < color[key].length; i += 2) {
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

    if (
      !Array.isArray(circleRadius) ||
      circleRadius.length <= COLOR_EXPR_STOPS_START
    ) {
      return [];
    }

    for (let i = COLOR_EXPR_STOPS_START; i < circleRadius.length; i += 2) {
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
    selectedRamp: ColorRampName,
    nClasses: number,
    reverse = false,
  ) => {
    let colorMap = colormap({
      colormap: selectedRamp,
      nshades: nClasses > 9 ? nClasses : 9,
      format: 'rgba',
    });

    if (reverse) {
      colorMap = [...colorMap].reverse();
    }

    const valueColorPairs: IStopRow[] = [];

    // colormap requires 9 classes to generate the ramp
    // so we do some tomfoolery to make it work with less than 9 stops
    if (nClasses < 9) {
      const midIndex = Math.floor(nClasses / 2);

      // Get the first n/2 elements from the second array
      const firstPart = colorMap.slice(0, midIndex);

      // Get the last n/2 elements from the second array
      const secondPart = colorMap.slice(
        colorMap.length - (stops.length - firstPart.length),
      );

      // Create the new array by combining the first and last parts
      colorMap = firstPart.concat(secondPart);
    }

    for (let i = 0; i < nClasses; i++) {
      valueColorPairs.push({ stop: stops[i], output: colorMap[i] });
    }

    return valueColorPairs;
  };
}
