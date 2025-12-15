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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0',
      }}
    >
      <span>{qVal.title || qKey}</span>
      <select
        value={currentFilter.operator}
        onChange={e => onOperatorChange(e.target.value as Operator)}
        style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          border: '1px solid var(--jp-border-color0)',
          fontSize: '0.875rem',
        }}
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
