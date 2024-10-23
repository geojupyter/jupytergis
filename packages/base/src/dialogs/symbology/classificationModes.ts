// Adapted from https://github.com/qgis/QGIS/blob/master/src/core/classification/

import { Pool, fromUrl, TypedArray } from 'geotiff';
import { InterpolationType } from './tiff_layer/types/SingleBandPseudoColor';

export namespace VectorClassifications {
  export const calculateQuantileBreaks = (
    values: number[],
    nClasses: number
  ) => {
    // q-th quantile of a data set:
    // value where q fraction of data is below and (1-q) fraction is above this value
    // Xq = (1 - r) * X_NI1 + r * X_NI2
    //   NI1 = (int) (q * (n+1))
    //   NI2 = NI1 + 1
    //   r = q * (n+1) - (int) (q * (n+1))
    // (indices of X: 1...n)

    const sortedValues = [...values].sort((a, b) => a - b);

    const breaks = [];

    if (!sortedValues) {
      return [];
    }

    const n = sortedValues.length;

    let xq: number = n > 0 ? sortedValues[0] : 0;

    for (let i = 1; i < nClasses; i++) {
      if (n > 1) {
        const q = i / nClasses;
        const a = q * (n - 1);
        const aa = Math.floor(a);

        const r = a - aa;
        xq = (1 - r) * sortedValues[aa] + r * sortedValues[aa + 1];
      }
      breaks.push(xq);
    }

    breaks.push(sortedValues[n - 1]);

    return breaks;
  };

  export const calculateEqualIntervalBreaks = (
    values: number[],
    nClasses: number
  ) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    const breaks: number[] = [];
    const step = (maximum - minimum) / nClasses;

    let value = minimum;

    for (let i = 0; i < nClasses; i++) {
      value += step;
      breaks.push(value);
    }

    breaks[nClasses - 1] = maximum;

    return breaks;
  };

  export const calculateJenksBreaks = (values: number[], nClasses: number) => {
    const maximum = Math.max(...values);

    if (values.length === 0) {
      return [];
    }

    if (nClasses <= 1) {
      return [maximum];
    }

    if (nClasses >= values.length) {
      return values;
    }

    const sample = [...values].sort((a, b) => a - b);
    const n = sample.length;

    const matrixOne = Array.from({ length: n + 1 }, () =>
      Array(nClasses + 1).fill(0)
    );
    const matrixTwo = Array.from({ length: n + 1 }, () =>
      Array(nClasses + 1).fill(Number.MAX_VALUE)
    );

    for (let i = 1; i <= nClasses; i++) {
      matrixOne[0][i] = 1;
      matrixOne[1][i] = 1;
      matrixTwo[0][i] = 0.0;

      for (let j = 2; j <= n; j++) {
        matrixTwo[j][i] = Number.MAX_VALUE;
      }
    }

    for (let l = 2; l <= n; l++) {
      let s1 = 0.0;
      let s2 = 0.0;
      let w = 0;
      let v = 0.0;

      for (let m = 1; m <= l; m++) {
        const i3 = l - m + 1;

        const val = sample[i3 - 1];

        s2 += val * val;
        s1 += val;
        w++;

        v = s2 - (s1 * s1) / w;
        const i4 = i3 - 1;
        if (i4 !== 0) {
          for (let j = 2; j <= nClasses; j++) {
            if (matrixTwo[l][j] >= v + matrixTwo[i4][j - 1]) {
              matrixOne[l][j] = i4;
              matrixTwo[l][j] = v + matrixTwo[i4][j - 1];
            }
          }
        }
      }
      matrixOne[l][1] = 1;
      matrixTwo[l][1] = v;
    }

    const breaks = Array(nClasses);
    breaks[nClasses - 1] = sample[n - 1];

    for (let j = nClasses, k = n; j >= 2; j--) {
      const id = matrixOne[k][j] - 1;
      breaks[j - 2] = sample[id];
      k = matrixOne[k][j] - 1;
    }

    return breaks;
  };

  export const calculatePrettyBreaks = (values: number[], nClasses: number) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    const breaks = [];

    if (nClasses < 1) {
      breaks.push(maximum);
      return breaks;
    }

    const minimumCount = Math.floor(nClasses / 3);
    const shrink = 0.75;
    const highBias = 1.5;
    const adjustBias = 0.5 + 1.5 * highBias;
    const divisions = nClasses;
    const h = highBias;
    let cell;
    let small = false;
    const dx = maximum - minimum;

    let U;
    cell = Math.max(Math.abs(minimum), Math.abs(maximum));
    if (adjustBias >= 1.5 * h + 0.5) {
      U = 1 + 1.0 / (1 + h);
    } else {
      U = 1 + 1.5 / (1 + adjustBias);
    }
    small = dx < cell * U * Math.max(1, divisions) * 1e-7 * 3.0;

    if (small) {
      if (cell > 10) {
        cell = 9 + cell / 10;
        cell = cell * shrink;
      }
      if (minimumCount > 1) {
        cell = cell / minimumCount;
      }
    } else {
      cell = dx;
      if (divisions > 1) {
        cell = cell / divisions;
      }
    }
    if (cell < 20 * 1e-7) {
      cell = 20 * 1e-7;
    }

    const base = Math.pow(10.0, Math.floor(Math.log10(cell)));
    let unit = base;
    if (2 * base - cell < h * (cell - unit)) {
      unit = 2.0 * base;
      if (5 * base - cell < adjustBias * (cell - unit)) {
        unit = 5.0 * base;
        if (10.0 * base - cell < h * (cell - unit)) {
          unit = 10.0 * base;
        }
      }
    }

    let start = Math.floor(minimum / unit + 1e-7);
    let end = Math.ceil(maximum / unit - 1e-7);

    while (start * unit > minimum + 1e-7 * unit) {
      start = start - 1;
    }
    while (end * unit < maximum - 1e-7 * unit) {
      end = end + 1;
    }

    let k = Math.floor(0.5 + end - start);
    if (k < minimumCount) {
      k = minimumCount - k;
      if (start >= 0) {
        end = end + k / 2;
        start = start - k / 2 + (k % 2);
      } else {
        start = start - k / 2;
        end = end + k / 2 + (k % 2);
      }
    }

    const minimumBreak = start * unit;
    const count = end - start;

    for (let i = 1; i < count + 1; i++) {
      breaks.push(minimumBreak + i * unit);
    }

    if (breaks.length === 0) {
      return breaks;
    }

    if (breaks[0] < minimum) {
      breaks[0] = minimum;
    }
    if (breaks[breaks.length - 1] > maximum) {
      breaks[breaks.length - 1] = maximum;
    }

    if (minimum < 0.0 && maximum > 0.0) {
      const breaksMinusZero = breaks.map(b => b - 0.0);

      let posOfMin = 0;
      for (let i = 1; i < breaks.length; i++) {
        if (
          Math.abs(breaksMinusZero[i]) < Math.abs(breaksMinusZero[posOfMin])
        ) {
          posOfMin = i;
        }
      }

      breaks[posOfMin] = 0.0; // Set the closest break to zero
    }

    return breaks;
  };

  export const calculateLogarithmicBreaks = (
    values: number[],
    nClasses: number
  ) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    let positiveMinimum = Number.MAX_VALUE;

    let breaks = [];

    positiveMinimum = minimum;

    const actualLogMin = Math.log10(positiveMinimum);
    let logMin = Math.floor(actualLogMin);
    const logMax = Math.ceil(Math.log10(maximum));

    let prettyBreaks = calculatePrettyBreaks([logMin, logMax], nClasses);

    while (prettyBreaks.length > 0 && prettyBreaks[0] < actualLogMin) {
      logMin += 1.0;
      prettyBreaks = calculatePrettyBreaks([logMin, logMax], nClasses);
    }

    breaks = prettyBreaks;

    for (let i = 0; i < breaks.length; i++) {
      breaks[i] = Math.pow(10, breaks[i]);
    }

    return breaks;
  };
}

export namespace GeoTiffClassifications {
  export const classifyQuantileBreaks = async (
    nClasses: number,
    bandNumber: number,
    url: string,
    colorRampType: string
  ) => {
    const breaks: number[] = [];
    const isDiscrete = colorRampType === 'discrete';

    const pool = new Pool();
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const values = await image.readRasters({ pool });

    // Band numbers are 1 indexed
    const bandValues = values[bandNumber - 1] as TypedArray;

    const bandSortedValues = bandValues
      .filter(value => value !== 0)
      .sort((a, b) => a - b);

    pool.destroy();

    if (!bandSortedValues) {
      return [];
    }

    // Adapted from https://github.com/GeoTIFF/geoblaze/blob/master/src/histogram/histogram.core.js#L64
    // iterate through values and use a counter to
    // decide when to set up the next bin.
    let numValuesInCurrentBin;
    let valuesPerBin;
    let startIndex;

    if (isDiscrete) {
      valuesPerBin = bandSortedValues.length / nClasses;
      numValuesInCurrentBin = 0;
      startIndex = 0;
    } else {
      valuesPerBin = bandSortedValues.length / (nClasses - 1);
      breaks.push(1);
      numValuesInCurrentBin = 1;
      startIndex = 1;
    }

    for (let i = startIndex; i < bandSortedValues.length; i++) {
      if (numValuesInCurrentBin + 1 < valuesPerBin) {
        numValuesInCurrentBin++;
      } else {
        breaks.push(bandSortedValues[i] as number);
        numValuesInCurrentBin = 0;
      }
    }

    if (breaks.length !== nClasses) {
      //TODO: This should be set based on the type of bandSortedValues I think
      breaks.push(65535);
    }

    return breaks;
  };

  export const classifyContinuousBreaks = (
    nClasses: number,
    minimumValue: number,
    maximumValue: number,
    colorRampType: InterpolationType
  ) => {
    const min = minimumValue;
    const max = maximumValue;

    if (min > max) {
      return [];
    }

    const isDiscrete = colorRampType === 'discrete';

    const breaks: number[] = [];

    const numberOfEntries = nClasses;
    if (isDiscrete) {
      const intervalDiff =
        ((max - min) * (numberOfEntries - 1)) / numberOfEntries;

      for (let i = 1; i < numberOfEntries; i++) {
        const val = i / numberOfEntries;
        breaks.push(min + val * intervalDiff);
      }
      breaks.push(max);
    } else {
      for (let i = 0; i <= numberOfEntries; i++) {
        if (i === 26) {
          continue;
        }
        const val = i / numberOfEntries;
        breaks.push(min + val * (max - min));
      }
    }

    return breaks;
  };

  export const classifyEqualIntervalBreaks = (
    nClasses: number,
    minimumValue: number,
    maximumValue: number,
    colorRampType: InterpolationType
  ) => {
    const min = minimumValue;
    const max = maximumValue;

    if (min > max) {
      return [];
    }

    const isDiscrete = colorRampType === 'discrete';

    const breaks: number[] = [];

    if (isDiscrete) {
      const intervalDiff = (max - min) / nClasses;

      for (let i = 1; i < nClasses; i++) {
        breaks.push(min + i * intervalDiff);
      }
      breaks.push(max);
    } else {
      const intervalDiff = (max - min) / (nClasses - 1);

      for (let i = 0; i < nClasses; i++) {
        breaks.push(min + i * intervalDiff);
      }
    }

    return breaks;
  };
}
