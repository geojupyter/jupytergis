import React from 'react';

import SingleDatePicker from '../../../shared/components/SingleDatePicker';

interface IStacTemporalExtentProps {
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
}

function StacTemporalExtent({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
}: IStacTemporalExtentProps) {
  return (
    <div className="jgis-stac-filter-extension-section">
      <label className="jgis-stac-filter-extension-label">
        Temporal Extent
      </label>
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

export default StacTemporalExtent;
