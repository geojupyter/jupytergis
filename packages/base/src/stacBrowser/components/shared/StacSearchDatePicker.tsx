import React from 'react';

import SingleDatePicker from './SingleDatePicker';

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
      <SingleDatePicker
        date={startTime}
        onDateChange={setStartTime}
        className="jgis-stac-datepicker-full-width"
      />
      <SingleDatePicker
        date={endTime}
        onDateChange={setEndTime}
        className="jgis-stac-datepicker-full-width"
      />
    </div>
  );
}

export default StacSearchDatePicker;
