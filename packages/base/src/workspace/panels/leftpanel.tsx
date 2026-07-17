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
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const [leftPanelOpen] = useUIState('leftPanelOpen', props.model);

  const [curTab, setCurTab] = React.useState<string>(() => {
    if (!props.settings.layersDisabled) {
      return 'layers';
    }
    if (!props.settings.stacBrowserDisabled) {
      return 'stac';
    }
    return '';
  });

  const { layerTree } = useLayerTree(props.model);

  const allLeftTabsDisabled =
    props.settings.layersDisabled && props.settings.stacBrowserDisabled;

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
      enabled: !props.settings.stacBrowserDisabled,
      contentClassName: 'jgis-panel-tab-content-stac-panel',
      content: <StacPanel model={props.model} />,
    },
  ];

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".jgis-tabs-list"
      cancel=".jgis-tabs-trigger"
      bounds=".jGIS-Mainview-Container"
    >
      <div
        ref={nodeRef}
        className="jgis-left-panel-container"
        style={{
          display:
            props.settings.leftPanelDisabled ||
            allLeftTabsDisabled ||
            leftPanelOpen === false
              ? 'none'
              : 'block',
        }}
      >
        <TabbedPanel
          tabs={tabs}
          curTab={curTab}
          onTabClick={name => setCurTab(prev => (prev === name ? '' : name))}
        />
      </div>
    </Draggable>
  );
};
