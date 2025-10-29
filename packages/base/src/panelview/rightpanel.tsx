import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISClientState,
  IJupyterGISModel,
} from '@jupytergis/schema';
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
import StoryEditorPanel from './components/story-maps/StoryEditorPanel';

interface IRightPanelProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
}

export const RightPanel: React.FC<IRightPanelProps> = props => {
  const [settings, setSettings] = React.useState(props.model.jgisSettings);
  const tabInfo = [
    !settings.objectPropertiesDisabled
      ? { name: 'objectProperties', title: 'Object Properties' }
      : false,
    { name: 'storyPanel', title: 'Stories' },
    !settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !settings.identifyDisabled
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo.length > 0 ? tabInfo[0].name : undefined,
  );

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };
    let currentlyIdentifiedFeatures: any = undefined;
    const onAwerenessChanged = (
      _: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>,
    ) => {
      const clientId = props.model.getClientId();
      const localState = clientId ? clients.get(clientId) : null;

      if (
        localState &&
        localState.identifiedFeatures?.value &&
        localState.identifiedFeatures.value !== currentlyIdentifiedFeatures
      ) {
        currentlyIdentifiedFeatures = localState.identifiedFeatures.value;
        setCurTab('identifyPanel');
      }
    };

    props.model.settingsChanged.connect(onSettingsChanged);
    props.model.clientStateChanged.connect(onAwerenessChanged);

    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
      props.model.clientStateChanged.disconnect(onAwerenessChanged);
    };
  }, [props.model]);

  const allRightTabsDisabled =
    settings.objectPropertiesDisabled &&
    settings.annotationsDisabled &&
    settings.identifyDisabled;

  const rightPanelVisible =
    !settings.rightPanelDisabled && !allRightTabsDisabled;

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  return (
    <div
      className="jgis-right-panel-container"
      style={{ display: rightPanelVisible ? 'block' : 'none' }}
    >
      <PanelTabs className="jgis-panel-tabs" curTab={curTab}>
        <TabsList>
          {tabInfo.map(tab => (
            <TabsTrigger
              className="jGIS-layer-browser-category"
              key={tab.name}
              value={tab.name}
              onClick={() => {
                if (curTab !== tab.name) {
                  setCurTab(tab.name);
                } else {
                  setCurTab('');
                }
              }}
            >
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {!settings.objectPropertiesDisabled && (
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
        {!settings.objectPropertiesDisabled && (
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
        {!settings.objectPropertiesDisabled && (
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

        <TabsContent value="storyPanel" className="jgis-panel-tab-content">
          {/* switch to this panel when clicking create story */}
          <StoryPanel
            model={props.model}
            formSchemaRegistry={props.formSchemaRegistry}
          ></StoryPanel>
        </TabsContent>
        <TabsContent value="storyPanel" className="jgis-panel-tab-content">
          {/* switch to this panel when clicking create story */}
          <StoryPanel
            model={props.model}
            formSchemaRegistry={props.formSchemaRegistry}
          ></StoryPanel>
        </TabsContent>
        <TabsContent value="storyPanel" className="jgis-panel-tab-content">
          {/* switch to this panel when clicking create story */}
          <StoryEditorPanel model={props.model}></StoryEditorPanel>
        </TabsContent>

        {!settings.annotationsDisabled && (
          <TabsContent value="annotations" className="jgis-panel-tab-content">
            <AnnotationsPanel
              annotationModel={props.annotationModel}
              jgisModel={props.model}
            ></AnnotationsPanel>
          </TabsContent>
        )}

        {!settings.identifyDisabled && (
          <TabsContent value="identifyPanel" className="jgis-panel-tab-content">
            <IdentifyPanelComponent
              model={props.model}
            ></IdentifyPanelComponent>
          </TabsContent>
        )}
      </PanelTabs>
    </div>
  );
};
