import React, { useEffect, useState } from 'react';

const FilterRow = ({
  index,
  features,
  filterRows,
  setFilterRows
}: {
  index: number;
  features: Record<string, Set<string>>;
  filterRows: any;
  setFilterRows: any;
}) => {
  const operators = ['==', '!=', '>', '<'];

  const [selectedFeature, setSelectedFeature] = useState(
    Object.keys(features)[0]
  );

  // Update the value when a new feature is selected
  useEffect(() => {
    const valueSelect = document.getElementById(
      `filter-value${index}`
    ) as HTMLSelectElement;
    if (!valueSelect) {
      return;
    }
    const currentValue = valueSelect.options[valueSelect.selectedIndex].value;
    handleValueChange({
      target: { value: currentValue }
    });
  }, [selectedFeature]);

  const handleKeyChange = event => {
    const newFilters = [...filterRows];
    newFilters[index].feature = event.target.value;
    setSelectedFeature(event.target.value);
    setFilterRows(newFilters);
  };

  const handleOperatorChange = event => {
    const newFilters = [...filterRows];
    newFilters[index].operator = event.target.value;
    setFilterRows(newFilters);
  };

  const handleValueChange = event => {
    const newFilters = [...filterRows];
    newFilters[index].value = event.target.value;
    setFilterRows(newFilters);
  };

  return (
    <div className="jp-gis-filter-row">
      <select
        className="jp-mod-styled jp-SchemaForm"
        onChange={handleKeyChange}
      >
        {/* Populate options based on the keys of the filters object */}
        {Object.keys(features).map((key, keyIndex) => (
          <option key={keyIndex} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select
        className="jp-mod-styled jp-SchemaForm"
        onChange={handleOperatorChange}
      >
        {operators.map((operator, operatorIndex) => (
          <option key={operatorIndex} value={operator}>
            {operator}
          </option>
        ))}
      </select>
      <select
        className="jp-mod-styled jp-SchemaForm"
        id={`filter-value${index}`}
        onChange={handleValueChange}
      >
        {/* Populate options based on the values of the selected key */}
        {features[selectedFeature] &&
          [...features[selectedFeature]].map((value, valueIndex) => (
            <option key={valueIndex} value={value}>
              {value}
            </option>
          ))}
      </select>
    </div>
  );
};

export default FilterRow;
