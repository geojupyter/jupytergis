import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import React, { useState } from 'react';

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
import QueryableRow from './QueryableRow';

interface IQueryableComboProps {
  queryables: [string, any][];
}

export function QueryableCombo({ queryables }: IQueryableComboProps) {
  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<[string, any][]>([]);

  const handleSelect = (key: string, val: any) => {
    setSelectedItems(prev => {
      const existingIndex = prev.findIndex(([k]) => k === key);
      if (existingIndex >= 0) {
        // Remove if already selected
        return prev.filter(([k]) => k !== key);
      } else {
        // Add if not selected
        return [...prev, [key, val]];
      }
    });

    setOpen(false);
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
    return selectedItems.some(([k]) => k === key);
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
        <QueryableRow key={key} qKey={key} qVal={val} />
      ))}
    </div>
  );
}
