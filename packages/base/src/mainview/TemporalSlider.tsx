import { Slider } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { useGetProperties } from '../dialogs/symbology/hooks/useGetProperties';

interface ITemporalSliderProps {
  model: IJupyterGISModel;
}

const TemporalSlider = ({ model }: ITemporalSliderProps) => {
  const [layerId, setLayerId] = useState('');
  //   const [selectedLayer, setSelectedLayer] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [range, setRange] = useState({ start: 0, end: 1 });
  const [validFeatures, setValidFeatures] = useState<string[]>([]);
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
    console.log('layerId', layerId);
    console.log('featureProps', featureProps);
    const featuresForSelect = [];

    // We only want to show features that could be time values
    for (const [key, set] of Object.entries(featureProps)) {
      const checkValue = set.values().next().value;
      console.log('checkValue', checkValue, typeof checkValue);
      const [cv2] = set;
      console.log('cv2', cv2, typeof cv2);

      if (checkValue && isValidDate(checkValue)) {
        featuresForSelect.push(key);
      }
    }

    setValidFeatures(featuresForSelect);
  }, [layerId, featureProps]);

  useEffect(() => {
    console.log('selectedFeature', selectedFeature);
    if (!selectedFeature) {
      return;
    }
    const values: number[] = Array.from(featureProps[selectedFeature]);
    console.log('values', values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    setRange({ start: min, end: max });
    console.log('min, max', min, max);
  }, [selectedFeature]);

  const isValidDate = (val: any) => {
    const date = new Date(val);

    return !isNaN(date.getTime());
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

    const nf = {
      feature: selectedFeature,
      operator: '>=' as const,
      value: +e.target.value
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
