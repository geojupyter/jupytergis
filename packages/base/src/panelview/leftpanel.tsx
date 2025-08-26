import { IJupyterGISModel, SelectionType } from '@jupytergis/schema';
import { PageConfig } from '@jupyterlab/coreutils';
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
  nodeId?: string;
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
  const hideStacPanel = PageConfig.getOption('HIDE_STAC_PANEL') === 'true';

  const [settings, setSettings] = React.useState(props.model.jgisSettings);

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };

    props.model.settingsChanged.connect(onSettingsChanged);
    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
    };
  }, [props.model]);

  const leftPanelVisible = !settings.leftPanelDisabled;

  const tabInfo = [
    !settings.layersDisabled ? { name: 'layers', title: 'Layers' } : false,
    !settings.stacBrowserDisabled && !hideStacPanel
      ? { name: 'stac', title: 'Stac Browser' }
      : false,
    !settings.filtersDisabled ? { name: 'filters', title: 'Filters' } : false,
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
          {tabInfo.map(e => (
            <TabsTrigger
              className="jGIS-layer-browser-category"
              value={e.name}
              onClick={() => {
                if (curTab !== e.name) {
                  setCurTab(e.name);
                } else {
                  setCurTab('');
                }
              }}
            >
              {e.title}
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
          ></LayersBodyComponent>
          </TabsContent>
        )}

        {!settings.stacBrowserDisabled && !hideStacPanel && (
          <TabsContent value="stac" className="jgis-panel-tab-content">
            <StacPanel model={props.model} />
          </TabsContent>
        )}

        {!settings.filtersDisabled && (
          <TabsContent value="filters" className="jgis-panel-tab-content">
            <FilterComponent model={props.model}></FilterComponent>
          </TabsContent>
        )}
      </PanelTabs>
    </div>
  );
};
