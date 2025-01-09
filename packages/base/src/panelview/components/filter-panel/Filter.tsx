import {
  GeoJSONFeature1,
  IDict,
  IJGISFilterItem,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import { Button, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import { cloneDeep } from 'lodash';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { debounce, getLayerTileInfo } from '../../../tools';
import { IControlPanelModel } from '../../../types';
import FilterRow from './FilterRow';
import { loadFile } from '../../../tools';

/**
 * The filters panel widget.
 */
export class FilterPanel extends Panel {
  constructor(options: FilterPanel.IOptions) {
    super();
    this._model = options.model;
    this._tracker = options.tracker;

    this.id = 'jupytergis::layerTree';
    // this.addClass(LAYERS_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <FilterComponent
          model={this._model}
          tracker={this._tracker}
        ></FilterComponent>
      )
    );
  }

  private _model: IControlPanelModel | undefined;
  private _tracker: IJupyterGISTracker;
}

export namespace FilterPanel {
  export interface IOptions {
    model: IControlPanelModel;
    tracker: IJupyterGISTracker;
    formSchemaRegistry: IJGISFormSchemaRegistry;
  }
}

interface IFilterComponentProps {
  model: IControlPanelModel;
  tracker: IJupyterGISTracker;
}

const FilterComponent = (props: IFilterComponentProps) => {
  const featuresInLayerRef = useRef({});
  const [widgetId, setWidgetId] = useState('');
  const [logicalOp, setLogicalOp] = useState('all');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [shouldDisplay, setShouldDisplay] = useState(false);
  const [filterRows, setFilterRows] = useState<IJGISFilterItem[]>([]);
  const [featuresInLayer, setFeaturesInLayer] = useState<
    Record<string, Set<string | number>>
  >({});
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model.jGISModel
  );

  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });

  // Reset state values when current widget changes
  useEffect(() => {
    const handleCurrentChanged = () => {
      if (props.tracker.currentWidget?.id === widgetId) {
        return;
      }

      if (props.tracker.currentWidget) {
        setWidgetId(props.tracker.currentWidget.id);
      }
      setFeaturesInLayer({});
      setFilterRows([]);
      setLogicalOp('all');
      setSelectedLayer('');
    };
    props.tracker.currentChanged.connect(handleCurrentChanged);

    return () => {
      props.tracker.currentChanged.disconnect(handleCurrentChanged);
    };
  }, []);

  useEffect(() => {
    // Keep layer selected when widget changes
    if (model?.localState?.selected?.value) {
      setSelectedLayer(Object.keys(model?.localState?.selected?.value)[0]);
    }
  }, [widgetId]);

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
      if (props.tracker.currentWidget?.id === widgetId && keys.has('zoom')) {
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
    const { latitude, longitude, extent, zoom } = model.getOptions();

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
      case 'VectorTileSource': {
        try {
          const tile = await getLayerTileInfo(source?.parameters?.url, {
            latitude,
            longitude,
            extent,
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
        const data = await loadFile({
          filepath: source.parameters?.path,
          type: 'GeoJSONSource',
          contentsManager: model.getContentsManager(),
          filePath: model.getFilePath()
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
    aggregatedProperties: Record<string, Set<string | number>>
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

    layer.filters = { logicalOp: op ?? logicalOp, appliedFilters: filters };
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
        </div>
      )}
    </>
  );
};

export default FilterComponent;
