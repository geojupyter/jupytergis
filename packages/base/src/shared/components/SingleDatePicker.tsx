import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import { Calendar } from '@/src/shared/components/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';

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
      <PopoverTrigger asChild>
        <Button className={className} variant="outline">
          {showIcon && <CalendarIcon className="jgis-stac-datepicker-icon" />}
          {date ? format(date, dateFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
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
