import { IJGISLayer } from '@jupytergis/schema';
import { IStopRow } from './symbologyDialog';
import colormap from 'colormap';

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

    const prefix = layer.parameters.type === 'circle' ? 'circle-' : '';

    if (!color[`${prefix}fill-color`]) {
      return [];
    }

    const valueColorPairs: IStopRow[] = [];

    // So if it's not a string then it's an array and we parse
    // Color[0] is the operator used for the color expression
    switch (color[`${prefix}fill-color`][0]) {
      case 'interpolate':
        // First element is interpolate for linear selection
        // Second element is type of interpolation (ie linear)
        // Third is input value that stop values are compared with
        // Fourth and on is value:color pairs
        for (let i = 3; i < color[`${prefix}fill-color`].length; i += 2) {
          const obj: IStopRow = {
            stop: color[`${prefix}fill-color`][i],
            output: color[`${prefix}fill-color`][i + 1]
          };
          valueColorPairs.push(obj);
        }
        break;
      case 'case':
        for (let i = 1; i < color[`${prefix}fill-color`].length - 1; i += 2) {
          const obj: IStopRow = {
            stop: color[`${prefix}fill-color`][i][2],
            output: color[`${prefix}fill-color`][i + 1]
          };
          valueColorPairs.push(obj);
        }
        break;
    }

    return valueColorPairs;
  };
}

export namespace Utils {
  export const getValueColorPairs = (
    stops: number[],
    selectedRamp: string,
    nClasses: number
  ) => {
    let colorMap = colormap({
      colormap: selectedRamp,
      nshades: nClasses > 9 ? nClasses : 9,
      format: 'rgba'
    });

    const valueColorPairs: IStopRow[] = [];

    // colormap requires 9 classes to generate the ramp
    // so we do some tomfoolery to make it work with less than 9 stops
    if (nClasses < 9) {
      const midIndex = Math.floor(nClasses / 2);

      // Get the first n/2 elements from the second array
      const firstPart = colorMap.slice(0, midIndex);

      // Get the last n/2 elements from the second array
      const secondPart = colorMap.slice(
        colorMap.length - (stops.length - firstPart.length)
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
