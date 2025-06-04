import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

const FilterRow = ({
  index,
  features,
  filterRows,
  setFilterRows,
  deleteRow,
}: {
  index: number;
  features: Record<string, Set<string | number>>;
  filterRows: any;
  setFilterRows: any;
  deleteRow: () => void;
}) => {
  const operators = ['==', '!=', '>', '<', '>=', '<='];

  const [sortedFeatures, setSortedFeatures] = useState<{ [key: string]: any }>(
    {},
  );
  const [selectedFeature, setSelectedFeature] = useState(
    filterRows[index].feature || Object.keys(features)[0],
  );

  // Ensure selected feature matches filter rows and proper values are displayed
  useEffect(() => {
    setSelectedFeature(filterRows[index].feature);
  }, [filterRows]);

  useEffect(() => {
    const sortedKeys = Object.keys(features).sort();
    const sortedResult: { [key: string]: any } = {};

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
      `jp-gis-value-select-${index}`,
    ) as HTMLSelectElement;

    if (!valueSelect) {
      return;
    }

    const currentValue = valueSelect.options[valueSelect.selectedIndex]?.value;
    currentValue && onValueChange(currentValue);
  }, [selectedFeature]);

  const onValueChange = (value: string | number) => {
    const newFilters = [...filterRows];
    const isNum = typeof sortedFeatures[selectedFeature][0] === 'number';

    newFilters[index].value = isNum ? +value : value;
    setFilterRows(newFilters);
  };

  const handleKeyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilters = [...filterRows];
    newFilters[index].feature = event.target.value;
    setSelectedFeature(event.target.value);
    setFilterRows(newFilters);
  };

  const handleOperatorChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newFilters = [...filterRows];
    newFilters[index].operator = event.target.value;
    setFilterRows(newFilters);
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange(event.target.value);
  };

  return (
    <div className="jp-gis-filter-row">
      <select
        id={`jp-gis-feature-select-${index}`}
        className="jp-mod-styled rjsf"
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
        id={`jp-gis-operator-select-${index}`}
        className="jp-mod-styled rjsf"
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
        id={`jp-gis-value-select-${index}`}
        className="jp-mod-styled rjsf"
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
      <Button
        id={`jp-gis-remove-filter-${index}`}
        className="jp-Button jp-gis-filter-icon"
      >
        <FontAwesomeIcon icon={faTrash} onClick={deleteRow} />
      </Button>
    </div>
  );
};

export default FilterRow;
