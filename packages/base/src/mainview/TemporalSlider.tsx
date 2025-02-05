import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Slider } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import { format, isValid, parse, toDate } from 'date-fns';
import {
  daysInYear,
  millisecondsInDay,
  millisecondsInHour,
  millisecondsInMinute,
  millisecondsInWeek,
  minutesInMonth
} from 'date-fns/constants';
import React, { useEffect, useRef, useState } from 'react';
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
  hour: millisecondsInHour,
  day: millisecondsInDay,
  week: millisecondsInWeek,
  month: minutesInMonth * millisecondsInMinute,
  year: millisecondsInDay * daysInYear
};

const TemporalSlider = ({ model }: ITemporalSliderProps) => {
  const [layerId, setLayerId] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  // min/max of current range being displayed
  const [range, setRange] = useState({ start: 0, end: 1 });
  // min/max of data
  const [minMax, setMinMax] = useState({ min: 0, max: 1 });
  const [validFeatures, setValidFeatures] = useState<string[]>([]);

  const [inferredDateFormat, setInferredDateFormat] = useState('yyyy-MM-dd');
  const [step, setStep] = useState(stepMap.year);
  const [currentValue, setCurrentValue] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const featuresForSelect = [];

    // We only want to show features that could be time values
    for (const [key, set] of Object.entries(featureProps)) {
      let checkIfDateIsValid = false;
      const checkValue = set.values().next().value;
      // console.log('checking ', key, checkValue);

      // We only want to look at strings and whole numbers
      // ? Is there a better way to check if number values are valid timestamps?
      // ! QGIS doesn't actually support number values for their time thing
      const isString = typeof checkValue === 'string';
      const isNumber =
        typeof checkValue === 'number' && Number.isInteger(checkValue);
      if (!isString && !isNumber) {
        console.log('Invalid value type');
        continue;
      }

      checkIfDateIsValid = isValid(toDate(checkValue));
      if (!checkIfDateIsValid) {
        continue;
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
    const isString = typeof values[0] === 'string';
    let convertedValues;

    if (isString) {
      const inferredFormat = inferDateFormat(values[0]);
      if (!inferredFormat) {
        console.log('Date string has an unsupported format');
        return;
      }

      setInferredDateFormat(inferredFormat);

      convertedValues = values.map(value => Date.parse(value)); // Convert all strings to milliseconds
      setInferredDateFormat(inferredFormat);
    } else {
      convertedValues = values; // Keep numbers as they are
    }

    // Calculate min and max
    const min = Math.min(...convertedValues);
    const max = Math.max(...convertedValues);

    // Update the range and minMax state
    console.log('check');
    setCurrentValue(min);
    setMinMax({ min, max });
    setRange({ start: min, end: min + step });
    model.addTimeFeature(layerId, selectedFeature);
  }, [selectedFeature]);

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
  // const dateStringToMilliseconds = (
  //   dateString: string,
  //   dateFormat: string
  // ): number => {
  //   const date = parse(dateString, dateFormat, new Date()); // Parse the date string
  //   return date.getUTCMilliseconds(); // Convert to milliseconds
  // };

  // Convert milliseconds back to the original date string format
  // TODO I'm pretty sure this ends up in local time, not UTC time
  const millisecondsToDateString = (
    milliseconds: number,
    dateFormat: string
  ): string => {
    const date = new Date(milliseconds); // Create a Date object from milliseconds
    return format(date, dateFormat); // Format back to the original string format
  };

  const handleChange = (e: any) => {
    // const currentValueStringTarget = millisecondsToDateString(
    //   +e.target.value,
    //   inferredDateFormat
    // );

    // console.log('currentValueString target', currentValueStringTarget);

    console.log('+e.target.value', +e.target.value);
    setCurrentValue(+e.target.value);
    setRange({ start: +e.target.value, end: +e.target.value + step });

    applyFilter(+e.target.value);
  };

  const applyFilter = (value: number) => {
    const newFilter = {
      feature: `converted${selectedFeature}`,
      operator: 'between' as const,
      value: value,
      betweenMin: value,
      betweenMax: value + step
    };

    const layer = model.getLayer(layerId);
    if (!layer) {
      return;
    }

    const appliedFilters = layer.filters?.appliedFilters || [];

    // This is the only way to add a 'between' filter so
    // find the index of the existing 'between' filter
    const betweenFilterIndex = appliedFilters.findIndex(
      filter => filter.operator === 'between'
    );

    // console.log('betweenFilterIndex', betweenFilterIndex);

    if (betweenFilterIndex !== -1) {
      // If found, replace the existing filter
      appliedFilters[betweenFilterIndex] = {
        ...newFilter
      };
    } else {
      // If not found, add the new filter
      appliedFilters.push(newFilter);
    }

    // Apply the updated filters to the layer
    layer.filters = { logicalOp: 'all', appliedFilters };
    // model.sharedModel.updateLayer(layerId, layer);
    model.updateLayersOnCommand(layerId, layer);
  };

  const setFeature = (e: any) => {
    setSelectedFeature(e.target.value);
  };

  useEffect(() => {
    // console.log(
    //   'currentValue',
    //   millisecondsToDateString(currentValue, inferredDateFormat)
    // );
    // applyFilter(currentValue);

    const currentValueStringCurrent = millisecondsToDateString(
      currentValue,
      inferredDateFormat
    );
    console.log('currentValueString current', currentValueStringCurrent);
  }, [currentValue]);

  const playAnimation = () => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const incrementValue = () => {
      setCurrentValue(prev => {
        // Stop condition check
        if (prev >= minMax.max) {
          console.log('shouldnt happen');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return prev;
        }

        // Calculate next value with safety bounds
        const nextValue = prev + step;

        // Clear interval if we've reached the max
        if (nextValue >= minMax.max - step && intervalRef.current) {
          clearInterval(intervalRef.current);
          return minMax.max - step; // Ensure it reaches the exact max value
        }

        return nextValue;
      });
    };

    // Start animation only if needed
    intervalRef.current = setInterval(incrementValue, 1000);
    // if (currentValue < minMax.max) {
    // }
  };

  const pauseAnimation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  return (
    <div className="jp-gis-temporal-slider-container">
      {layerId ? (
        <>
          <div className="jp-gis-temporal-slider-row">
            {/* Feature select */}
            <div>
              <label htmlFor="time-feature-select">Feature: </label>
              <select id="time-feature-select" onChange={setFeature}>
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
            {/* Current frame */}
            <div>
              <span>Current Frame:</span>{' '}
              {millisecondsToDateString(range.start, inferredDateFormat)} ≤{' '}
              <span>t</span> ≤{' '}
              {millisecondsToDateString(range.end, inferredDateFormat)}
            </div>
          </div>
          <div className="jp-gis-temporal-slider-row">
            {/* controls */}
            <div style={{ margin: 'auto' }}>
              <Button
                appearance="neutral"
                scale="medium"
                onClick={pauseAnimation}
              >
                <FontAwesomeIcon icon={faPause} />
              </Button>
              <Button
                appearance="neutral"
                scale="medium"
                onClick={playAnimation}
              >
                <FontAwesomeIcon icon={faPlay} />
              </Button>
            </div>
            {/* slider */}
            <div>
              <Slider
                min={minMax.min}
                max={minMax.max - step}
                valueAsNumber={currentValue}
                step={step}
                onChange={handleChange}
                className="jp-gis-temporal-slider"
              />
            </div>
          </div>
          <div className="jp-gis-temporal-slider-row">
            {/* range */}
            <div>
              <span>Range: </span>
              {millisecondsToDateString(minMax.min, inferredDateFormat)}{' '}
              <span>to </span>
              {millisecondsToDateString(minMax.max, inferredDateFormat)}
            </div>
            {/* step */}
            <div>
              <label htmlFor="time-step-select">Step: </label>
              <select
                id="time-step-select"
                onChange={e => {
                  setStep(+e.target.value);
                }}
              >
                {Object.entries(stepMap).map(([key, val]) => {
                  return (
                    <option selected={val === step} value={val}>
                      {key}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div>Select a layer</div>
      )}
    </div>
  );
};

export default TemporalSlider;
