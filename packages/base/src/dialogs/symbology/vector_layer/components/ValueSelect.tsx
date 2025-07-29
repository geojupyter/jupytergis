import React from 'react';

interface IValueSelectProps {
  featureProperties: any;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
}

const ValueSelect: React.FC<IValueSelectProps> = props => {
  return (
    <div className="jp-gis-symbology-row">
      <label htmlFor={'vector-value-select'}>Value:</label>
      <select
        name={'vector-value-select'}
        onChange={event => props.setSelectedValue(event.target.value)}
        className="jp-mod-styled"
      >
        {Object.keys(props.featureProperties).map((feature, index) => (
          <option
            key={index}
            value={feature}
            selected={feature === props.selectedValue}
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
