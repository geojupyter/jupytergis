// Adapted from https://github.com/qgis/QGIS/blob/master/src/core/classification/qgsclassificationquantile.cpp#L48
export const calculateQuantileBreaks = (
  values: any[],
  numOfClasses: number
) => {
  // q-th quantile of a data set:
  // value where q fraction of data is below and (1-q) fraction is above this value
  // Xq = (1 - r) * X_NI1 + r * X_NI2
  //   NI1 = (int) (q * (n+1))
  //   NI2 = NI1 + 1
  //   r = q * (n+1) - (int) (q * (n+1))
  // (indices of X: 1...n)

  console.log('values', values);
  const sortedValues = [...values].sort((a, b) => a - b);

  const breaks = [];

  if (!sortedValues) {
    return [];
  }

  const n = sortedValues.length;

  let xq = n > 0 ? sortedValues[0] : 0;

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
