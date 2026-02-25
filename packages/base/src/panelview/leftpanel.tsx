import {
  IJupyterGISModel,
  IJGISLayerItem,
  IJGISLayerTree,
  SelectionType,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';
import Draggable from 'react-draggable';

import { CommandIDs } from '../constants';
import { LayersBodyComponent } from './components/layers';
import FilterComponent from './filter-panel/Filter';
import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shared/components/Tabs';
import StacPanel from '../stacBrowser/components/StacPanel';

export interface ILeftPanelClickHandlerParams {
  type: SelectionType;
  item: string;
  event: ReactMouseEvent;
}

interface ILeftPanelProps {
  model: IJupyterGISModel;
  state: IStateDB;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
}

export const LeftPanel: React.FC<ILeftPanelProps> = (
  props: ILeftPanelProps,
) => {
  const [options, setOptions] = React.useState(props.model.getOptions());
  const storyMapPresentationMode = options.storyMapPresentationMode ?? false;
  const [layerTree, setLayerTree] = React.useState<IJGISLayerTree>(
    props.model.getLayerTree(),
  );

  const hasSyncedInitialSelectionRef = React.useRef(false);

  const tabInfo = [
    !props.settings.layersDisabled
      ? { name: 'layers', title: 'Layers' }
      : false,
    !props.settings.stacBrowserDisabled && !storyMapPresentationMode
      ? { name: 'stac', title: 'Stac Browser' }
      : false,
    !props.settings.filtersDisabled && !storyMapPresentationMode
      ? { name: 'filters', title: 'Filters' }
      : false,
    !props.settings.storyMapsDisabled
      ? { name: 'segments', title: 'Segments' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo.length > 0 ? tabInfo[0].name : undefined,
  );

  React.useEffect(() => {
    const onOptionsChanged = () => {
      setOptions({ ...props.model.getOptions() });
    };
    const updateLayerTree = () => {
      const freshTree = props.model.getLayerTree() || [];
      setLayerTree(freshTree);

      // Sync selected to top layer/group only the first time the tree has items
      if (!hasSyncedInitialSelectionRef.current && freshTree.length > 0) {
        hasSyncedInitialSelectionRef.current = true;
        const lastItem = freshTree[freshTree.length - 1];
        const lastId = typeof lastItem === 'string' ? lastItem : lastItem?.name;
        const lastType = typeof lastItem === 'string' ? 'layer' : 'group';
        if (lastId) {
          props.model.syncSelected(
            { [lastId]: { type: lastType } },
            props.model.getClientId().toString(),
          );
        }
      }

      // Need to let command know when segments get populated
      props.commands.notifyCommandChanged(
        CommandIDs.toggleStoryPresentationMode,
      );
    };

    const onSegmentAdded = (
      _sender: IJupyterGISModel,
      payload: { storySegmentId: string; storyId: string },
    ) => {
      props.model.syncSelected(
        { [payload.storySegmentId]: { type: 'layer' } },
        props.model.getClientId().toString(),
      );

      setCurTab('segments');
    };

    props.model.sharedOptionsChanged.connect(onOptionsChanged);
    props.model.sharedModel.layersChanged.connect(updateLayerTree);
    props.model.sharedModel.layerTreeChanged.connect(updateLayerTree);
    props.model.segmentAdded.connect(onSegmentAdded);

    updateLayerTree();

    return () => {
      props.model.sharedOptionsChanged.disconnect(onOptionsChanged);
      props.model.sharedModel.layersChanged.disconnect(updateLayerTree);
      props.model.sharedModel.layerTreeChanged.disconnect(updateLayerTree);
      props.model.segmentAdded.disconnect(onSegmentAdded);
    };
  }, [props.model]);

  // Since story segments are technically layers they are stored in the layer tree, so we separate them
  // from regular layers. Process the tree once to build both filtered and story segment trees.
  const { filteredLayerTree, storySegmentLayerTree } = React.useMemo(() => {
    const filtered: IJGISLayerTree = [];
    const storySegments: IJGISLayerTree = [];

    const processLayer = (
      layer: IJGISLayerItem,
    ): {
      filtered: IJGISLayerItem | null;
      storySegment: IJGISLayerItem | null;
    } => {
      if (typeof layer === 'string') {
        const layerData = props.model.getLayer(layer);
        const isStorySegment = layerData?.type === 'StorySegmentLayer';
        return {
          filtered: isStorySegment ? null : layer,
          storySegment: isStorySegment ? layer : null,
        };
      }

      // For layer groups, recursively process their layers
      const filteredGroupLayers: IJGISLayerItem[] = [];
      const storySegmentGroupLayers: IJGISLayerItem[] = [];

      for (const groupLayer of layer.layers) {
        const result = processLayer(groupLayer);
        if (result.filtered !== null) {
          filteredGroupLayers.push(result.filtered);
        }
        if (result.storySegment !== null) {
          storySegmentGroupLayers.push(result.storySegment);
        }
      }

      return {
        filtered:
          filteredGroupLayers.length > 0
            ? { ...layer, layers: filteredGroupLayers }
            : null,
        storySegment:
          storySegmentGroupLayers.length > 0
            ? { ...layer, layers: storySegmentGroupLayers }
            : null,
      };
    };

    for (const layer of layerTree) {
      const result = processLayer(layer);
      if (result.filtered !== null) {
        filtered.push(result.filtered);
      }
      if (result.storySegment !== null) {
        storySegments.push(result.storySegment);
      }
    }

    // Reverse filteredLayerTree before returning
    filtered.reverse();

    return {
      filteredLayerTree: filtered,
      storySegmentLayerTree: storySegments,
    };
  }, [layerTree]);

  // Updates story segments array based on layer tree array
  React.useEffect(() => {
    const { storyId, story } = props.model.getSelectedStory();

    if (!story) {
      return;
    }
    props.model.sharedModel.updateStoryMap(storyId, {
      ...story,
      storySegments: storySegmentLayerTree as string[],
    });
  }, [storySegmentLayerTree]);

  const allLeftTabsDisabled =
    props.settings.layersDisabled &&
    props.settings.stacBrowserDisabled &&
    props.settings.filtersDisabled &&
    props.settings.storyMapsDisabled;

  const leftPanelVisible =
    !props.settings.leftPanelDisabled && !allLeftTabsDisabled;

  return (
    <Draggable
      handle=".jgis-tabs-list"
      cancel=".jgis-tabs-trigger"
      bounds=".jGIS-Mainview-Container"
    >
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

          {!props.settings.layersDisabled && (
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

          {!props.settings.stacBrowserDisabled && (
            <TabsContent
              value="stac"
              className="jgis-panel-tab-content jgis-panel-tab-content-stac-panel"
            >
              <StacPanel model={props.model} />
            </TabsContent>
          )}

          {!props.settings.filtersDisabled && (
            <TabsContent value="filters" className="jgis-panel-tab-content">
              <FilterComponent model={props.model}></FilterComponent>
            </TabsContent>
          )}

          {!props.settings.storyMapsDisabled && (
            <TabsContent value="segments" className="jgis-panel-tab-content">
              <LayersBodyComponent
                model={props.model}
                commands={props.commands}
                state={props.state}
                layerTree={storySegmentLayerTree}
              ></LayersBodyComponent>
            </TabsContent>
          )}
        </PanelTabs>
      </div>
    </Draggable>
  );
};
