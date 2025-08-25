import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { PageConfig } from '@jupyterlab/coreutils';
import * as React from 'react';

import { AnnotationsPanel } from './annotationPanel';
import { IdentifyPanelComponent } from './components/identify-panel/IdentifyPanel';
import { ObjectPropertiesReact } from './objectproperties';
import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shared/components/Tabs';

interface IRightPanelProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
}

export const RightPanel: React.FC<IRightPanelProps> = props => {
  const hideAnnotationPanel =
    PageConfig.getOption('HIDE_ANNOTATION_PANEL') === 'true';

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  const tabInfo = [
    { name: 'objectProperties', title: 'Object Properties' },
    ...(hideAnnotationPanel
      ? []
      : [{ name: 'annotations', title: 'Annotations' }]),
    { name: 'identifyPanel', title: 'Identified Features' },
  ];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo[0].name,
  );

  return (
    <div className="jgis-right-panel-container">
      <PanelTabs className="jgis-panel-tabs" curTab={curTab}>
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
          value="objectProperties"
          className="jgis-panel-tab-content"
        >
          <ObjectPropertiesReact
            setSelectedObject={setSelectedObjectProperties}
            selectedObject={selectedObjectProperties}
            formSchemaRegistry={props.formSchemaRegistry}
            model={props.model}
          />
        </TabsContent>
        <TabsContent value="annotations">
          <AnnotationsPanel
            annotationModel={props.annotationModel}
            jgisModel={props.model}
          ></AnnotationsPanel>
        </TabsContent>
        <TabsContent value="identifyPanel" className="jgis-panel-tab-content">
          <IdentifyPanelComponent model={props.model}></IdentifyPanelComponent>
        </TabsContent>
      </PanelTabs>
    </div>
  );
};
