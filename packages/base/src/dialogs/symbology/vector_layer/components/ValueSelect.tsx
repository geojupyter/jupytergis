import React from 'react';

interface IValueSelectProps {
  featureProperties: any;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
}

const ValueSelect = ({
  featureProperties,
  selectedValue,
  setSelectedValue
}: IValueSelectProps) => {
  return (
    <div className="jp-gis-symbology-row">
      <label htmlFor={'vector-value-select'}>Value:</label>
      <select
        name={'vector-value-select'}
        onChange={event => setSelectedValue(event.target.value)}
        className="jp-mod-styled"
      >
        {Object.keys(featureProperties).map((feature, index) => (
          <option
            key={index}
            value={feature}
            selected={feature === selectedValue}
            className="jp-mod-styled"
          >
            {feature}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ValueSelect;
