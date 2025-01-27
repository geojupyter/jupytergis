import { Slider } from '@jupyter/react-components';
import { IJGISFilterItem, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { useGetProperties } from '../dialogs/symbology/hooks/useGetProperties';

interface ITemporalSliderProps {
  model: IJupyterGISModel;
}

const TemporalSlider = ({ model }: ITemporalSliderProps) => {
  const [layerId, setLayerId] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [range, setRange] = useState({ start: 0, end: 1 });
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
      operator: '<=' as const,
      value: e.target.value
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
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  const updateLayerFilters = (filters: IJGISFilterItem[], op?: string) => {
    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }

    const oldFilters = layer.filters?.appliedFilters;

    const newFilters = oldFilters ? [...oldFilters] : [];

    layer.filters = { logicalOp: 'all', appliedFilters: filters };
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  const setFeature = (e: any) => {
    console.log('e.target.value', e.target.value);
    setSelectedFeature(e.target.value);
  };

  return (
    <div className="jp-gis-temporal-slider-container">
      <div>
        <select onChange={setFeature}>
          {Object.keys(featureProps).map(feature => {
            return <option value={feature}>{feature}</option>;
          })}
        </select>
      </div>
      <div>{new Date(range.start).toLocaleString()}</div>
      <Slider
        min={range.start}
        max={range.end}
        step={60 * 60 * 1000}
        onChange={handleChange}
        className="jp-gis-temporal-slider"
      />
      <div>{new Date(range.end).toLocaleString()}</div>

      <div>step</div>
    </div>
  );
};

export default TemporalSlider;
