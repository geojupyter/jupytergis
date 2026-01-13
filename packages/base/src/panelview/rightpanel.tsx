import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISClientState,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';

import { AnnotationsPanel } from './annotationPanel';
import { IdentifyPanelComponent } from './identify-panel/IdentifyPanel';
import { PreviewModeSwitch } from './story-maps/PreviewModeSwitch';
import StoryEditorPanel from './story-maps/StoryEditorPanel';
import StoryViewerPanel from './story-maps/StoryViewerPanel';
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
  commands: CommandRegistry;
}

export const RightPanel: React.FC<IRightPanelProps> = props => {
  const [editorMode, setEditorMode] = React.useState(true);
  const [settings, setSettings] = React.useState(props.model.jgisSettings);
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(props.model.getOptions().storyMapPresentationMode ?? false);

  // Only show editor when not in presentation mode and editorMode is true
  const showEditor = !storyMapPresentationMode && editorMode;

  // Tab title: "Story Map" in presentation mode, otherwise based on editorMode
  const storyPanelTitle = storyMapPresentationMode
    ? 'Story Map'
    : editorMode
      ? 'Story Editor'
      : 'Story Map';

  const tabInfo = [
    !settings.objectPropertiesDisabled && !storyMapPresentationMode
      ? { name: 'objectProperties', title: 'Object Properties' }
      : false,
    !settings.storyMapsDisabled
      ? {
        name: 'storyPanel',
        title: storyPanelTitle,
      }
      : false,
    !settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !settings.identifyDisabled
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string>(() => {
    if (storyMapPresentationMode) {
      return 'storyPanel';
    }
    return tabInfo.length > 0 ? tabInfo[0].name : '';
  });

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };
    const onOptionsChanged = () => {
      const { storyMapPresentationMode } = props.model.getOptions();
      setStoryMapPresentationMode(storyMapPresentationMode ?? false);
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
    props.model.sharedOptionsChanged.connect(onOptionsChanged);
    props.model.clientStateChanged.connect(onAwerenessChanged);

    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
      props.model.sharedOptionsChanged.disconnect(onOptionsChanged);
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

  const toggleEditor = () => {
    setEditorMode(!editorMode);
  };

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
              key={`${tab.name}-${tab.title}`}
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

        {!settings.storyMapsDisabled && (
          <TabsContent
            value="storyPanel"
            className="jgis-panel-tab-content"
            style={{ paddingTop: 0 }}
          >
            {/* Only show switch when NOT in presentation mode */}
            {!storyMapPresentationMode && (
              <PreviewModeSwitch
                checked={!editorMode}
                onCheckedChange={toggleEditor}
              />
            )}
            {showEditor ? (
              <StoryEditorPanel model={props.model} commands={props.commands} />
            ) : (
              <StoryViewerPanel model={props.model} isSpecta={false} />
            )}
          </TabsContent>
        )}

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
