import {
  GeoJSONFeature1,
  IJGISFilterItem,
  IJupyterGISModel
} from '@jupytergis/schema';
import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { useEffect, useState } from 'react';
import { getSourceLayerNames } from '../../tools';
import { IControlPanelModel } from '../../types';
import { RightPanelWidget } from '../rightpanel';

/**
 * The filters panel widget.
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
  const [filterRows, setFilterRows] = useState<IJGISFilterItem[]>([]);
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model.jGISModel
  );
  const [featureStuff, setFeatureStuff] = useState<Record<string, Set<string>>>(
    {}
  );

  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });

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
    buildFilterObject();
  }, [selectedLayer]);

  const buildFilterObject = async () => {
    setFilterRows([]);
    if (!model) {
      return;
    }
    const layer = model.getLayer(selectedLayer);
    const source = model.getSource(layer?.parameters?.source);
    const { latitude, longitude, zoom } = model.getOptions();

    if (!source || !layer) {
      return;
    }

    const aggregatedProperties: Record<string, Set<string>> = {};

    switch (source.type) {
      case 'VectorTileSource': {
        const tile = await getSourceLayerNames(source?.parameters?.url, {
          latitude,
          longitude,
          zoom
        });
        const layerValue = tile.layers[layer.parameters?.sourceLayer];
        for (let i = 0; i < layerValue.length; i++) {
          const feature = layerValue.feature(i);
          Object.entries(feature.properties).forEach(([key, value]) => {
            if (!(key in aggregatedProperties)) {
              aggregatedProperties[key] = new Set();
            }
            aggregatedProperties[key].add(String(value));
          });
        }
        break;
      }
      case 'GeoJSONSource': {
        const data = await model?.readGeoJSON(source.parameters?.path);
        data?.features.forEach((feature: GeoJSONFeature1) => {
          feature.properties &&
            Object.entries(feature.properties).forEach(([key, value]) => {
              if (!(key in aggregatedProperties)) {
                aggregatedProperties[key] = new Set();
              }
              aggregatedProperties[key].add(String(value));
            });
        });
        break;
      }
      default: {
        break;
      }
    }

    setFeatureStuff(aggregatedProperties);
  };

  useEffect(() => {
    console.log('rows', filterRows);
  }, [filterRows]);

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

  const addFilterRow = () => {
    const filterContainer = document.getElementById('filter-container');

    if (!filterContainer) {
      return;
    }
    filterContainer.style.display = 'block';

    setFilterRows([
      ...filterRows,
      {
        feature: Object.keys(featureStuff)[0],
        operator: '==',
        value: [...Object.values(featureStuff)[0]][0]
      }
    ]);
  };

  const clearFilters = () => {
    setFilterRows([]);
    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }
    layer.filters = [];
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  const submitFilter = () => {
    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }
    layer.filters = filterRows;
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 7 }}>
      {selectedLayer && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayFilters()}
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Button
                className="jp-Dialog-button jp-mod-accept jp-mod-styled"
                onClick={addFilterRow}
              >
                Add
              </Button>
              <Button
                className="jp-Dialog-button jp-mod-reject jp-mod-styled"
                onClick={clearFilters}
              >
                Clear
              </Button>
            </div>

            <div id="filter-container" style={{ display: 'none' }}>
              {filterRows.map((row, index) => (
                <FilterRow
                  key={index}
                  index={index}
                  features={featureStuff}
                  rows={filterRows}
                  setRows={setFilterRows}
                />
              ))}
            </div>
            <Button
              className="jp-Dialog-button jp-mod-accept jp-mod-styled"
              onClick={submitFilter}
            >
              Submit
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

const FilterRow = ({
  index,
  features,
  rows,
  setRows
}: {
  index: number;
  features: Record<string, Set<string>>;
  rows: any;
  setRows: any;
}) => {
  const operators = ['==', '!=', '>', '<'];

  const [selectedFeature, setSelectedFeature] = useState(
    Object.keys(features)[0]
  );

  useEffect(() => {
    const valueSelect = document.getElementById(
      `filter-value${index}`
    ) as HTMLSelectElement;
    if (!valueSelect) {
      return;
    }
    const currentValue = valueSelect.options[valueSelect.selectedIndex].value;
    handleValueChange({
      target: { value: currentValue }
    });
  }, [selectedFeature]);

  const handleKeyChange = event => {
    const newFilters = [...rows];
    newFilters[index].key = event.target.value;
    setSelectedFeature(event.target.value);
    setRows(newFilters);
  };

  const handleOperatorChange = event => {
    const newFilters = [...rows];
    newFilters[index].operator = event.target.value;
    setRows(newFilters);
  };

  const handleValueChange = event => {
    const newFilters = [...rows];
    newFilters[index].value = event.target.value;
    setRows(newFilters);
  };

  return (
    <div>
      <select onChange={handleKeyChange}>
        {/* Populate options based on the keys of the filters object */}
        {Object.keys(features).map((key, keyIndex) => (
          <option key={keyIndex} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select onChange={handleOperatorChange}>
        {operators.map((operator, operatorIndex) => (
          <option key={operatorIndex} value={operator}>
            {operator}
          </option>
        ))}
      </select>
      <select id={`filter-value${index}`} onChange={handleValueChange}>
        {/* Populate options based on the values of the selected key */}
        {features[selectedFeature] &&
          [...features[selectedFeature]].map((value, valueIndex) => (
            <option key={valueIndex} value={value}>
              {value}
            </option>
          ))}
      </select>
    </div>
  );
};

export default FilterComponent;
