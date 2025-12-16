import { ChevronsUpDownIcon } from 'lucide-react';
import React, { ReactNode, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/src/shared/components/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import { cn } from './utils';

interface IComboboxProps {
  children: ReactNode;
  buttonText: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  buttonClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showSearch?: boolean;
}

export function Combobox({
  children,
  buttonText,
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  className,
  buttonClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showSearch = true,
}: IComboboxProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

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
      <PopoverContent className={cn('jgis-combobox-popover', className)}>
        <Command>
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>{children}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
