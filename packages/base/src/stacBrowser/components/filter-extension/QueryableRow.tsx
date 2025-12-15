import React from 'react';

import {
  IQueryableFilter,
  IStacQueryableSchema,
  Operator,
} from '@/src/stacBrowser/types/types';

interface IOperatorOption {
  value: Operator;
  label: string | React.ReactNode;
}

interface IQueryableRowProps {
  qKey: string;
  qVal: IStacQueryableSchema;
  operators: IOperatorOption[];
  currentFilter: IQueryableFilter;
  inputComponent: React.ReactNode;
  onOperatorChange: (operator: Operator) => void;
}

function QueryableRow({
  qKey,
  qVal,
  operators,
  currentFilter,
  inputComponent,
  onOperatorChange,
}: IQueryableRowProps) {
  return (
    <div className="jgis-queryable-row">
      <span>{qVal.title || qKey}</span>
      <select
        className="jgis-queryable-row-select"
        value={currentFilter.operator}
        onChange={e => onOperatorChange(e.target.value as Operator)}
      >
        {operators.map(operator => (
          <option key={operator.value} value={operator.value}>
            {operator.label}
          </option>
        ))}
      </select>
      {inputComponent}
    </div>
  );
}

export default QueryableRow;
