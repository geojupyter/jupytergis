import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';

import { Calendar } from '@/src/shared/components/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import { ButtonTw } from './ButtonTw';
import { cn } from './utils';

interface ISingleDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  dateFormat?: string;
  showIcon?: boolean;
}

function SingleDatePicker({
  date,
  onDateChange,
  placeholder = 'Select date',
  className,
  dateFormat = 'PPP',
  showIcon = true,
}: ISingleDatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={'border-input'}
        render={
          <ButtonTw
            data-empty={!date}
            className={cn(
              'justify-start text-left font-normal data-[empty=true]:text-muted-foreground',
              className,
            )}
            variant="outline"
          >
            {showIcon && <CalendarIcon className="jgis-stac-datepicker-icon" />}
            {date ? format(date, dateFormat) : <span>{placeholder}</span>}
          </ButtonTw>
        }
      />
      <PopoverContent className={'w-fit'}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default SingleDatePicker;
