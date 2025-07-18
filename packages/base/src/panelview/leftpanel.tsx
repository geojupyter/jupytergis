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
import StacBrowser from '../stacBrowser/StacBrowser';
import FilterComponent from './components/filter-panel/Filter';

/**
 * Options of the left panel widget.
 */
export interface ILeftPanelOptions {
  model: IJupyterGISModel;
  onSelect: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

export interface ILayerPanelOptions extends ILeftPanelOptions {
  state: IStateDB;
}

export interface ILeftPanelClickHandlerParams {
  type: SelectionType;
  item: string;
  nodeId?: string;
  event: ReactMouseEvent;
}

interface ILeftComponentProps {
  model: IJupyterGISModel;
  state: IStateDB;
  commands: CommandRegistry;
}

export const LeftPanelComponent = (options: ILeftComponentProps) => {
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
      <PanelTabs curTab={curTab} className="jgis-stac-panel-main">
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
        <TabsContent value="layers" className="jgis-panel-tab-content">
          <LayersBodyComponent
            model={options.model}
            commands={options.commands}
            state={options.state}
          ></LayersBodyComponent>
        </TabsContent>
        <TabsContent value="stac">
          <StacBrowser controlPanelModel={options.model}></StacBrowser>
        </TabsContent>
        <TabsContent value="filters" className="jgis-panel-tab-content">
          <FilterComponent model={options.model}></FilterComponent>,
        </TabsContent>
      </PanelTabs>
    </div>
  );
};
