import {
  IJupyterGISModel,
  JupyterGISDoc,
  SelectionType,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { MouseEvent as ReactMouseEvent } from 'react';
import * as React from 'react';

import { LayersBodyComponent } from './components/layers';
import {
  Tabs,
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
  return (
    <div
      style={{
        width: 250,
        position: 'absolute',
        top: 30,
        left: 0,
      }}
    >
      <Tabs defaultValue="filters" className="jgis-stac-browser-main">
        <TabsList
          style={{
            borderRadius: 5,
            fontSize: 10,
          }}
        >
          <TabsTrigger className="jGIS-layer-browser-category" value="layers">
            Layers
          </TabsTrigger>
          <TabsTrigger className="jGIS-layer-browser-category" value="stac">
            Stac Browser
          </TabsTrigger>
          <TabsTrigger className="jGIS-layer-browser-category" value="filters">
            Filters
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="layers"
          style={{
            borderRadius: 5,
            fontSize: 10,
            backgroundColor: '#eef',
          }}
        >
          <LayersBodyComponent
            model={options.model}
            commands={options.commands}
            state={options.state}
          ></LayersBodyComponent>
        </TabsContent>
        <TabsContent value="stac">
          <StacBrowser controlPanelModel={options.model}></StacBrowser>
        </TabsContent>
        <TabsContent
          value="filters"
          style={{
            borderRadius: 5,
            backgroundColor: '#eef',
          }}
        >
          <FilterComponent model={options.model}></FilterComponent>,
        </TabsContent>
      </Tabs>
    </div>
  );
};

// export class LeftPanelWidget extends SidePanel {
//   constructor(options: LeftPanelWidget.IOptions) {
//     super();
//     this.addClass('jGIS-sidepanel-widget');
//     this.addClass('data-jgis-keybinding');
//     this.node.tabIndex = 0;

//     this._model = options.model;
//     this._state = options.state;
//     this._commands = options.commands;

//     const header = new ControlPanelHeader();
//     this.header.addWidget(header);

//     const stacPanel = new StacPanel({
//       model: this._model,
//     });

//     stacPanel.title.caption = 'STAC';
//     stacPanel.title.label = 'STAC';
//     this.addWidget(stacPanel);

//     const filterPanel = new FilterPanel({
//       model: this._model,
//     });

//     filterPanel.title.caption = 'Filters';
//     filterPanel.title.label = 'Filters';
//     this.addWidget(filterPanel);
//   }

//   dispose(): void {
//     super.dispose();
//   }

//   protected onAfterAttach(msg: Message): void {
//     super.onAfterAttach(msg);
//     const node = this.node;
//     node.addEventListener('mouseup', this);
//   }

//   protected onBeforeDetach(msg: Message): void {
//     super.onBeforeDetach(msg);
//     const node = this.node;
//     node.removeEventListener('mouseup', this);
//   }

//   handleEvent(event: Event): void {
//     switch (event.type) {
//       case 'mouseup':
//         this._mouseUpEvent(event as MouseEvent);
//         break;
//       default:
//         break;
//     }
//   }

//   private _mouseUpEvent(event: MouseEvent): void {
//     // If we click on empty space in the layer panel, keep the focus on the last selected element
//     const node = document.getElementById(this._lastSelectedNodeId);
//     if (!node) {
//       return;
//     }

//     node.focus();
//   }

//   private _lastSelectedNodeId: string;
//   private _model: IJupyterGISModel;
// }

export namespace LeftPanelWidget {
  export interface IOptions {
    model: IJupyterGISModel;
    state: IStateDB;
    commands: CommandRegistry;
  }

  export interface IProps {
    filePath?: string;
    sharedModel?: JupyterGISDoc;
  }
}
