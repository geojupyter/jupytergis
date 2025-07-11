import {
	IAnnotationModel,
	IJGISFormSchemaRegistry,
	IJupyterGISModel,
} from '@jupytergis/schema';
import * as React from 'react';

import { AnnotationsPanel } from './annotationPanel';
import { IdentifyPanelComponent } from './components/identify-panel/IdentifyPanel';
import { ObjectPropertiesReact } from './objectproperties';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '../shared/components/Tabs';

interface IRightComponentProps {
	formSchemaRegistry: IJGISFormSchemaRegistry;
	annotationModel: IAnnotationModel;
	model: IJupyterGISModel;
}

export const RightPanelComponent = (options: IRightComponentProps) => {
	const [selectedObjectProperties, setSelectedObjectProperties] =
		React.useState(undefined);
	return (
		<div
			style={{
				width: 300,
				position: 'absolute',
				top: 30,
				right: 0,
			}}
		>
			<Tabs
				defaultValue="filters"
				className="jgis-stac-browser-main"
			>
				<TabsList
					style={{ borderRadius: 5, fontSize: 8 }}
				>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="objectProperties"
					>
						Object Properties
					</TabsTrigger>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="annotations"
					>
						Annotations
					</TabsTrigger>
					<TabsTrigger
						className="jGIS-layer-browser-category"
						value="identifyPanel"
					>
						Identify Panels
					</TabsTrigger>
				</TabsList>
				<TabsContent
					value="objectProperties"
					style={{
						borderRadius: 5,
						fontSize: 10,
						backgroundColor: '#eef',
					}}
				>
					<ObjectPropertiesReact
						setSelectedObject={
							setSelectedObjectProperties
						}
						selectedObject={
							selectedObjectProperties
						}
						formSchemaRegistry={
							options.formSchemaRegistry
						}
						model={options.model}
					/>
				</TabsContent>
				<TabsContent value="annotations">
					<AnnotationsPanel
						annotationModel={
							options.annotationModel
						}
						rightPanelModel={options.model}
					></AnnotationsPanel>
				</TabsContent>
				<TabsContent
					value="identifyPanel"
					style={{
						borderRadius: 5,
						backgroundColor: '#eef',
					}}
				>
					<IdentifyPanelComponent
						model={options.model}
					></IdentifyPanelComponent>
				</TabsContent>
			</Tabs>
		</div>
	);
};
