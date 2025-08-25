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

  const settings = props.model.jgisSettings;
  const rightPanelVisible = settings?.jgisRightPanelVisible ?? true;

  if (!rightPanelVisible) {
    return null;
  }

  const tabInfo = [
    settings?.jgisRightTabObjectProperties
      ? { name: 'objectProperties', title: 'Object Properties' }
      : null,
    settings?.jgisRightTabAnnotations && !hideAnnotationPanel
      ? { name: 'annotations', title: 'Annotations' }
      : null,
    settings?.jgisRightTabIdentifyPanel
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : null,
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo.length > 0 ? tabInfo[0].name : undefined,
  );

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  return (
    <div className="jgis-right-panel-container">
      <PanelTabs className="jgis-panel-tabs" curTab={curTab}>
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

        {settings?.jgisRightTabObjectProperties && (
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
        )}

        {settings?.jgisRightTabAnnotations && !hideAnnotationPanel && (
          <TabsContent value="annotations" className="jgis-panel-tab-content">
            <AnnotationsPanel
              annotationModel={props.annotationModel}
              jgisModel={props.model}
          ></AnnotationsPanel>
          </TabsContent>
        )}

        {settings?.jgisRightTabIdentifyPanel && (
          <TabsContent value="identifyPanel" className="jgis-panel-tab-content">
          <IdentifyPanelComponent model={props.model}></IdentifyPanelComponent>
          </TabsContent>
        )}
      </PanelTabs>
    </div>
  );
};
