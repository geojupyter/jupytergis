import React from 'react';

import {
  IQueryableFilter,
  IStacQueryableSchema,
  Operator,
} from '@/src/features/stac-browser/types/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/shared/components/Select';

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
  const items = operators.map(operator => ({
    value: String(operator.value),
    label: operator.label,
  }));

  return (
    <div className="jgis-queryable-row">
      <span>{qVal.title || qKey}</span>
      <Select
        value={String(currentFilter.operator)}
        onValueChange={value => onOperatorChange(value as Operator)}
        items={items}
      >
        <SelectTrigger className="jgis-queryable-combo-operator w-full max-w-none">
          <SelectValue placeholder="Select operator..." />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {inputComponent}
    </div>
  );
}

export default QueryableRow;
