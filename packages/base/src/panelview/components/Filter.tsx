import { IJupyterGISModel } from '@jupytergis/schema';
import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { getSourceLayerNames } from '../../tools';
import { IControlPanelModel } from '../../types';
import { RightPanelWidget } from '../rightpanel';
// import { VectorTile } from '@mapbox/vector-tile';
// import Protobuf from 'pbf';

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
const FilterComponent = (props: IFilterComponentProps) => {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model.jGISModel
  );

  const [selectedLayer, setSelectedLayer] = useState('');

  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });
  // const selectedLayer = model.jGISModel?.localState?.selected?.value;

  const comparisonOperators = ['==', '!=', '>', '<'];

  const [selectedFeature, setSelectedFeature] = useState('mag');
  const [selectedOperator, setSelectedOperator] = useState('==');
  const [selectedNumber, setSelectedNumber] = useState('1');

  const selectedFeatureRef = useRef(selectedFeature);
  const selectedOperatorRef = useRef(selectedOperator);
  const selectedNumberRef = useRef(selectedNumber);

  useEffect(() => {
    model?.clientStateChanged.connect(() => {
      if (!model?.localState?.selected?.value) {
        return;
      }

      // TODO: handle multi select better
      const selectedLayer = Object.keys(model?.localState?.selected?.value)[0];
      setSelectedLayer(selectedLayer);
    });
  }, [model]);

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
    selectedOperatorRef.current = selectedOperator;
    selectedNumberRef.current = selectedNumber;
  }, [selectedFeature, selectedOperator, selectedNumber]);

  const handleAddFilter = async () => {
    if (!selectedLayer) {
      console.warn('Layer must be selected to apply filter');
    }
    const filterContainer = document.getElementById('filter-container');
    const featureList = document.getElementById('feature-list');

    if (!filterContainer || !featureList) {
      return;
    }

    filterContainer.style.display = 'block';

    const layer = model?.getLayer(selectedLayer);
    const source = model?.getSource(layer?.parameters?.source);

    let listOfFeatures: string[] = [];

    if (source?.type === 'VectorTileSource') {
      listOfFeatures = await getSourceLayerNames(source?.parameters?.url);
      console.log('ln', listOfFeatures);
    }

    if (source?.type === 'GeoJSONSource') {
      const data = await model?.readGeoJSON(source.parameters?.path);

      listOfFeatures = Object.keys(data?.features[0].properties);
    }

    listOfFeatures.forEach(feature => {
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
    setSelectedNumber(event.target.value);
  };

  document.getElementById('filter-container')?.addEventListener('change', e => {
    //TODO: this is temp
    const filters = model?.getFilters() ?? [];

    const filter = {
      layerId: selectedLayer,
      feature: selectedFeatureRef.current,
      operator: selectedOperatorRef.current,
      value: +selectedNumberRef.current
    };

    filters?.push(filter);

    model?.setFilters(filters);
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
