import {
  IJupyterGISModel,
  IJGISLayerTree,
  SelectionType,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';

import { LayersBodyComponent } from './components/layers';
import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shared/components/Tabs';
import StacPanel from '../stacBrowser/components/StacPanel';
import FilterComponent from './components/filter-panel/Filter';

export interface ILeftPanelClickHandlerParams {
  type: SelectionType;
  item: string;
  event: ReactMouseEvent;
}

interface ILeftPanelProps {
  model: IJupyterGISModel;
  state: IStateDB;
  commands: CommandRegistry;
}

export const LeftPanel: React.FC<ILeftPanelProps> = (
  props: ILeftPanelProps,
) => {
  const [settings, setSettings] = React.useState(props.model.jgisSettings);
  const [layerTree, setLayerTree] = React.useState<IJGISLayerTree>(
    props.model?.getLayerTree() || [],
  );

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };

    props.model.settingsChanged.connect(onSettingsChanged);
    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
    };
  }, [props.model]);

  React.useEffect(() => {
    const updateLayers = () => {
      setLayerTree(props.model?.getLayerTree() || []);
    };
    props.model?.sharedModel.layersChanged.connect(updateLayers);
    props.model?.sharedModel.layerTreeChanged.connect(updateLayers);

    updateLayers();
    return () => {
      props.model?.sharedModel.layersChanged.disconnect(updateLayers);
      props.model?.sharedModel.layerTreeChanged.disconnect(updateLayers);
    };
  }, [props.model]);

  // Filter out LandmarkLayer types from the layer tree
  const filteredLayerTree = React.useMemo(() => {
    return layerTree.filter(layer => {
      // Filter out LandmarkLayer types
      if (typeof layer === 'string') {
        const layerData = props.model?.getLayer(layer);
        return layerData?.type !== 'LandmarkLayer';
      }
      // For layer groups, recursively filter their layers
      if (typeof layer === 'object' && layer.layers) {
        const filteredGroup = {
          ...layer,
          layers: layer.layers.filter(groupLayer => {
            if (typeof groupLayer === 'string') {
              const layerData = props.model?.getLayer(groupLayer);
              return layerData?.type !== 'LandmarkLayer';
            }
            return true; // Keep layer groups as they are
          }),
        };
        return filteredGroup.layers.length > 0; // Only show groups that have remaining layers
      }
      return true;
    });
  }, [layerTree, props.model]);

  // Create a layer tree containing only LandmarkLayer types
  const landmarkLayerTree = React.useMemo(() => {
    return layerTree.filter(layer => {
      // Include only LandmarkLayer types
      if (typeof layer === 'string') {
        const layerData = props.model?.getLayer(layer);
        return layerData?.type === 'LandmarkLayer';
      }
      // For layer groups, recursively filter their layers
      if (typeof layer === 'object' && layer.layers) {
        const filteredGroup = {
          ...layer,
          layers: layer.layers.filter(groupLayer => {
            if (typeof groupLayer === 'string') {
              const layerData = props.model?.getLayer(groupLayer);
              return layerData?.type === 'LandmarkLayer';
            }
            return true; // Keep layer groups as they are
          }),
        };
        return filteredGroup.layers.length > 0; // Only show groups that have remaining layers
      }
      return false; // Exclude everything else
    });
  }, [layerTree, props.model]);

  const allLeftTabsDisabled =
    settings.layersDisabled &&
    settings.stacBrowserDisabled &&
    settings.filtersDisabled;

  const leftPanelVisible = !settings.leftPanelDisabled && !allLeftTabsDisabled;

  const tabInfo = [
    !settings.layersDisabled ? { name: 'layers', title: 'Layers' } : false,
    !settings.stacBrowserDisabled
      ? { name: 'stac', title: 'Stac Browser' }
      : false,
    !settings.filtersDisabled ? { name: 'filters', title: 'Filters' } : false,
    { name: 'landmarks', title: 'Landmarks' },
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo.length > 0 ? tabInfo[0].name : undefined,
  );

  return (
    <div
      className="jgis-left-panel-container"
      style={{ display: leftPanelVisible ? 'block' : 'none' }}
    >
      <PanelTabs curTab={curTab} className="jgis-panel-tabs">
        <TabsList>
          {tabInfo.map(tab => (
            <TabsTrigger
              className="jGIS-layer-browser-category"
              key={tab.name}
              value={tab.name}
              onClick={() => {
                if (curTab !== tab.name) {
                  setCurTab(tab.name);
                } else {
                  setCurTab('');
                }
              }}
            >
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {!settings.layersDisabled && (
          <TabsContent
            value="layers"
            className="jgis-panel-tab-content jp-gis-layerPanel"
          >
            <LayersBodyComponent
              model={props.model}
              commands={props.commands}
              state={props.state}
              layerTree={filteredLayerTree}
            ></LayersBodyComponent>
          </TabsContent>
        )}

        {!settings.stacBrowserDisabled && (
          <TabsContent value="stac" className="jgis-panel-tab-content">
            <StacPanel model={props.model} />
          </TabsContent>
        )}

        {!settings.filtersDisabled && (
          <TabsContent value="filters" className="jgis-panel-tab-content">
            <FilterComponent model={props.model}></FilterComponent>
          </TabsContent>
        )}

        <TabsContent value="landmarks" className="jgis-panel-tab-content">
          <LayersBodyComponent
            model={props.model}
            commands={props.commands}
            state={props.state}
            layerTree={landmarkLayerTree}
          ></LayersBodyComponent>
        </TabsContent>
      </PanelTabs>
    </div>
  );
};
