import {
  GeoJSONFeature1,
  IDict,
  IJGISFilterItem,
  IJupyterGISModel
} from '@jupytergis/schema';
import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import { cloneDeep } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { getLayerTileInfo } from '../../../tools';
import { IControlPanelModel } from '../../../types';
import { RightPanelWidget } from '../../rightpanel';
import FilterRow from './FilterRow';

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
  const featuresInLayerRef = useRef({});
  const [logicalOp, setLogicalOp] = useState('all');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [filterRows, setFilterRows] = useState<IJGISFilterItem[]>([]);
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model.jGISModel
  );
  const [featuresInLayer, setFeaturesInLayer] = useState<
    Record<string, Set<string>>
  >({});

  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });

  useEffect(() => {
    model?.clientStateChanged.connect(() => {
      if (!model?.localState?.selected?.value) {
        return;
      }

      // TODO: handle multi select better
      const currentLayer = Object.keys(model?.localState?.selected?.value)[0];
      setSelectedLayer(currentLayer);
    });

    model?.sharedOptionsChanged.connect((_, keys) => {
      if (keys.has('zoom')) {
        if (!model?.localState?.selected?.value) {
          return;
        }
        const currentLayer = Object.keys(model?.localState?.selected?.value)[0];

        // TODO: Probably want to debounce/throttle here
        buildFilterObject(currentLayer);
      }
    });
  }, [model]);

  useEffect(() => {
    // Reset filter stuff for new layer
    setFeaturesInLayer({});

    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }

    // Add existing filters to filterRows
    setFilterRows(layer.filters?.appliedFilters ?? []);
    setLogicalOp(layer.filters?.logicalOp ?? 'all');

    buildFilterObject();
  }, [selectedLayer]);

  useEffect(() => {
    featuresInLayerRef.current = featuresInLayer;
  }, [featuresInLayer]);

  useEffect(() => {
    console.log('filterRows', filterRows);
  }, [filterRows]);

  const buildFilterObject = async (currentLayer?: string) => {
    if (!model) {
      return;
    }
    const layer = model.getLayer(currentLayer ?? selectedLayer);
    const source = model.getSource(layer?.parameters?.source);
    const { latitude, longitude, zoom } = model.getOptions();

    if (!source || !layer) {
      return;
    }

    const aggregatedProperties: Record<string, Set<string>> = cloneDeep(
      featuresInLayerRef.current
    );

    // When we open a map, the filter object is empty.
    // We want to populate it with the values from the
    // selected layers filter so they show up  on the panel
    if (layer.filters) {
      layer.filters.appliedFilters.map(filterItem => {
        if (!(filterItem.feature in aggregatedProperties)) {
          aggregatedProperties[filterItem.feature] = new Set();
        }
        aggregatedProperties[filterItem.feature].add(String(filterItem.value));
      });
    }

    switch (source.type) {
      case 'VectorTileSource': {
        try {
          const tile = await getLayerTileInfo(source?.parameters?.url, {
            latitude,
            longitude,
            zoom
          });
          const layerValue = tile.layers[layer.parameters?.sourceLayer];
          for (let i = 0; i < layerValue.length; i++) {
            const feature = layerValue.feature(i);
            addFeatureValue(feature.properties, aggregatedProperties);
          }
        } catch (error) {
          console.warn(`Error fetching tile info: ${error}`);
        }
        break;
      }
      case 'GeoJSONSource': {
        const data = await model?.readGeoJSON(source.parameters?.path);
        data?.features.forEach((feature: GeoJSONFeature1) => {
          feature.properties &&
            addFeatureValue(feature.properties, aggregatedProperties);
        });
        break;
      }
      default: {
        console.warn('Source type not supported');
        break;
      }
    }

    setFeaturesInLayer(aggregatedProperties);
  };

  const addFeatureValue = (
    featureProperties: Record<string, unknown> | IDict,
    aggregatedProperties: Record<string, Set<string>>
  ) => {
    Object.entries(featureProperties).forEach(([key, value]) => {
      if (!(key in aggregatedProperties)) {
        aggregatedProperties[key] = new Set();
      }
      aggregatedProperties[key].add(String(value));
    });
  };

  const addFilterRow = () => {
    setFilterRows([
      ...filterRows,
      {
        feature: Object.keys(featuresInLayer)[0],
        operator: '==',
        value: [...Object.values(featuresInLayer)[0]][0]
      }
    ]);
  };

  const deleteRow = (index: number) => {
    const newFilters = [...filterRows];
    newFilters.splice(index, 1);

    updateLayerFilters(newFilters);
    setFilterRows(newFilters);
  };

  const clearFilters = () => {
    updateLayerFilters([]);
    setFilterRows([]);
  };

  const submitFilter = () => {
    console.log('logicalOp', logicalOp);
    updateLayerFilters(filterRows);
  };

  const updateLayerFilters = (filters: IJGISFilterItem[]) => {
    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }

    layer.filters = { logicalOp, appliedFilters: filters };
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  return (
    <div className="jp-gis-filter-main">
      {selectedLayer && (
        <>
          <div id="filter-container" className="jp-gis-filter-select-container">
            <select
              className="jp-mod-styled jp-SchemaForm"
              onChange={event => setLogicalOp(event?.target.value)}
            >
              <option key="all" value="all" selected={logicalOp === 'all'}>
                All
              </option>
              <option key="any" value="any" selected={logicalOp === 'any'}>
                Any
              </option>
            </select>
            {filterRows.map((row, index) => (
              <FilterRow
                key={index}
                index={index}
                features={featuresInLayer}
                filterRows={filterRows}
                setFilterRows={setFilterRows}
                deleteRow={() => deleteRow(index)}
              />
            ))}
          </div>
          <div className="jp-gis-filter-button-container">
            <div style={{ justifyContent: 'flex-start' }}>
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

export default FilterComponent;
