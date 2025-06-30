import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Slider } from '@jupyter/react-components';
import {
  IDict,
  IJGISFilterItem,
  IJGISLayerDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { format, isValid, parse } from 'date-fns';
import {
  daysInYear,
  millisecondsInDay,
  millisecondsInHour,
  millisecondsInMinute,
  millisecondsInSecond,
  millisecondsInWeek,
  minutesInMonth,
} from 'date-fns/constants';
import React, { useEffect, useRef, useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';

interface ITemporalSliderProps {
  model: IJupyterGISModel;
  filterStates: IDict<IJGISFilterItem | undefined>;
}

// List of common date formats to try
// TODO: Not even close to every valid format
const commonDateFormats = [
  'yyyy-MM-dd', // ISO format (e.g., 2023-10-05)
  'dd/MM/yyyy', // European format (e.g., 05/10/2023)
  'MM/dd/yyyy', // US format (e.g., 10/05/2023)
  'yyyyMMdd', // Compact format (e.g., 20231005)
  'dd-MM-yyyy', // European format with hyphens (e.g., 05-10-2023)
  'MM-dd-yyyy', // US format with hyphens (e.g., 10-05-2023)
  'yyyy/MM/dd', // ISO format with slashes (e.g., 2023/10/05)
  'dd.MM.yyyy', // European format with dots (e.g., 05.10.2023)
  'MM.dd.yyyy', // US format with dots (e.g., 10.05.2023)
];

// Time steps in milliseconds
const stepMap = {
  millisecond: 1,
  second: millisecondsInSecond,
  minute: millisecondsInMinute,
  hour: millisecondsInHour,
  day: millisecondsInDay,
  week: millisecondsInWeek,
  month: minutesInMonth * millisecondsInMinute,
  year: millisecondsInDay * daysInYear,
};

const TemporalSlider: React.FC<ITemporalSliderProps> = props => {
  const [layerId, setLayerId] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [range, setRange] = useState({ start: 0, end: 1 }); // min/max of current range being displayed
  const [minMax, setMinMax] = useState({ min: 0, max: 1 }); // min/max of data values
  const [validFeatures, setValidFeatures] = useState<string[]>([]);
  const [dateFormat, setDateFormat] = useState('yyyy-MM-dd');
  const [step, setStep] = useState(stepMap.year);
  const [currentValue, setCurrentValue] = useState(0);
  const [fps, setFps] = useState(1);
  const [validSteps, setValidSteps] = useState<IDict>({});

  const layerIdRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { featureProperties } = useGetProperties({ layerId, model: props.model });

  useEffect(() => {
    // This is for when the selected layer changes
    const handleClientStateChanged = () => {
      if (!props.model.localState?.selected?.value) {
        return;
      }

      const selectedLayerId = Object.keys(props.model.localState.selected.value)[0];

      // reset
      if (selectedLayerId !== layerIdRef.current) {
        setLayerId(selectedLayerId);
        setDateFormat('yyyy-MM-dd');
        setFps(1);
      }
    };

    // this is for when the layer itself changes
    const handleLayerChange = (
      _: IJupyterGISDoc,
      change: IJGISLayerDocChange,
    ) => {
      // Get the changes for the selected layer
      const selectedLayer = change.layerChange?.find(
        layer => layer.id === layerIdRef.current,
      );

      // Bail if there's no relevant change
      if (!selectedLayer?.newValue) {
        return;
      }

      const { newValue, oldValue } = selectedLayer;

      // If layer was deleted (empty object) or the layer type changed, close the temporal controller
      if (
        Object.keys(newValue).length === 0 ||
        newValue.type !== oldValue.type
      ) {
        props.model.toggleTemporalController();
      }
    };

    // Initial state
    handleClientStateChanged();

    props.model.clientStateChanged.connect(handleClientStateChanged);
    props.model.sharedLayersChanged.connect(handleLayerChange);

    return () => {
      props.model.clientStateChanged.disconnect(handleClientStateChanged);
      props.model.sharedLayersChanged.disconnect(handleLayerChange);
      removeFilter();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    layerIdRef.current = layerId;
  }, [layerId]);

  useEffect(() => {
    const results: string[] = [];

    for (const [key, set] of Object.entries(featureProperties)) {
      if (set.size === 0) {
        continue;
      }

      const sampleValue = set.values().next().value;

      // Validate value type
      const isString = typeof sampleValue === 'string';
      const isInteger = Number.isInteger(sampleValue);
      if (!isString && !isInteger) {
        continue;
      }

      // Date validation
      if (isString) {
        const dateFormatFromString = determineDateFormat(sampleValue);

        if (!dateFormatFromString) {
          continue;
        }
        setDateFormat(dateFormatFromString);
      }

      results.push(key);
    }

    // if we have state then remove the ms from the converted feature name
    const currentState = props.filterStates[layerId];
    const currentFeature = currentState?.feature.slice(0, -2);
    setValidFeatures(results);
    setSelectedFeature(currentFeature ?? results[0]);
  }, [featureProperties]);

  useEffect(() => {
    if (!selectedFeature || !featureProperties[selectedFeature]) {
      return;
    }

    // Get and validate values
    const valueSet = featureProperties[selectedFeature];
    if (valueSet.size === 0) {
      return;
    }

    const values = Array.from(valueSet);
    const [firstValue] = values;

    // Check the type of the first element
    const isString = typeof firstValue === 'string';

    let convertedValues: number[];

    if (isString) {
      convertedValues = values.map(value => Date.parse(value)); // Convert all strings to milliseconds
    } else {
      convertedValues = values; // Keep numbers as they are
    }

    // Calculate min and max
    const min = Math.min(...convertedValues);
    const max = Math.max(...convertedValues);

    // Get valid step options
    const filteredSteps = Object.fromEntries(
      Object.entries(stepMap).filter(([_, val]) => val < max - min),
    );

    //using filter item as a state object to restore prev values
    const currentState = props.filterStates[layerId];
    const step =
      Object.values(filteredSteps).slice(-1)[0] ?? stepMap.millisecond;

    setValidSteps(filteredSteps);
    setStep(step);
    setMinMax({ min, max });
    setRange({
      start: currentState?.betweenMin ?? min,
      end: currentState?.betweenMax ?? min + step,
    });

    props.model.addFeatureAsMs(layerId, selectedFeature);
  }, [selectedFeature]);

  // minMax needs to be set before current value so the slider displays correctly
  useEffect(() => {
    const currentState = props.filterStates[layerId];

    setCurrentValue(
      typeof currentState?.value === 'number' ? currentState.value : minMax.min,
    );
  }, [minMax]);

  // Guess the date format from a date string
  const determineDateFormat = (dateString: string): string | null => {
    for (const format of commonDateFormats) {
      const parsedDate = parse(dateString, format, new Date());
      if (isValid(parsedDate)) {
        return format; // Return the format if the date is valid
      }
    }
    return null; // Return null if no format matches
  };

  // Convert milliseconds back to the original date string format
  const millisecondsToDateString = (
    milliseconds: number,
    dateFormat: string,
  ): string => {
    const date = new Date(milliseconds); // Create a Date object from milliseconds
    return format(date, dateFormat); // Format back to the original string format
  };

  const handleChange = (e: any) => {
    setCurrentValue(+e.target.value);
    setRange({ start: +e.target.value, end: +e.target.value + step });
    applyFilter(+e.target.value);
  };

  const applyFilter = (value: number) => {
    const newFilter = {
      feature: `${selectedFeature}ms`,
      operator: 'between' as const,
      value: value,
      betweenMin: value,
      betweenMax: value + step,
    };

    const layer = props.model.getLayer(layerId);
    if (!layer) {
      return;
    }

    const appliedFilters = layer.filters?.appliedFilters || [];
    const logicalOp = layer.filters?.logicalOp || 'all';

    // This is the only way to add a 'between' filter so
    // find the index of the existing 'between' filter
    const betweenFilterIndex = appliedFilters.findIndex(
      filter => filter.operator === 'between',
    );

    if (betweenFilterIndex !== -1) {
      // If found, replace the existing filter
      appliedFilters[betweenFilterIndex] = {
        ...newFilter,
      };
    } else {
      // If not found, add the new filter
      appliedFilters.push(newFilter);
    }

    // Apply the updated filters to the layer
    layer.filters = { logicalOp, appliedFilters };
    props.model.triggerLayerUpdate(layerId, layer);
  };

  const removeFilter = () => {
    const layer = props.model.getLayer(layerIdRef.current);
    if (!layer) {
      return;
    }

    const appliedFilters = layer.filters?.appliedFilters || [];
    const logicalOp = layer.filters?.logicalOp || 'all';

    // This is the only way to add a 'between' filter so
    // find the index of the existing 'between' filter
    const betweenFilterIndex = appliedFilters.findIndex(
      filter => filter.operator === 'between',
    );

    if (betweenFilterIndex !== -1) {
      // If found, replace the existing filter
      appliedFilters.splice(betweenFilterIndex, 1);
    }

    // Apply the updated filters to the layer
    layer.filters = { logicalOp, appliedFilters };
    props.model.triggerLayerUpdate(layerIdRef.current, layer);
  };

  const playAnimation = () => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const incrementValue = () => {
      setCurrentValue(prev => {
        // Calculate next value with safety bounds
        const nextValue = prev + step;

        // Clear interval if we've reached the max
        // step is subtracted to keep range values correct
        if (nextValue >= minMax.max - step && intervalRef.current) {
          clearInterval(intervalRef.current);
          return minMax.max - step;
        }

        return nextValue;
      });
    };

    // Start animation
    intervalRef.current = setInterval(incrementValue, 1000 / fps);
  };

  const pauseAnimation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  return (
    <div className="jp-gis-temporal-slider-container">
      <div className="jp-gis-temporal-slider-row">
        {/* Feature select */}
        <div>
          <label htmlFor="time-feature-select">Feature: </label>
          <select
            id="time-feature-select"
            onChange={e => {
              setSelectedFeature(e.target.value);
            }}
          >
            {validFeatures.map(feature => {
              return (
                <option value={feature} selected={selectedFeature === feature}>
                  {feature}
                </option>
              );
            })}
          </select>
        </div>
        {/* Current frame */}
        <div>
          <span>Current Frame:</span>{' '}
          {millisecondsToDateString(range.start, dateFormat)} ≤ <span>t</span> ≤{' '}
          {millisecondsToDateString(range.end, dateFormat)}
        </div>
      </div>
      <div className="jp-gis-temporal-slider-row">
        {/* controls */}
        <div className="jp-gis-temporal-slider-controls">
          <div className="jp-gis-temporal-slider-sub-controls">
            <Button
              appearance="neutral"
              scale="medium"
              onClick={pauseAnimation}
            >
              <FontAwesomeIcon icon={faPause} />
            </Button>
            <Button appearance="neutral" scale="medium" onClick={playAnimation}>
              <FontAwesomeIcon icon={faPlay} />
            </Button>
          </div>
          <div
            className="jp-gis-temporal-slider-sub-controls"
            style={{ minWidth: 0 }}
          >
            <label htmlFor="fps-number-input">FPS:</label>
            <input
              name="fps-number-input"
              type="number"
              value={fps}
              onChange={e => setFps(+e.target.value)}
            />
          </div>
        </div>
        {/* slider */}
        <div>
          <Slider
            min={minMax.min}
            max={minMax.max - step}
            value={currentValue}
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
          {millisecondsToDateString(minMax.min, dateFormat)} <span>to </span>
          {millisecondsToDateString(minMax.max, dateFormat)}
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
            {Object.entries(validSteps).map(([key, val]) => (
              <option key={key} selected={val === step} value={val}>
                {key}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default TemporalSlider;
