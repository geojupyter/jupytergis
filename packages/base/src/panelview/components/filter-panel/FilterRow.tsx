import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

const FilterRow: React.FC<{
  index: number;
  features: Record<string, Set<string | number>>;
  filterRows: any;
  setFilterRows: any;
  deleteRow: () => void;
}> = props => {
  const operators = ['==', '!=', '>', '<', '>=', '<='];

  const [sortedFeatures, setSortedFeatures] = useState<{ [key: string]: any }>(
    {},
  );
  const [selectedFeature, setSelectedFeature] = useState(
    props.filterRows[props.index].feature || Object.keys(props.features)[0],
  );

  // Ensure selected feature matches filter rows and proper values are displayed
  useEffect(() => {
    setSelectedFeature(props.filterRows[props.index].feature);
  }, [props.filterRows]);

  useEffect(() => {
    const sortedKeys = Object.keys(props.features).sort();
    const sortedResult: { [key: string]: any } = {};

    for (const key of sortedKeys) {
      // Convert each Set to a sorted array
      const sortedArray = Array.from(props.features[key]).sort();
      sortedResult[key] = sortedArray;
    }

    setSortedFeatures(sortedResult);
  }, [props.features]);

  // Update the value when a new feature is selected
  useEffect(() => {
    const valueSelect = document.getElementById(
      `jp-gis-value-select-${props.index}`,
    ) as HTMLSelectElement;

    if (!valueSelect) {
      return;
    }

    const currentValue = valueSelect.options[valueSelect.selectedIndex]?.value;
    currentValue && onValueChange(currentValue);
  }, [selectedFeature]);

  const onValueChange = (value: string | number) => {
    const newFilters = [...props.filterRows];
    const isNum = typeof sortedFeatures[selectedFeature][0] === 'number';

    newFilters[props.index].value = isNum ? +value : value;
    props.setFilterRows(newFilters);
  };

  const handleKeyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilters = [...props.filterRows];
    newFilters[props.index].feature = event.target.value;
    setSelectedFeature(event.target.value);
    props.setFilterRows(newFilters);
  };

  const handleOperatorChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newFilters = [...props.filterRows];
    newFilters[props.index].operator = event.target.value;
    props.setFilterRows(newFilters);
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange(event.target.value);
  };

  return (
    <div className="jp-gis-filter-row">
      <select
        id={`jp-gis-feature-select-${props.index}`}
        className="jp-mod-styled rjsf"
        onChange={handleKeyChange}
      >
        {/* Populate options based on the keys of the filters object */}
        {Object.keys(sortedFeatures).map((feature, featureIndex) => (
          <option
            key={featureIndex}
            value={feature}
            selected={feature === props.filterRows[props.index].feature}
          >
            {feature}
          </option>
        ))}
      </select>
      <select
        id={`jp-gis-operator-select-${props.index}`}
        className="jp-mod-styled rjsf"
        onChange={handleOperatorChange}
      >
        {operators.map((operator, operatorIndex) => (
          <option
            key={operatorIndex}
            value={operator}
            selected={operator === props.filterRows[props.index].operator}
          >
            {operator}
          </option>
        ))}
      </select>
      <select
        id={`jp-gis-value-select-${props.index}`}
        className="jp-mod-styled rjsf"
        onChange={handleValueChange}
      >
        {/* Populate options based on the values of the selected key */}
        {sortedFeatures[selectedFeature] &&
          [...sortedFeatures[selectedFeature]].map((value, valueIndex) => (
            <option
              key={valueIndex}
              value={value}
              selected={value === props.filterRows[props.index].value}
            >
              {value}
            </option>
          ))}
      </select>
      <Button
        id={`jp-gis-remove-filter-${props.index}`}
        className="jp-Button jp-gis-filter-icon"
      >
        <FontAwesomeIcon icon={faTrash} onClick={props.deleteRow} />
      </Button>
    </div>
  );
};

export default FilterRow;
