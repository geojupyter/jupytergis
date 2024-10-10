// Adapted from https://github.com/qgis/QGIS/blob/master/src/core/classification/

export namespace VectorClassifications {
  export const calculateQuantileBreaks = (
    values: number[],
    numOfClasses: number
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

    for (let i = 1; i < numOfClasses; i++) {
      if (n > 1) {
        const q = i / numOfClasses;
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
    numOfClasses: number
  ) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    const breaks: number[] = [];
    const step = (maximum - minimum) / numOfClasses;

    let value = minimum;

    for (let i = 0; i < numOfClasses; i++) {
      value += step;
      breaks.push(value);
    }

    breaks[numOfClasses - 1] = maximum;

    return breaks;
  };

  export const calculateJenksBreaks = (
    values: number[],
    numOfClasses: number
  ) => {
    const maximum = Math.max(...values);

    if (values.length === 0) {
      return [];
    }

    if (numOfClasses <= 1) {
      return [maximum];
    }

    if (numOfClasses >= values.length) {
      return values;
    }

    const sample = [...values].sort((a, b) => a - b);
    const n = sample.length;

    const matrixOne = Array.from({ length: n + 1 }, () =>
      Array(numOfClasses + 1).fill(0)
    );
    const matrixTwo = Array.from({ length: n + 1 }, () =>
      Array(numOfClasses + 1).fill(Number.MAX_VALUE)
    );

    for (let i = 1; i <= numOfClasses; i++) {
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
          for (let j = 2; j <= numOfClasses; j++) {
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

    const breaks = Array(numOfClasses);
    breaks[numOfClasses - 1] = sample[n - 1];

    for (let j = numOfClasses, k = n; j >= 2; j--) {
      const id = matrixOne[k][j] - 1;
      breaks[j - 2] = sample[id];
      k = matrixOne[k][j] - 1;
    }

    return breaks;
  };

  export const calculatePrettyBreaks = (values: number[], classes: number) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    const breaks = [];

    if (classes < 1) {
      breaks.push(maximum);
      return breaks;
    }

    const minimumCount = Math.floor(classes / 3);
    const shrink = 0.75;
    const highBias = 1.5;
    const adjustBias = 0.5 + 1.5 * highBias;
    const divisions = classes;
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
    nclasses: number
  ) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    let positiveMinimum = Number.MAX_VALUE;

    let breaks = [];

    positiveMinimum = minimum;

    const actualLogMin = Math.log10(positiveMinimum);
    let logMin = Math.floor(actualLogMin);
    const logMax = Math.ceil(Math.log10(maximum));

    let prettyBreaks = calculatePrettyBreaks([logMin, logMax], nclasses);

    while (prettyBreaks.length > 0 && prettyBreaks[0] < actualLogMin) {
      logMin += 1.0;
      prettyBreaks = calculatePrettyBreaks([logMin, logMax], nclasses);
    }

    breaks = prettyBreaks;

    for (let i = 0; i < breaks.length; i++) {
      breaks[i] = Math.pow(10, breaks[i]);
    }

    return breaks;
  };
}

export namespace GeoTiffClassifications {
  export const classifyColorRamp = (
    nclasses: number,
    band: number,
    minimumValue: number,
    maximumValue: number,
    colorRampType: string,
    sourceColorRamp: number[][],
    classificationMode: string,
    setColorRampItemList: (item: any) => void
    // extent: number[]
  ) => {
    const min = minimumValue;
    const max = maximumValue;

    if (min > max) {
      return;
    }

    const discrete = colorRampType === 'Discrete';
    const entryValues = [];
    const entryColors: number[] = [];

    if (min === max) {
      if (sourceColorRamp && sourceColorRamp.length > 1) {
        entryValues.push(min);
        if (discrete) {
          entryValues.push(Infinity);
        }
        for (let i = 0; i < entryValues.length; i++) {
          // entryColors.push(sourceColorRamp().color(sourceColorRamp().value(i)));
        }
      }
    } else {
      // Using switch statement for classificationMode
      switch (classificationMode) {
        case 'Continuous':
          handleContinuousMode();
          break;

        case 'Quantile':
          if (nclasses < 2) {
            return; // Prevent crash if classes < 2
          }
          handleQuantileMode();
          break;

        case 'EqualInterval':
          if (nclasses < 2) {
            return; // Prevent crash if classes < 2
          }
          handleEqualIntervalMode();
          break;

        default:
          // Handle any unexpected classification modes if necessary
          console.warn('Unsupported classification mode');
          return;
      }

      // Handle sourceColorRamp cases (color mapping)
      if (!sourceColorRamp || sourceColorRamp.length === 1) {
        createDefaultColorRamp();
      } else {
        for (let i = 0; i < nclasses; i++) {
          // entryColors.push(sourceColorRamp[i]);
        }
      }
    }

    // Calculate number of decimals
    const maxabs = Math.log10(Math.max(Math.abs(max), Math.abs(min)));
    const nDecimals = Math.round(
      Math.max(
        3.0 + maxabs - Math.log10(max - min),
        maxabs <= 15.0 ? maxabs + 0.49 : 0
      )
    );

    // Create ColorRampItems
    const colorRampItems = entryValues.map((value, index) => ({
      value: value,
      color: entryColors[index],
      label: value.toFixed(nDecimals)
    }));

    // Sort colorRampItems and set the list
    colorRampItems.sort((a, b) => a.value - b.value);
    setColorRampItemList(colorRampItems);

    // Helper Functions

    function handleContinuousMode(discrete: boolean) {
      let numberOfEntries = sourceColorRamp.length;
      if (discrete) {
        let intervalDiff = max - min;
        if (discrete) {
          numberOfEntries--;
        } else {
          intervalDiff *= (numberOfEntries - 1) / numberOfEntries;
        }

        for (let i = 1; i < numberOfEntries; i++) {
          const value = sourceColorRamp().value(i);
          entryValues.push(min + value * intervalDiff);
        }
        entryValues.push(Infinity);
      } else {
        for (let i = 0; i < numberOfEntries; i++) {
          const value = sourceColorRamp().value(i);
          entryValues.push(min + value * (max - min));
        }
      }

      for (let i = 0; i < numberOfEntries; i++) {
        entryColors.push(sourceColorRamp().color(sourceColorRamp().value(i)));
      }
    }

    function handleQuantileMode() {
      let cut1 = NaN,
        cut2 = NaN;
      const sampleSize = 250000 * 10;

      input.cumulativeCut(band, 0.0, 1.0, min, max, extent, sampleSize);

      if (discrete) {
        const intervalDiff = 1.0 / classes;
        for (let i = 1; i < classes; i++) {
          input.cumulativeCut(
            band,
            0.0,
            i * intervalDiff,
            cut1,
            cut2,
            extent,
            sampleSize
          );
          entryValues.push(cut2);
        }
        entryValues.push(Infinity);
      } else {
        const intervalDiff = 1.0 / (classes - 1);
        for (let i = 0; i < classes; i++) {
          input.cumulativeCut(
            band,
            0.0,
            i * intervalDiff,
            cut1,
            cut2,
            extent,
            sampleSize
          );
          entryValues.push(cut2);
        }
      }
    }

    function handleEqualIntervalMode() {
      const intervalDiff = (max - min) / (discrete ? classes : classes - 1);
      for (let i = discrete ? 1 : 0; i < classes; i++) {
        entryValues.push(min + i * intervalDiff);
      }
      if (discrete) entryValues.push(Infinity);
    }

    function createDefaultColorRamp() {
      const colorDiff = classes !== 0 ? Math.floor(255 / classes) : 0;
      for (let i = 0; i < classes; i++) {
        const r = colorDiff * i;
        const b = 255 - colorDiff * i;
        entryColors.push(`rgb(${r}, 0, ${b})`);
      }
    }
  };
}
