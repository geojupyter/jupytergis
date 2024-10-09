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
