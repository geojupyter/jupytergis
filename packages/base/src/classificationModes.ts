// Adapted from https://github.com/qgis/QGIS/blob/master/src/core/classification/

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

  for (let i = 0; i < numOfClasses; i++) {
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
