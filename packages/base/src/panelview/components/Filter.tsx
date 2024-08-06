import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { IControlPanelModel } from '../../types';
import { RightPanelWidget } from '../rightpanel';

/**
 * The layers panel widget.
 */
export class FilterPanel extends Panel {
  constructor(options: RightPanelWidget.IOptions) {
    super();
    this._model = options.model;

    this.id = 'jupytergis::layerTree';
    // this.addClass(LAYERS_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <FilterComponent model={this._model}></FilterComponent>
      )
    );
  }

  private _model: IControlPanelModel | undefined;
}

interface IFilterComponentProps {
  model: IControlPanelModel;
}
const FilterComponent = ({ model }: IFilterComponentProps) => {
  const selectedLayer = model.jGISModel?.localState?.selected?.value;

  const comparisonOperators = ['==', '!=', '>', '<'];

  const [selectedFeature, setSelectedFeature] = useState('mag');
  const [selectedOperator, setSelectedOperator] = useState('==');
  const [selectedNumber, setSelectedNumber] = useState('1');

  const selectedFeatureRef = useRef(selectedFeature);
  const selectedOperatorRef = useRef(selectedOperator);
  const selectedNumberRef = useRef(selectedNumber);

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
    selectedOperatorRef.current = selectedOperator;
    selectedNumberRef.current = selectedNumber;
  }, [selectedFeature, selectedOperator, selectedNumber]);

  const handleAddFilter = () => {
    console.log('selectedLayer', selectedLayer);
    const filterContainer = document.getElementById('filter-container');
    const featureList = document.getElementById('feature-list');

    if (!filterContainer || !featureList) {
      return;
    }

    filterContainer.style.display = 'block';
    // need to get the features.properties from a geojson or a source-layers from a vector here
    // use that to populate the feature list
    const pretendList = ['felt', 'mag', 'tsunami'];

    pretendList.forEach(feature => {
      const optionEl = document.createElement('option');
      optionEl.value = feature;
      optionEl.text = feature;
      featureList.appendChild(optionEl);
    });
  };

  const handleFeatureChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedFeature(event.target.value);
  };
  const handleOpChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedOperator(event.target.value);
  };

  const handleNumChange = (event: ChangeEvent<HTMLInputElement>) => {
    console.log('num change', event.target.value);
    setSelectedNumber(event.target.value);
  };

  document.getElementById('filter-container')?.addEventListener('change', e => {
    console.log('e.target.id', e.target);
    // want to send a emit a signal here that'll trigger a filter method in mainview
    const filter = {
      feature: selectedFeatureRef.current,
      operator: selectedOperatorRef.current,
      value: +selectedNumberRef.current
    };

    console.log(
      'wififi',
      selectedFeatureRef.current,
      selectedOperatorRef.current,
      selectedNumberRef.current
    );
    console.log('filter', filter);
    model.jGISModel?.setFilters(filter);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 7 }}>
      <div>
        list of filters
        <Button className="jp-mod-accept" onClick={handleAddFilter}>
          Add Filter
        </Button>
      </div>

      <div id="filter-container" style={{ display: 'none' }}>
        <select
          id="feature-list"
          value={selectedFeature}
          onChange={handleFeatureChange}
        ></select>
        <select
          id="filter-operators"
          //   className="jp-mod-styled"
          value={selectedOperator}
          onChange={handleOpChange}
          aria-label="Select source"
        >
          {comparisonOperators.map(op => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1.0}
          max={10000}
          value={selectedNumber}
          onChange={handleNumChange}
        />
      </div>
    </div>
  );
};

export default FilterComponent;
