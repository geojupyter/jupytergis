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

interface IStacSearchDatePickerProps {
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
}

function StacSearchDatePicker({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
}: IStacSearchDatePickerProps) {
  return (
    <div className="jgis-stac-browser-date-picker">
      <Popover>
        <PopoverTrigger asChild>
          <Button style={{ padding: '0 0.5rem' }} variant={'outline'}>
            <CalendarIcon className="jgis-stac-datepicker-icon" />
            {startTime ? format(startTime, 'PPP') : <span>Start Date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={startTime}
            onSelect={setStartTime}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button style={{ padding: '0 0.5rem' }} variant={'outline'}>
            <CalendarIcon className="jgis-stac-datepicker-icon" />
            {endTime ? format(endTime, 'PPP') : <span>End Date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={endTime}
            onSelect={setEndTime}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default StacSearchDatePicker;
