import React, { useEffect, useState } from 'react';

import {
  IQueryableFilter,
  Operator,
  UpdateSelectedQueryables,
} from '@/src/stacBrowser/hooks/useStacFilterExtension';

interface IQueryableRowProps {
  qKey: string;
  qVal: any;
  updateSelectedQueryables: UpdateSelectedQueryables;
}

interface IOperatorOption {
  value: Operator;
  label: string | React.ReactNode;
}

function QueryableRow({
  qKey,
  qVal,
  updateSelectedQueryables,
}: IQueryableRowProps) {
  const getOperatorsForType = (
    type: string,
    format?: string,
  ): IOperatorOption[] => {
    if (format === 'date-time') {
      return [
        { value: '<', label: '<' },
        { value: '>', label: '>' },
      ];
    }

    switch (type) {
      case 'string':
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
        ];
      case 'number':
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
          { value: '<', label: '<' },
          { value: '>', label: '>' },
        ];
      default:
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
        ];
    }
  };

  const operators = getOperatorsForType(qVal.type, qVal.format);

  // Local state for UI, synced to parent via callback
  const [localFilter, setLocalFilter] = useState<IQueryableFilter>({
    operator: operators[0]?.value || '=',
    inputValue: undefined,
  });

  // Sync local state to parent whenever it changes
  useEffect(() => {
    updateSelectedQueryables(qKey, localFilter);
  }, [qKey, localFilter, updateSelectedQueryables]);

  const handleInputChange = (value: string | number) => {
    setLocalFilter(prev => ({
      ...prev,
      inputValue: value,
    }));
  };

  const handleOperatorChange = (operator: Operator) => {
    setLocalFilter(prev => ({
      ...prev,
      operator,
    }));
  };

  const getInputBasedOnType = (val: any): React.ReactNode => {
    const currentValue = localFilter.inputValue;

    switch (val.type) {
      case 'string':
        if (val.enum) {
          return (
            <select
              style={{ maxWidth: '75px' }}
              value={(currentValue as string) || ''}
              onChange={e => handleInputChange(e.target.value)}
            >
              {val.enum.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        }
        if (val.format === 'date-time') {
          return (
            <input
              type="datetime-local"
              style={{ maxWidth: '75px' }}
              value={(currentValue as string) || ''}
              onChange={e => handleInputChange(e.target.value)}
            />
          );
        }
        return (
          <input
            type="text"
            style={{ maxWidth: '75px' }}
            value={(currentValue as string) || ''}
            onChange={e => handleInputChange(e.target.value)}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            style={{ maxWidth: '75px' }}
            min={val.min !== undefined ? val.min : undefined}
            max={val.max !== undefined ? val.max : undefined}
            value={(currentValue as number) || ''}
            onChange={e => handleInputChange(Number(e.target.value))}
          />
        );
      default:
        return (
          <input
            type=""
            style={{ maxWidth: '75px' }}
            value={(currentValue as string) || ''}
            onChange={e => handleInputChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0',
      }}
    >
      <span>{qVal.title}</span>
      <select
        value={localFilter.operator}
        onChange={e => handleOperatorChange(e.target.value as Operator)}
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
      {getInputBasedOnType(qVal)}
    </div>
  );
}

export default QueryableRow;
