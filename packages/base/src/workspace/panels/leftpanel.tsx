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

import { ITabSpec, PanelContainer } from './components/PanelContainer';
import { LayersBodyComponent } from './components/layers';
import { useLayerTree } from './hooks/useLayerTree';
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
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const handler = () => setVisible(v => !v);
    window.addEventListener('jgis:togglePanel', handler);
    return () => window.removeEventListener('jgis:togglePanel', handler);
  }, []);

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

  const { filteredLayerTree, storySegmentLayerTree } = useLayerTree(
    props.model,
    props.commands,
    { onSegmentAdded: () => setCurTab('segments') },
  );

  const allLeftTabsDisabled =
    props.settings.layersDisabled &&
    props.settings.stacBrowserDisabled &&
    props.settings.storyMapsDisabled;

  const tabs: ITabSpec[] = [
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
          layerTree={filteredLayerTree}
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
          layerTree={storySegmentLayerTree}
        />
      ),
    },
  ];

  return (
    <Draggable
      handle=".jgis-tabs-list"
      cancel=".jgis-tabs-trigger"
      bounds=".jGIS-Mainview-Container"
    >
      <PanelContainer
        tabs={tabs}
        containerClassName="jgis-left-panel-container"
        curTab={curTab}
        onTabClick={name => setCurTab(prev => (prev === name ? '' : name))}
        style={{ display: allLeftTabsDisabled || !visible ? 'none' : 'block' }}
      />
    </Draggable>
  );
};
