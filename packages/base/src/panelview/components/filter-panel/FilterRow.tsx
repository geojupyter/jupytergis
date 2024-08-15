import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

const FilterRow = ({
  index,
  features,
  filterRows,
  setFilterRows,
  deleteRow
}: {
  index: number;
  features: Record<string, Set<string>>;
  filterRows: any;
  setFilterRows: any;
  deleteRow: () => void;
}) => {
  const operators = ['==', '!=', '>', '<'];

  const [sortedFeatures, setSortedFeatures] = useState({});
  const [selectedFeature, setSelectedFeature] = useState(
    filterRows[index].feature || Object.keys(features)[0]
  );

  useEffect(() => {
    const sortedKeys = Object.keys(features).sort();
    const sortedResult = {};

    for (const key of sortedKeys) {
      // Convert each Set to a sorted array
      const sortedArray = Array.from(features[key]).sort();
      sortedResult[key] = sortedArray;
    }

    setSortedFeatures(sortedResult);
  }, [features]);

  // Update the value when a new feature is selected
  useEffect(() => {
    const valueSelect = document.getElementById(
      `filter-value${index}`
    ) as HTMLSelectElement;

    if (!valueSelect) {
      return;
    }

    const currentValue = valueSelect.options[valueSelect.selectedIndex]?.value;
    currentValue &&
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
        {Object.keys(sortedFeatures).map((feature, featureIndex) => (
          <option
            key={featureIndex}
            value={feature}
            selected={feature === filterRows[index].feature}
          >
            {feature}
          </option>
        ))}
      </select>
      <select
        className="jp-mod-styled jp-SchemaForm"
        onChange={handleOperatorChange}
      >
        {operators.map((operator, operatorIndex) => (
          <option
            key={operatorIndex}
            value={operator}
            selected={operator === filterRows[index].operator}
          >
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
        {sortedFeatures[selectedFeature] &&
          [...sortedFeatures[selectedFeature]].map((value, valueIndex) => (
            <option
              key={valueIndex}
              value={value}
              selected={value === filterRows[index].value}
            >
              {value}
            </option>
          ))}
      </select>
      <Button className="jp-Button jp-gis-filter-icon">
        <FontAwesomeIcon icon={faTrash} onClick={deleteRow} />
      </Button>
    </div>
  );
};

export default FilterRow;
