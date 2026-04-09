import {
  IJupyterGISModel,
  IJupyterGISSettings,
  SelectionType,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';
import Draggable from 'react-draggable';

import { ITabConfig, TabbedPanel } from './components/TabbedPanel';
import { LayersBodyComponent } from './components/layers';
import { useLayerTree } from './hooks/useLayerTree';
import { useUIState } from './hooks/useUIState';
import StacPanel from '../../features/stac-browser/components/StacPanel';

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

export const LeftPanel: React.FC<ILeftPanelProps> = props => {
  const [options, setOptions] = React.useState(props.model.getOptions());
  const storyMapPresentationMode = options.storyMapPresentationMode ?? false;
  const [leftPanelOpen, setLeftPanelOpen] = useUIState(
    'leftPanelOpen',
    props.model,
    props.settings.syncUIState ?? true,
  );

  const [curTab, setCurTab] = React.useState<string>(() => {
    if (!props.settings.layersDisabled) {
      return 'layers';
    }
    if (!props.settings.stacBrowserDisabled && !storyMapPresentationMode) {
      return 'stac';
    }
    if (!props.settings.storyMapsDisabled) {
      return 'segments';
    }
    return '';
  });

  React.useEffect(() => {
    const onOptionsChanged = () => setOptions({ ...props.model.getOptions() });
    props.model.sharedOptionsChanged.connect(onOptionsChanged);
    return () => {
      props.model.sharedOptionsChanged.disconnect(onOptionsChanged);
    };
  }, [props.model]);

  const { layerTree, segmentTree } = useLayerTree(props.model, props.commands, {
    onSegmentAdded: () => setCurTab('segments'),
  });

  const allLeftTabsDisabled =
    props.settings.layersDisabled &&
    props.settings.stacBrowserDisabled &&
    props.settings.storyMapsDisabled;

  const tabs: ITabConfig[] = [
    {
      name: 'layers',
      title: 'Layers',
      enabled: !props.settings.layersDisabled,
      contentClassName: 'jp-gis-layerPanel',
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={layerTree}
        />
      ),
    },
    {
      name: 'stac',
      title: 'Stac Browser',
      enabled: !props.settings.stacBrowserDisabled && !storyMapPresentationMode,
      contentClassName: 'jgis-panel-tab-content-stac-panel',
      content: <StacPanel model={props.model} />,
    },
    {
      name: 'segments',
      title: 'Segments',
      enabled: !props.settings.storyMapsDisabled,
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={segmentTree}
        />
      ),
    },
  ];

  const nodeRef = React.useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".jgis-tabs-list"
      cancel=".jgis-panel-tab-content"
      bounds=".jGIS-Mainview-Container"
    >
      <div
        ref={nodeRef}
        className="jgis-left-panel-container"
        style={{
          display:
            allLeftTabsDisabled ||
            props.settings.leftPanelDisabled ||
            !leftPanelOpen
              ? 'none'
              : 'block',
        }}
      >
        <TabbedPanel
          tabs={tabs}
          curTab={curTab}
          onTabClick={name => setCurTab(prev => (prev === name ? '' : name))}
          onMinimize={() => setLeftPanelOpen(false)}
        />
      </div>
    </Draggable>
  );
};
