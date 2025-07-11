import { IJupyterGISModel, SelectionType } from '@jupytergis/schema';
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
	onSelect: ({
		type,
		item,
		nodeId,
	}: ILeftPanelClickHandlerParams) => void;
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
			<Tabs
				defaultValue="filters"
				className="jgis-stac-browser-main"
			>
				<TabsList
					style={{
						borderRadius: 5,
						fontSize: 10,
					}}
				>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="layers"
					>
						Layers
					</TabsTrigger>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="stac"
					>
						Stac Browser
					</TabsTrigger>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="filters"
					>
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
					<StacBrowser
						controlPanelModel={
							options.model
						}
					></StacBrowser>
				</TabsContent>
				<TabsContent
					value="filters"
					style={{
						borderRadius: 5,
						backgroundColor: '#eef',
					}}
				>
					<FilterComponent
						model={options.model}
					></FilterComponent>
					,
				</TabsContent>
			</Tabs>
		</div>
	);
};
