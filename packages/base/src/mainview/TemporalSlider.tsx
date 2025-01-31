import { Slider } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import { format, isValid, parse, toDate } from 'date-fns';
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

// Time steps in milliseconds
const stepMap = {
  hour: 3600000,
  day: 86400000,
  week: 604800000,
  month: 2592000000, // 30 days
  year: 31536000000 // 365 days
};

const TemporalSlider = ({ model }: ITemporalSliderProps) => {
  const [layerId, setLayerId] = useState('');
  //   const [selectedLayer, setSelectedLayer] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [range, setRange] = useState({ start: 0, end: 1 });
  const [validFeatures, setValidFeatures] = useState<string[]>([]);

  // False is values are already numbers, true if values are strings
  const [converted, setConverted] = useState(false);
  const [inferredDateFormat, setInferredDateFormat] = useState('yyyy-MM-dd');
  const [step, setStep] = useState(stepMap.day);
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
      let checkIfDateIsValid = false;
      const checkValue = set.values().next().value;
      console.log('checking ', key, checkValue);

      // We only want to look at strings and whole numbers
      // ? Is there a better way to check if number values are valid timestamps?
      const isString = typeof checkValue === 'string';
      const isNumber =
        typeof checkValue === 'number' && Number.isInteger(checkValue);
      if (!isString && !isNumber) {
        console.log('not string or number');
        continue;
      }

      // ! QGIS doesn't actually support number values for their time thing
      if (isNumber) {
        // Check if number returns a valid date
        const date = toDate(checkValue);
        console.log('date', date);

        checkIfDateIsValid = isValid(toDate(checkValue));

        if (!checkIfDateIsValid) {
          console.log('key invalid', key);
          continue;
        }
      }

      if (isString) {
        const date = toDate(checkValue);
        console.log('date', date);
        // const inferredFormat = inferDateFormat(checkValue);
        // if (!inferredFormat) {
        //   console.log('date not inferred from', key);
        //   continue;
        // }

        // checkIfDateIsValid = !!inferredFormat;
        checkIfDateIsValid = isValid(toDate(checkValue));
        // setConverted(true);
        // setInferredDateFormat(inferredFormat);
        if (!checkIfDateIsValid) {
          console.log('key invalid', key);
          continue;
        }
      }

      if (checkValue && checkIfDateIsValid) {
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
    // const firstValue = values[0];
    const isString = typeof values[0] === 'string';
    let convertedValues;

    if (isString) {
      console.log('string');
      const inferredFormat = inferDateFormat(values[0]);
      if (!inferredFormat) {
        console.log('broke');
        return;
      }

      setInferredDateFormat(inferredFormat);

      convertedValues = values.map(value => Date.parse(value)); // Convert all strings to milliseconds

      // setConverted(true);
      // console.log('inferred', inferred);
      setInferredDateFormat(inferredFormat);
    } else {
      console.log('not string');
      convertedValues = values; // Keep numbers as they are
    }

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
      console.log('inferring', dateString, format);
      const parsedDate = parse(dateString, format, new Date());
      console.log('parsedDate', parsedDate);
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
    return date.getUTCMilliseconds(); // Convert to milliseconds
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

    const sd = millisecondsToDateString(+e.target.value, inferredDateFormat);
    console.log('sd', sd);

    const newFilter = {
      feature: `converted${selectedFeature}`,
      operator: '>=' as const,
      value: +e.target.value
    };

    model.addFeatureTimeThins(layerId, selectedFeature, newFilter);
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
              <option></option>
              {validFeatures.map(feature => {
                return (
                  <option
                    value={feature}
                    selected={selectedFeature === feature}
                  >
                    {feature}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            {inferredDateFormat &&
              millisecondsToDateString(range.start, inferredDateFormat)}
          </div>
          <Slider
            min={range.start}
            max={range.end}
            step={step}
            onChange={handleChange}
            className="jp-gis-temporal-slider"
          />
          <div>
            {inferredDateFormat &&
              millisecondsToDateString(range.end, inferredDateFormat)}
          </div>

          <div>
            <select
              onChange={e => {
                setStep(+e.target.value);
              }}
            >
              {Object.entries(stepMap).map(([key, val]) => {
                return <option value={val}>{key}</option>;
              })}
            </select>
          </div>
        </>
      ) : (
        <div>Select a layer</div>
      )}
    </div>
  );
};

export default TemporalSlider;
