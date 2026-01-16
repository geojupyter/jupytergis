import { ChevronsUpDownIcon } from 'lucide-react';
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
import { cn } from './utils';

export interface ISelectItem {
  value: string;
  label: string;
  onSelect?: () => void;
}

interface ISelectProps {
  items: ISelectItem[];
  buttonText: string;
  emptyText?: string;
  className?: string;
  buttonClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export function Select({
  items,
  buttonText,
  emptyText = 'No option found.',
  className,
  buttonClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showSearch = false,
  searchPlaceholder = 'Search...',
}: ISelectProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleSelect = (item: ISelectItem) => {
    setOpen(false);
    if (item.onSelect) {
      item.onSelect();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('jgis-combobox-button', buttonClassName)}
        >
          <span className="jgis-combobox-button-text">{buttonText}</span>
          <ChevronsUpDownIcon className="jgis-combobox-icon" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('jgis-select-popover', className)}>
        <Command>
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
