import {
  IJupyterGISModel,
  IJGISLayerItem,
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
    props.model.getLayerTree(),
  );

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };
    const updateLayerTree = () => {
      setLayerTree(props.model.getLayerTree() || []);
    };

    props.model.settingsChanged.connect(onSettingsChanged);
    props.model.sharedModel.layersChanged.connect(updateLayerTree);
    props.model.sharedModel.layerTreeChanged.connect(updateLayerTree);

    updateLayerTree();
    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
      props.model.sharedModel.layersChanged.disconnect(updateLayerTree);
      props.model.sharedModel.layerTreeChanged.disconnect(updateLayerTree);
    };
  }, [props.model]);

  // Process layer tree once to create both filtered and landmark trees
  const { filteredLayerTree, landmarkLayerTree } = React.useMemo(() => {
    const filtered: IJGISLayerTree = [];
    const landmarks: IJGISLayerTree = [];

    const processLayer = (
      layer: IJGISLayerItem,
    ): { filtered: IJGISLayerItem | null; landmark: IJGISLayerItem | null } => {
      if (typeof layer === 'string') {
        const layerData = props.model.getLayer(layer);
        const isLandmark = layerData?.type === 'LandmarkLayer';
        return {
          filtered: isLandmark ? null : layer,
          landmark: isLandmark ? layer : null,
        };
      }

      // For layer groups, recursively process their layers
      const filteredGroupLayers: IJGISLayerItem[] = [];
      const landmarkGroupLayers: IJGISLayerItem[] = [];

      for (const groupLayer of layer.layers) {
        const result = processLayer(groupLayer);
        if (result.filtered !== null) {
          filteredGroupLayers.push(result.filtered);
        }
        if (result.landmark !== null) {
          landmarkGroupLayers.push(result.landmark);
        }
      }

      return {
        filtered:
          filteredGroupLayers.length > 0
            ? { ...layer, layers: filteredGroupLayers }
            : null,
        landmark:
          landmarkGroupLayers.length > 0
            ? { ...layer, layers: landmarkGroupLayers }
            : null,
      };
    };

    for (const layer of layerTree) {
      const result = processLayer(layer);
      if (result.filtered !== null) {
        filtered.push(result.filtered);
      }
      if (result.landmark !== null) {
        landmarks.push(result.landmark);
      }
    }

    return { filteredLayerTree: filtered, landmarkLayerTree: landmarks };
  }, [layerTree]);

  /**
   * ! TODO LOOK HERE
   * If we want to support multiple stories then we need a way to assign landmarks to them
   * Probably just wont do multiple stories then
   */
  React.useEffect(() => {
    const story = props.model.getSelectedStory();

    if (!story) {
      return;
    }
    props.model.sharedModel.updateStoryMap(
      'b48c2622-1188-4734-9450-68e3b7623354',
      { ...story, landmarks: landmarkLayerTree as string[] },
    );
  }, [landmarkLayerTree]);

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
