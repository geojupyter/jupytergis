import React from 'react';

import {
  IQueryableFilter,
  IStacQueryableSchema,
  Operator,
} from '@/src/features/stac-browser/types/types';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

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
      <NativeSelect
        value={String(currentFilter.operator)}
        onChange={event => {
          onOperatorChange(event.target.value as Operator);
        }}
      >
        {operators.map(operator => (
          <NativeSelectOption key={operator.value} value={operator.value}>
            {operator.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {inputComponent}
    </div>
  );
}

export default QueryableRow;
