import { format } from 'date-fns';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/src/shared/components/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import QueryableRow from '@/src/stacBrowser/components/filter-extension/QueryableRow';
import {
  IQueryableFilter,
  IStacQueryableSchema,
  IStacQueryables,
  Operator,
  UpdateSelectedQueryables,
} from '@/src/stacBrowser/types/types';

interface IQueryableComboProps {
  queryables: IStacQueryables;
  selectedQueryables: Record<string, IQueryableFilter>;
  updateSelectedQueryables: UpdateSelectedQueryables;
}

interface IOperatorOption {
  value: Operator;
  label: string;
}

export function QueryableComboBox({
  queryables,
  selectedQueryables,
  updateSelectedQueryables,
}: IQueryableComboProps) {
  const [open, setOpen] = useState(false);

  // Derive selected items from selectedQueryables
  const selectedItems = useMemo(() => {
    return queryables.filter(([key]) => key in selectedQueryables);
  }, [queryables, selectedQueryables]);

  const handleSelect = (key: string, val: IStacQueryableSchema) => {
    const isCurrentlySelected = key in selectedQueryables;

    if (isCurrentlySelected) {
      // Remove if already selected - pass null to explicitly remove
      updateSelectedQueryables(key, null);
    } else {
      // Add if not selected - initialize with default filter
      const operators = getOperatorsForType(val.type, val.format);

      let initialInputValue: string | number | undefined = undefined;

      // For enum types, set the first option since the UI looks like there's a selection
      if (val.enum && val.enum.length > 0) {
        initialInputValue =
          typeof val.enum[0] === 'number' ? val.enum[0] : val.enum[0];
      } else if (val.type === 'string' && val.format === 'date-time') {
        // For datetime types, set to current UTC time
        initialInputValue = new Date().toISOString();
      }

      updateSelectedQueryables(key, {
        operator: operators[0]?.value || '=',
        inputValue: initialInputValue,
      });
    }

    setOpen(false);
  };

  const getOperatorsForType = (
    type: string | undefined,
    format?: string,
  ): IOperatorOption[] => {
    if (format === 'date-time') {
      return [
        { value: '<', label: '<' },
        { value: '<=', label: '≤' },
        { value: '>', label: '>' },
        { value: '>=', label: '≥' },
      ];
    }

    switch (type) {
      case 'string':
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
        ];
      case 'number':
      case 'integer':
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
          { value: '<', label: '<' },
          { value: '<=', label: '≤' },
          { value: '>', label: '>' },
          { value: '>=', label: '≥' },
        ];
      default:
        return [
          { value: '=', label: '=' },
          { value: '!=', label: '≠' },
        ];
    }
  };

  const getInputBasedOnType = (
    val: IStacQueryableSchema,
    currentValue: string | number | undefined,
    onChange: (value: string | number) => void,
  ): React.ReactNode => {
    switch (val.type) {
      case 'string':
        if (val.enum) {
          return (
            <select
              style={{ maxWidth: '75px' }}
              value={String(currentValue || '')}
              onChange={e => onChange(e.target.value)}
            >
              {val.enum.map(option => (
                <option key={String(option)} value={String(option)}>
                  {String(option)}
                </option>
              ))}
            </select>
          );
        }
        if (val.format === 'date-time') {
          // Convert UTC ISO string to local datetime format for display
          // datetime-local expects format: YYYY-MM-DDTHH:mm
          const formatForInput = (isoString: string | undefined): string => {
            if (!isoString) {
              return '';
            }
            try {
              const date = new Date(isoString);
              return format(date, "yyyy-MM-dd'T'HH:mm");
            } catch {
              return '';
            }
          };

          return (
            <input
              type="datetime-local"
              style={{ maxWidth: '75px' }}
              value={formatForInput(currentValue as string)}
              onChange={e => onChange(e.target.value)}
            />
          );
        }
        return (
          <input
            type="text"
            style={{ maxWidth: '75px' }}
            value={(currentValue as string) || ''}
            onChange={e => onChange(e.target.value)}
          />
        );
      case 'number':
      case 'integer':
        if (val.enum) {
          return (
            <select
              style={{ maxWidth: '75px' }}
              value={String(currentValue || '')}
              onChange={e => onChange(Number(e.target.value))}
            >
              {val.enum.map(option => (
                <option key={String(option)} value={String(option)}>
                  {String(option)}
                </option>
              ))}
            </select>
          );
        }
        return (
          <input
            type="number"
            style={{ maxWidth: '75px' }}
            min={val.minimum !== undefined ? val.minimum : undefined}
            max={val.maximum !== undefined ? val.maximum : undefined}
            value={(currentValue as number) || ''}
            onChange={e => onChange(Number(e.target.value))}
          />
        );
      default:
        return (
          <input
            type=""
            style={{ maxWidth: '75px' }}
            value={(currentValue as string) || ''}
            onChange={e => onChange(e.target.value)}
          />
        );
    }
  };

  const getButtonText = () => {
    if (selectedItems.length === 0) {
      return 'Select queryable...';
    }
    if (selectedItems.length === 1) {
      return selectedItems[0][1].title || selectedItems[0][0] || 'Queryable';
    }
    return `${selectedItems.length} selected`;
  };

  const isSelected = (key: string) => {
    return key in selectedQueryables;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            style={{
              width: '200px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            {getButtonText()}
            <ChevronsUpDownIcon
              style={{
                marginLeft: '0.5rem',
                height: '1rem',
                width: '1rem',
                flexShrink: 0,
                opacity: 0.5,
              }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent style={{ width: '200px', padding: 0 }}>
          <Command>
            <CommandInput placeholder="Search queryable..." />
            <CommandList>
              <CommandEmpty>No queryable found.</CommandEmpty>
              <CommandGroup>
                {queryables.map(([key, val]) => (
                  <CommandItem
                    key={key}
                    value={val.title || key}
                    onSelect={() => {
                      handleSelect(key, val);
                    }}
                  >
                    <CheckIcon
                      style={{
                        marginRight: '0.5rem',
                        height: '1rem',
                        width: '1rem',
                        opacity: isSelected(key) ? 1 : 0,
                      }}
                    />
                    {val.title || key}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedItems.map(([key, val]) => {
        const operators = getOperatorsForType(val.type, val.format);
        const currentFilter: IQueryableFilter = selectedQueryables[key] ?? {
          operator: operators[0]?.value || '=',
          inputValue: undefined,
        };

        const handleInputChange = (value: string | number) => {
          // For datetime values, convert local time to UTC ISO string
          let valueToStore: string | number = value;
          if (
            val.type === 'string' &&
            val.format === 'date-time' &&
            typeof value === 'string'
          ) {
            try {
              // Parse local time and convert to UTC ISO string
              const localDate = new Date(value);
              valueToStore = localDate.toISOString();
            } catch {
              valueToStore = value;
            }
          }

          updateSelectedQueryables(key, {
            ...currentFilter,
            inputValue: valueToStore,
          });
        };

        const handleOperatorChange = (operator: Operator) => {
          updateSelectedQueryables(key, {
            ...currentFilter,
            operator,
          });
        };

        return (
          <QueryableRow
            key={key}
            qKey={key}
            qVal={val}
            operators={operators}
            currentFilter={currentFilter}
            inputComponent={getInputBasedOnType(
              val,
              currentFilter.inputValue,
              handleInputChange,
            )}
            onOperatorChange={handleOperatorChange}
          />
        );
      })}
    </div>
  );
}
