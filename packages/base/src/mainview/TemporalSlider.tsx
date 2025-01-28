import { Slider } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import { format, isValid, parse } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { useGetProperties } from '../dialogs/symbology/hooks/useGetProperties';

interface ITemporalSliderProps {
  model: IJupyterGISModel;
}

// List of common date formats to try
const commonDateFormats = [
  'yyyy-MM-dd', // ISO format (e.g., 2023-10-05)
  'dd/MM/yyyy', // European format (e.g., 05/10/2023)
  'MM/dd/yyyy', // US format (e.g., 10/05/2023)
  'yyyyMMdd', // Compact format (e.g., 20231005)
  'dd-MM-yyyy', // European format with hyphens (e.g., 05-10-2023)
  'MM-dd-yyyy', // US format with hyphens (e.g., 10-05-2023)
  'yyyy/MM/dd', // ISO format with slashes (e.g., 2023/10/05)
  'dd.MM.yyyy', // European format with dots (e.g., 05.10.2023)
  'MM.dd.yyyy' // US format with dots (e.g., 10.05.2023)
];

const TemporalSlider = ({ model }: ITemporalSliderProps) => {
  const [layerId, setLayerId] = useState('');
  //   const [selectedLayer, setSelectedLayer] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [range, setRange] = useState({ start: 0, end: 1 });
  const [validFeatures, setValidFeatures] = useState<string[]>([]);

  // False is values are already numbers, true if values are strings
  const [converted, setConverted] = useState(false);
  const [inferredDateFormat, setInferredDateFormat] = useState('');

  const { featureProps } = useGetProperties({ layerId, model });

  useEffect(() => {
    const localState = model.sharedModel.awareness.getLocalState();
    const selectedLayer = localState?.selected?.value;

    if (!selectedLayer) {
      console.warn('Layer must be selected to use identify tool');
      return;
    }

    const selectedLayerId = Object.keys(selectedLayer)[0];
    setLayerId(selectedLayerId);
  });

  useEffect(() => {
    const featuresForSelect = [];

    // We only want to show features that could be time values
    for (const [key, set] of Object.entries(featureProps)) {
      const checkValue = set.values().next().value;
      // const [cv2] = set;

      if (checkValue && isValidDate(checkValue)) {
        featuresForSelect.push(key);
      }
    }

    setValidFeatures(featuresForSelect);
  }, [layerId, featureProps]);

  useEffect(() => {
    if (!selectedFeature) {
      return;
    }

    // Get the values from the selected feature
    const values: any[] = Array.from(featureProps[selectedFeature]);

    // Check the type of the first element
    const firstValue = values[0];
    const isString = typeof firstValue === 'string';
    let convertedValues;

    if (isString) {
      const inferred = inferDateFormat(values[0]);
      if (!inferred) {
        console.log('broke');
        return;
      }

      convertedValues = values.map(value => Date.parse(value)); // Convert all strings to milliseconds
      setConverted(true);
      console.log('inferred', inferred);
      setInferredDateFormat(inferred);
    } else {
      convertedValues = values; // Keep numbers as they are
    }

    // Convert all values to milliseconds if the values are strings
    // const convertedValues = isString
    //   ? values.map(value => Date.parse(value)) // Convert all strings to milliseconds
    //   : values; // Keep numbers as they are

    // Calculate min and max
    const min = Math.min(...convertedValues);
    const max = Math.max(...convertedValues);

    // Update the range state
    setRange({ start: min, end: max });
  }, [selectedFeature]);

  const isValidDate = (val: any) => {
    const date = new Date(val);

    return !isNaN(date.getTime());
  };

  // Infer the date format from a date string
  const inferDateFormat = (dateString: string): string | null => {
    for (const format of commonDateFormats) {
      const parsedDate = parse(dateString, format, new Date());
      if (isValid(parsedDate)) {
        return format; // Return the format if the date is valid
      }
    }
    return null; // Return null if no format matches
  };

  // Convert a date string to milliseconds
  const dateStringToMilliseconds = (
    dateString: string,
    dateFormat: string
  ): number => {
    const date = parse(dateString, dateFormat, new Date()); // Parse the date string
    return date.getTime(); // Convert to milliseconds
  };

  // Convert milliseconds back to the original date string format
  const millisecondsToDateString = (
    milliseconds: number,
    dateFormat: string
  ): string => {
    const date = new Date(milliseconds); // Create a Date object from milliseconds
    return format(date, dateFormat); // Format back to the original string format
  };

  const handleChange = (e: any) => {
    console.log('change', e.target.value);

    const layer = model?.getLayer(layerId);
    if (!layer) {
      return;
    }

    // I think i want to replace filters?
    // or save old ones and reapply them when turning temporal off?
    // Really i want this filter to work with existing filters
    // I want to replace the one being added instead of adding a new one
    // add a type or source or something to the filter item??
    const oldFilters = layer.filters?.appliedFilters;
    const newFilters = oldFilters ? [...oldFilters] : [];

    // If values have been converted, convert them back
    let val: string | number = +e.target.value;
    if (converted) {
      const date = new Date(+e.target.value);
      val = millisecondsToDateString(+e.target.value, inferredDateFormat);
      console.log('we', val);
    }

    const nf = {
      feature: selectedFeature,
      operator: '>=' as const,
      value: val
    };

    // if no filters then add this one
    // if there are filters we want to replace time one
    // assume that is the last entry for now
    if (newFilters.length === 0) {
      newFilters.push(nf);
    } else {
      newFilters.splice(newFilters.length - 1, 1, nf);
    }

    layer.filters = { logicalOp: 'all', appliedFilters: newFilters };
    model?.sharedModel.updateLayer(layerId, layer);
  };

  const setFeature = (e: any) => {
    console.log('e.target.value', e.target.value);
    setSelectedFeature(e.target.value);
  };

  return (
    <div className="jp-gis-temporal-slider-container">
      {layerId ? (
        <>
          <div>
            <select onChange={setFeature}>
              {validFeatures.map(feature => {
                return <option value={feature}>{feature}</option>;
              })}
            </select>
          </div>
          <div>{new Date(range.start).toUTCString()}</div>
          <Slider
            min={range.start}
            max={range.end}
            // step={60 * 60 * 1000}
            onChange={handleChange}
            className="jp-gis-temporal-slider"
          />
          <div>{new Date(range.end).toUTCString()}</div>

          <div>step</div>
        </>
      ) : (
        <div>Select a layer</div>
      )}
    </div>
  );
};

export default TemporalSlider;
