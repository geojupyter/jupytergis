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
  UpdateSelectedQueryables,
} from '@/src/stacBrowser/hooks/useStacFilterExtension';

interface IQueryableComboProps {
  queryables: [string, any][];
  selectedQueryables: Record<string, IQueryableFilter>;
  updateSelectedQueryables: UpdateSelectedQueryables;
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

  const handleSelect = (key: string, val: any) => {
    const isCurrentlySelected = key in selectedQueryables;

    if (isCurrentlySelected) {
      // Remove if already selected - pass null to explicitly remove
      updateSelectedQueryables(key, null);
    } else {
      // Add if not selected - initialize with default filter
      // We'll add it with a placeholder so it doesn't get removed immediately
      const operators = getOperatorsForType(val.type, val.format);
      updateSelectedQueryables(key, {
        operator: operators[0]?.value || '=',
        inputValue: undefined,
      });
    }

    setOpen(false);
  };

  const getOperatorsForType = (type: string, format?: string) => {
    if (format === 'date-time') {
      return [
        { value: '<' as const, label: '<' },
        { value: '>' as const, label: '>' },
      ];
    }

    switch (type) {
      case 'string':
        return [
          { value: '=' as const, label: '=' },
          { value: '!=' as const, label: '≠' },
        ];
      case 'number':
        return [
          { value: '=' as const, label: '=' },
          { value: '!=' as const, label: '≠' },
          { value: '<' as const, label: '<' },
          { value: '>' as const, label: '>' },
        ];
      default:
        return [
          { value: '=' as const, label: '=' },
          { value: '!=' as const, label: '≠' },
        ];
    }
  };

  const getButtonText = () => {
    if (selectedItems.length === 0) {
      return 'Select queryable...';
    }
    if (selectedItems.length === 1) {
      return selectedItems[0][1].title || selectedItems[0][0];
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
                    value={val.title}
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
                    {val.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedItems.map(([key, val]) => (
        <QueryableRow
          key={key}
          qKey={key}
          qVal={val}
          selectedQueryables={selectedQueryables}
          updateSelectedQueryables={updateSelectedQueryables}
        />
      ))}
    </div>
  );
}
