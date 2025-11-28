import React, { useState } from 'react';

interface IQueryableRowProps {
  qKey: string;
  qVal: any;
}

type Operator = 'eq' | 'neq' | 'lt' | 'gt';

interface IOperatorOption {
  value: Operator;
  label: string;
}

function QueryableRow({ qKey, qVal }: IQueryableRowProps) {
  const getOperatorsForType = (
    type: string,
    format?: string,
  ): IOperatorOption[] => {
    if (format === 'date-time') {
      return [
        { value: 'lt', label: 'less than' },
        { value: 'gt', label: 'greater than' },
      ];
    }

    switch (type) {
      case 'string':
        return [
          { value: 'eq', label: 'equal to' },
          { value: 'neq', label: 'not equal to' },
        ];
      case 'number':
        return [
          { value: 'eq', label: 'equal to' },
          { value: 'neq', label: 'not equal to' },
          { value: 'lt', label: 'less than' },
          { value: 'gt', label: 'greater than' },
        ];
      default:
        return [
          { value: 'eq', label: 'equal to' },
          { value: 'neq', label: 'not equal to' },
        ];
    }
  };

  const operators = getOperatorsForType(qVal.type, qVal.format);
  const [selectedOperator, setSelectedOperator] = useState<Operator>(
    operators[0]?.value || 'eq',
  );

  const getInputBasedOnType = (val: any): React.ReactNode => {
    switch (val.type) {
      case 'string':
        if (val.enum) {
          return (
            <select
              style={{ maxWidth: '75px' }}
              {...(val.pattern && { 'data-pattern': val.pattern })}
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
              {...(val.pattern && { 'data-pattern': val.pattern })}
            />
          );
        }
        return (
          <input
            type="text"
            style={{ maxWidth: '75px' }}
            {...(val.pattern && { 'data-pattern': val.pattern })}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            style={{ maxWidth: '75px' }}
            min={val.min !== undefined ? val.min : undefined}
            max={val.max !== undefined ? val.max : undefined}
            {...(val.pattern && { 'data-pattern': val.pattern })}
          />
        );
      default:
        return (
          <input
            type=""
            style={{ maxWidth: '75px' }}
            {...(val.pattern && { 'data-pattern': val.pattern })}
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
        value={selectedOperator}
        onChange={e => setSelectedOperator(e.target.value as Operator)}
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
