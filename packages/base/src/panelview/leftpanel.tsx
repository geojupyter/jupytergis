import { IJupyterGISModel, SelectionType } from '@jupytergis/schema';
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
  const tabInfo = [
    { name: 'layers', title: 'Layers' },
    { name: 'stac', title: 'Stac Browser' },
    { name: 'filters', title: 'Filters' },
  ];
  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo[0].name,
  );

  return (
    <div className="jgis-left-panel-container">
      <PanelTabs curTab={curTab} className="jgis-panel-tabs">
        <TabsList>
          {tabInfo.map(e => {
            return (
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
            );
          })}
        </TabsList>
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
        <TabsContent value="stac">
          <StacPanel model={props.model}></StacPanel>
        </TabsContent>
        <TabsContent value="filters" className="jgis-panel-tab-content">
          <FilterComponent model={props.model}></FilterComponent>,
        </TabsContent>
      </PanelTabs>
    </div>
  );
};
