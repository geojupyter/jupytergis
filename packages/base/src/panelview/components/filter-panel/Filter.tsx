import {
  GeoJSONFeature1,
  IDict,
  IJGISFilterItem,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { cloneDeep } from 'lodash';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';

import { debounce, loadFile } from '@/src/tools';
import FilterRow from './FilterRow';

interface IFilterComponentProps {
  model: IJupyterGISModel;
}

const FilterComponent: React.FC<IFilterComponentProps> = props => {
  const featuresInLayerRef = useRef({});
  const [logicalOp, setLogicalOp] = useState('all');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [shouldDisplay, setShouldDisplay] = useState(false);
  const [filterRows, setFilterRows] = useState<IJGISFilterItem[]>([]);
  const [featuresInLayer, setFeaturesInLayer] = useState<
    Record<string, Set<string | number>>
  >({});
  const model = props.model;

  useEffect(() => {
    // Keep layer selected when widget changes
    if (model?.localState?.selected?.value) {
      setSelectedLayer(Object.keys(model?.localState?.selected?.value)[0]);
    }
  }, []);

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!model?.localState?.selected?.value) {
        return;
      }

      // TODO: handle multi select better
      const currentLayer = Object.keys(model?.localState?.selected?.value)[0];
      setSelectedLayer(currentLayer);
    };

    const handleSharedOptionsChanged = (_: any, keys: any) => {
      // model changes when current widget changes, don't want this to run in that case
      if (keys.has('zoom')) {
        if (!model?.localState?.selected?.value) {
          return;
        }
        const currentLayer = Object.keys(model?.localState?.selected?.value)[0];

        // TODO: Probably want to debounce/throttle here
        buildFilterDebounce(currentLayer);
      }
    };

    model?.clientStateChanged.connect(handleClientStateChanged);

    // Want to rebuild filter object when zoom changes to get values for that zoom level
    // This is because the filtering inputs may depend on the currently visible features
    model?.sharedOptionsChanged.connect(handleSharedOptionsChanged);

    return () => {
      model?.clientStateChanged.disconnect(handleClientStateChanged);
      model?.sharedOptionsChanged.disconnect(handleSharedOptionsChanged);
    };
  }, [model]);

  useEffect(() => {
    // Reset filter stuff for new layer
    setFeaturesInLayer({});

    const layer = model?.getLayer(selectedLayer);

    if (!layer || layer.type !== 'VectorLayer') {
      setShouldDisplay(false);
      return;
    }

    setShouldDisplay(true);

    // Add existing filters to filterRows
    setFilterRows(layer.filters?.appliedFilters ?? []);
    setLogicalOp(layer.filters?.logicalOp ?? 'all');

    buildFilterObject();
  }, [selectedLayer]);

  useEffect(() => {
    featuresInLayerRef.current = featuresInLayer;
  }, [featuresInLayer]);

  const buildFilterObject = async (currentLayer?: string) => {
    if (!model) {
      return;
    }
    const layer = model.getLayer(currentLayer ?? selectedLayer);
    const source = model.getSource(layer?.parameters?.source);

    if (!source || !layer) {
      return;
    }

    const aggregatedProperties: Record<
      string,
      Set<string | number>
    > = cloneDeep(featuresInLayerRef.current);

    // When we open a map, the filter object is empty.
    // We want to populate it with the values from the
    // selected layers filter so they show up  on the panel
    if (layer.filters) {
      layer.filters.appliedFilters.map(filterItem => {
        if (!(filterItem.feature in aggregatedProperties)) {
          aggregatedProperties[filterItem.feature] = new Set();
        }
        aggregatedProperties[filterItem.feature].add(filterItem.value);
      });
    }

    switch (source.type) {
      case 'GeoJSONSource': {
        const data = await loadFile({
          filepath: source.parameters?.path,
          type: 'GeoJSONSource',
          model: model,
        });
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
  const buildFilterDebounce = debounce(buildFilterObject, 500);

  const addFeatureValue = (
    featureProperties: Record<string, string | number> | IDict,
    aggregatedProperties: Record<string, Set<string | number>>,
  ) => {
    Object.entries(featureProperties).forEach(([key, value]) => {
      if (!(key in aggregatedProperties)) {
        aggregatedProperties[key] = new Set();
      }
      aggregatedProperties[key].add(value);
    });
  };

  const addFilterRow = () => {
    setFilterRows([
      ...filterRows,
      {
        feature: Object.keys(featuresInLayer)[0],
        operator: '==',
        value: [...Object.values(featuresInLayer)[0]][0],
      },
    ]);
  };

  const deleteRow = (index: number) => {
    const newFilters = [...filterRows];
    newFilters.splice(index, 1);

    updateLayerFilters(newFilters);
    setFilterRows(newFilters);
  };

  const handleLogicalOpChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLogicalOp(event.target.value);
    updateLayerFilters(filterRows, event.target.value);
  };

  const clearFilters = () => {
    updateLayerFilters([]);
    setFilterRows([]);
  };

  const submitFilter = () => {
    updateLayerFilters(filterRows);
  };

  const updateLayerFilters = (filters: IJGISFilterItem[], op?: string) => {
    const layer = model?.getLayer(selectedLayer);
    if (!layer) {
      return;
    }

    layer.filters = {
      logicalOp: op ?? logicalOp,
      appliedFilters: filters,
    };
    model?.sharedModel.updateLayer(selectedLayer, layer);
  };

  return (
    <>
      {shouldDisplay && (
        <div className="jp-gis-filter-main">
          <div id="filter-container" className="jp-gis-filter-select-container">
            <select
              className="jp-mod-styled rjsf jp-gis-logical-select"
              onChange={handleLogicalOpChange}
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
            <div
              style={{
                justifyContent: 'flex-start',
              }}
            >
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
        </div>
      )}
      {!shouldDisplay && (
        <div style={{ textAlign: 'center' }}>No layer selected</div>
      )}
    </>
  );
};

export default FilterComponent;
