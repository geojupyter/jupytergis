import { GeoJSONFeature1, IJupyterGISModel } from '@jupytergis/schema';
import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { ChangeEvent, useEffect, useState } from 'react';
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
  const [selectedLayer, setSelectedLayer] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model.jGISModel
  );
  const [filterStuff, setFilterStuff] = useState<Record<string, Set<unknown>>>(
    {}
  );

  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });

  const comparisonOperators = ['==', '!=', '>', '<'];

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
    handleFilterChange();
  }, [selectedFeature, selectedOperator, selectedNumber]);

  useEffect(() => {
    buildFilterObject();
  }, [selectedLayer]);

  useEffect(() => {
    const valuesList = document.getElementById(
      'values-list'
    ) as HTMLSelectElement | null;

    const values = filterStuff[selectedFeature];
    if (!valuesList || !values) {
      return;
    }

    valuesList.options.length = 0;
    for (const value of values) {
      const option = document.createElement('option');
      option.value = String(value);
      option.text = String(value);
      valuesList.appendChild(option);
    }
  }, [selectedFeature]);

  const buildFilterObject = async () => {
    const layer = model?.getLayer(selectedLayer);
    const source = model?.getSource(layer?.parameters?.source);

    if (!source) {
      return;
    }

    const aggregatedProperties: Record<string, Set<unknown>> = {};

    switch (source.type) {
      case 'VectorTileSource': {
        const tile = await getSourceLayerNames(source?.parameters?.url);
        for (const layerValue of Object.values(tile.layers)) {
          for (let i = 0; i < layerValue.length; i++) {
            const feature = layerValue.feature(i);
            Object.entries(feature.properties).forEach(
              ([propertyKey, propertyValue]) => {
                if (!(propertyKey in aggregatedProperties)) {
                  aggregatedProperties[propertyKey] = new Set();
                }
                aggregatedProperties[propertyKey].add(propertyValue);
              }
            );
          }
        }
        break;
      }
      case 'GeoJSONSource': {
        const data = await model?.readGeoJSON(source.parameters?.path);
        data?.features.forEach((feature: GeoJSONFeature1) => {
          feature.properties &&
            Object.entries(feature.properties).forEach(([pk, pv]) => {
              if (!(pk in aggregatedProperties)) {
                aggregatedProperties[pk] = new Set();
              }
              aggregatedProperties[pk].add(pv);
            });
        });
        break;
      }
      default: {
        break;
      }
    }

    setFilterStuff(aggregatedProperties);
  };

  const handleFilterChange = () => {
    const layer = model?.getLayer(selectedLayer);

    if (!layer) {
      return;
    }

    const filter = {
      feature: selectedFeature,
      operator: selectedOperator,
      value: +selectedNumber
    };

    // TODO: Only going to have one filter for now
    layer.filters = [];

    layer.filters = [...layer.filters, filter];
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  const handleAddFilter = async () => {
    // Display filter selector
    if (!selectedLayer) {
      console.warn('Layer must be selected to apply filter');
    }
    const filterContainer = document.getElementById('filter-container');
    const featureList = document.getElementById('feature-list');
    const valuesList = document.getElementById('values-list');

    if (!filterContainer || !featureList || !valuesList) {
      return;
    }

    filterContainer.style.display = 'block';

    console.log('filterStuff', filterStuff);

    for (const key in filterStuff) {
      const option = document.createElement('option');
      option.value = key;
      option.text = key;
      featureList.appendChild(option);
    }

    // TODO: This doesnt work right
    const values = filterStuff[selectedFeature];
    for (const value of values) {
      const option = document.createElement('option');
      option.value = String(value);
      option.text = String(value);
      valuesList.appendChild(option);
    }
  };

  const handleFeatureChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedFeature(event.target.value);
  };

  const handleOpChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedOperator(event.target.value);
  };

  const handleNumChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedNumber(event.target.value);
  };

  const displayFilters = () => {
    const layer = model?.getLayer(selectedLayer);

    return (
      <ul style={{ listStyleType: 'none' }}>
        {layer?.filters?.map(filter => (
          <li>
            {filter.feature} {filter.operator} {filter.value}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 7 }}>
      {selectedLayer && (
        <div>
          {displayFilters()}
          <Button className="jp-mod-accept" onClick={handleAddFilter}>
            Add Filter
          </Button>
        </div>
      )}

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
        {/* <input
          type="number"
          min={1.0}
          max={10000}
          value={selectedNumber}
          onChange={handleNumChange}
        /> */}
        <select
          id="values-list"
          value={selectedNumber}
          onChange={handleNumChange}
        ></select>
      </div>
    </div>
  );
};

export default FilterComponent;
