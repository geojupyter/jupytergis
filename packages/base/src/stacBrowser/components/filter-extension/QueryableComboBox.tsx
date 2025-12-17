import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import { Combobox } from '@/src/shared/components/Combobox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/src/shared/components/Command';
import { Input } from '@/src/shared/components/Input';
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
import SingleDatePicker from '../../../shared/components/SingleDatePicker';

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
          const selectedOption = val.enum.find(
            opt => String(opt) === String(currentValue),
          );
          const buttonText = selectedOption
            ? String(selectedOption)
            : 'Select option...';

          return (
            <Combobox
              buttonText={buttonText}
              emptyText="No option found."
              buttonClassName="jgis-queryable-combo-input"
              showSearch={false}
            >
              {val.enum.map(option => (
                <CommandItem
                  key={String(option)}
                  value={String(option)}
                  onSelect={() => onChange(String(option))}
                >
                  {String(option)}
                </CommandItem>
              ))}
            </Combobox>
          );
        }
        if (val.format === 'date-time') {
          // Convert UTC ISO string to Date object for SingleDatePicker
          const parseDate = (
            isoString: string | undefined,
          ): Date | undefined => {
            if (!isoString) {
              return undefined;
            }
            try {
              return new Date(isoString);
            } catch {
              return undefined;
            }
          };

          // Convert Date object back to ISO string for storage
          const handleDateChange = (date: Date | undefined) => {
            if (date) {
              onChange(date.toISOString());
            } else {
              onChange('');
            }
          };

          return (
            <SingleDatePicker
              date={parseDate(currentValue as string | undefined)}
              onDateChange={handleDateChange}
              dateFormat="P"
              showIcon={true}
              placeholder="Select date"
              className="jgis-queryable-combo-input jgis-queryable-combo-input-date-picker"
            />
          );
        }
        return (
          <Input
            type="text"
            className="jgis-queryable-combo-input"
            // style={{borderRadius: 0}}
            value={(currentValue as string) || ''}
            onChange={e => onChange(e.target.value)}
          />
        );
      case 'number':
      case 'integer':
        if (val.enum) {
          const selectedOption = val.enum.find(
            opt => Number(opt) === Number(currentValue),
          );
          const buttonText = selectedOption
            ? String(selectedOption)
            : 'Select option...';

          return (
            <Combobox
              buttonText={buttonText}
              emptyText="No option found."
              buttonClassName="jgis-queryable-combo-input"
              showSearch={false}
            >
              {val.enum.map(option => (
                <CommandItem
                  key={String(option)}
                  value={String(option)}
                  onSelect={() => onChange(Number(option))}
                >
                  {String(option)}
                </CommandItem>
              ))}
            </Combobox>
          );
        }
        return (
          <Input
            type="number"
            className="jgis-queryable-combo-input"
            min={val.minimum !== undefined ? val.minimum : undefined}
            max={val.maximum !== undefined ? val.maximum : undefined}
            value={(currentValue as number) || ''}
            onChange={e => onChange(Number(e.target.value))}
          />
        );
      default:
        return (
          <Input
            type="text"
            className="jgis-queryable-combo-input"
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
    <div className="jgis-queryable-combo-container">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="jgis-queryable-combo-button"
          >
            {getButtonText()}
            <ChevronsUpDownIcon className="jgis-queryable-combo-icon" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="jgis-queryable-combo-popover">
          <Command>
            <CommandInput
              placeholder="Search queryable..."
              style={{ height: '1rem' }}
            />
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
                      className="jgis-queryable-combo-check-icon"
                      style={{
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
      <div className="jgis-queryable-rows-container">
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
    </div>
  );
}
