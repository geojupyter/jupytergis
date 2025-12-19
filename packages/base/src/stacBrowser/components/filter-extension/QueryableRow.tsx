import React from 'react';

import {
	Select,
	type ISelectItem,
} from '@/src/shared/components/Select';
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
  const currentOperator = operators.find(
    op => op.value === currentFilter.operator,
  );
  const buttonText = currentOperator?.label || 'Select operator...';

  const items: ISelectItem[] = operators.map(operator => ({
    value: String(operator.value),
    label: String(operator.label),
    onSelect: () => onOperatorChange(operator.value),
  }));

  return (
    <div className="jgis-queryable-row">
      <span>{qVal.title || qKey}</span>
      <Select
        items={items}
        buttonText={String(buttonText)}
        emptyText="No operator found."
        buttonClassName='jgis-queryable-combo-operator'
      />
      {inputComponent}
    </div>
  );
}

export default QueryableRow;
