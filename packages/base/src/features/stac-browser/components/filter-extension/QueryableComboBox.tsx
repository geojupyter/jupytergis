import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import QueryableRow from '@/src/features/stac-browser/components/filter-extension/QueryableRow';
import {
  IQueryableFilter,
  IStacQueryableSchema,
  IStacQueryables,
  Operator,
  UpdateSelectedQueryables,
} from '@/src/features/stac-browser/types/types';
import { ButtonTw } from '@/src/shared/components/ButtonTw';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/src/shared/components/Combobox';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import { debounce } from '@/src/tools';
import SingleDatePicker from '../../../../shared/components/SingleDatePicker';

interface IQueryableComboProps {
  queryables: IStacQueryables;
  selectedQueryables: Record<string, IQueryableFilter>;
  updateSelectedQueryables: UpdateSelectedQueryables;
}

interface IOperatorOption {
  value: Operator;
  label: string;
}

interface IQueryableOption {
  value: string;
  label: string;
  schema: IStacQueryableSchema;
}

export function QueryableComboBox({
  queryables,
  selectedQueryables,
  updateSelectedQueryables,
}: IQueryableComboProps) {
  const [draftValues, setDraftValues] = useState<
    Record<string, string | number | undefined>
  >({});
  const selectedQueryablesRef = useRef(selectedQueryables);
  const debouncedCommitByKeyRef = useRef<Record<string, CallableFunction>>({});

  useEffect(() => {
    selectedQueryablesRef.current = selectedQueryables;
  }, [selectedQueryables]);

  const normalizeInputValue = useCallback(
    (schema: IStacQueryableSchema, value: string | number): string | number => {
      let valueToStore: string | number = value;
      if (
        schema.type === 'string' &&
        schema.format === 'date-time' &&
        typeof value === 'string'
      ) {
        try {
          const localDate = new Date(value);
          valueToStore = localDate.toISOString();
        } catch {
          valueToStore = value;
        }
      }
      return valueToStore;
    },
    [],
  );

  const scheduleQueryableCommit = useCallback(
    (key: string, value: string | number) => {
      if (!debouncedCommitByKeyRef.current[key]) {
        debouncedCommitByKeyRef.current[key] = debounce(
          (nextValue: string | number) => {
            const latestFilter = selectedQueryablesRef.current[key];
            if (!latestFilter) {
              return;
            }
            updateSelectedQueryables(key, {
              ...latestFilter,
              inputValue: nextValue,
            });
          },
          500,
        );
      }

      debouncedCommitByKeyRef.current[key](value);
    },
    [updateSelectedQueryables],
  );

  // Derive selected items from selectedQueryables
  const selectedItems = useMemo(() => {
    return queryables.filter(([key]) => key in selectedQueryables);
  }, [queryables, selectedQueryables]);

  const handleSelect = (key: string, val: IStacQueryableSchema) => {
    const isCurrentlySelected = key in selectedQueryables;

    if (isCurrentlySelected) {
      // Remove if already selected - pass null to explicitly remove
      delete debouncedCommitByKeyRef.current[key];
      setDraftValues(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
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
            <NativeSelect
              className="w-full"
              value={String(currentValue ?? '')}
              onChange={event => onChange(String(event.target.value))}
            >
              <NativeSelectOption value="" disabled>
                Select option...
              </NativeSelectOption>
              {val.enum.map(option => (
                <NativeSelectOption key={String(option)} value={String(option)}>
                  {String(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
              className="jgis-queryable-combo-input-date-picker"
            />
          );
        }
        return (
          <Input
            type="text"
            value={(currentValue as string) || ''}
            onChange={e => onChange(e.target.value)}
          />
        );
      case 'number':
      case 'integer':
        if (val.enum) {
          return (
            <NativeSelect
              className="w-full"
              value={String(currentValue ?? '')}
              onChange={event => onChange(Number(event.target.value))}
            >
              <NativeSelectOption value="" disabled>
                Select option...
              </NativeSelectOption>
              {val.enum.map(option => (
                <NativeSelectOption key={String(option)} value={String(option)}>
                  {String(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          );
        }
        return (
          <Input
            type="number"
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

  const queryableOptions = useMemo<IQueryableOption[]>(
    () =>
      queryables.map(([key, schema]) => ({
        value: key,
        label: schema.title || key,
        schema,
      })),
    [queryables],
  );

  const selectedOptions = useMemo(
    () => queryableOptions.filter(option => option.value in selectedQueryables),
    [queryableOptions, selectedQueryables],
  );

  const handleComboboxValueChange = (newSelected: IQueryableOption[]) => {
    const newKeys = new Set(newSelected.map(option => option.value));
    const currentKeys = Object.keys(selectedQueryables);

    for (const key of currentKeys) {
      if (!newKeys.has(key)) {
        const entry = queryables.find(([k]) => k === key);
        if (entry) {
          handleSelect(key, entry[1]);
        }
      }
    }

    for (const option of newSelected) {
      if (!(option.value in selectedQueryables)) {
        handleSelect(option.value, option.schema);
      }
    }
  };

  return (
    <div className="jgis-queryable-combo-container">
      <Combobox
        items={queryableOptions}
        multiple
        value={selectedOptions}
        onValueChange={handleComboboxValueChange}
        isItemEqualToValue={(a, b) => a.value === b.value}
      >
        <ComboboxTrigger
          className={'border-input'}
          render={<ButtonTw variant="outline" className="justify-between" />}
        >
          <span className="truncate">{getButtonText()}</span>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-(--anchor-width)!">
          <ComboboxInput
            placeholder="Search queryable..."
            showTrigger={false}
          />
          <ComboboxEmpty>No queryable found.</ComboboxEmpty>
          <ComboboxList>
            {(option: IQueryableOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <div className="jgis-queryable-rows-container">
        {selectedItems.map(([key, val]) => {
          const operators = getOperatorsForType(val.type, val.format);
          const currentFilter: IQueryableFilter = selectedQueryables[key] ?? {
            operator: operators[0]?.value || '=',
            inputValue: undefined,
          };
          const inputValue =
            draftValues[key] !== undefined
              ? draftValues[key]
              : currentFilter.inputValue;

          const handleInputChange = (value: string | number) => {
            const normalizedValue = normalizeInputValue(val, value);
            setDraftValues(prev => ({
              ...prev,
              [key]: normalizedValue,
            }));
            // Uses a stable per-field debounced function
            // inline debounce would recreate each render and reset its timer
            scheduleQueryableCommit(key, normalizedValue);
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
                inputValue,
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
