import React, { useState } from 'react';

import { Combobox } from '@/src/shared/components/Combobox';
import { CommandItem } from '@/src/shared/components/Command';
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
  const [operatorComboboxOpen, setOperatorComboboxOpen] = useState(false);

  const currentOperator = operators.find(
    op => op.value === currentFilter.operator,
  );
  const buttonText = currentOperator?.label || 'Select operator...';

  return (
    <div className="jgis-queryable-row">
      <span>{qVal.title || qKey}</span>
      <Combobox
        buttonText={String(buttonText)}
        emptyText="No operator found."
        open={operatorComboboxOpen}
        onOpenChange={setOperatorComboboxOpen}
        showSearch={false}
      >
        {operators.map(operator => (
          <CommandItem
            key={operator.value}
            value={String(operator.label)}
            onSelect={() => {
              onOperatorChange(operator.value);
              setOperatorComboboxOpen(false);
            }}
          >
            {operator.label}
          </CommandItem>
        ))}
      </Combobox>
      {inputComponent}
    </div>
  );
}

export default QueryableRow;
