import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJupyterGISClientState,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';
import Draggable from 'react-draggable';

import { AnnotationsPanel } from '../../features/annotations';
import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';
import { ObjectPropertiesReact } from '../../features/objectproperties';
import StoryEditorPanel from '../../features/story/StoryEditorPanel';
import StoryViewerPanel from '../../features/story/StoryViewerPanel';
import { PreviewModeSwitch } from '../../features/story/components/PreviewModeSwitch';
import {
  useStoryMap,
  type IOverrideLayerEntry,
} from '../../features/story/hooks/useStoryMap';
import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../shared/components/Tabs';

/** Story viewer + useStoryMap hook
 * only mounted when story tab is active to avoid the hook causing re-renders when tab is hidden.
 **/
function RightPanelStoryViewer({
  model,
  addLayer,
  removeLayer,
}: {
  model: IJupyterGISModel;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}) {
  const overrideLayerEntriesRef = React.useRef<IOverrideLayerEntry[]>([]);
  const {
    storyData,
    currentIndex,
    setIndex,
    handlePrev,
    handleNext,
    hasPrev,
    hasNext,
    activeSlide,
    layerName,
  } = useStoryMap({
    model,
    overrideLayerEntriesRef,
    removeLayer,
    addLayer,
    isSpecta: false,
  });

  return (
    <StoryViewerPanel
      model={model}
      isSpecta={false}
      storyData={storyData}
      currentIndex={currentIndex}
      activeSlide={activeSlide}
      layerName={layerName}
      handlePrev={handlePrev}
      handleNext={handleNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      setIndex={setIndex}
    />
  );
}

interface IRightPanelProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}

export const RightPanel: React.FC<IRightPanelProps> = props => {
  const [editorMode, setEditorMode] = React.useState(true);
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(props.model.getOptions().storyMapPresentationMode ?? false);
  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  // Only show editor when not in presentation mode and editorMode is true
  const showEditor = !storyMapPresentationMode && editorMode;

  // Tab title: "Story Map" in presentation mode, otherwise based on editorMode
  const storyPanelTitle = storyMapPresentationMode
    ? 'Story Map'
    : editorMode
      ? 'Story Editor'
      : 'Story Map';

  const tabInfo = [
    !props.settings.objectPropertiesDisabled && !storyMapPresentationMode
      ? { name: 'objectProperties', title: 'Object Properties' }
      : false,
    !props.settings.storyMapsDisabled
      ? {
          name: 'storyPanel',
          title: storyPanelTitle,
        }
      : false,
    !props.settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !props.settings.identifyDisabled
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
    const onOptionsChanged = () => {
      const { storyMapPresentationMode } = props.model.getOptions();
      setStoryMapPresentationMode(storyMapPresentationMode ?? false);
      storyMapPresentationMode && setCurTab('storyPanel');
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

    props.model.sharedOptionsChanged.connect(onOptionsChanged);
    props.model.clientStateChanged.connect(onAwerenessChanged);

    return () => {
      props.model.sharedOptionsChanged.disconnect(onOptionsChanged);
      props.model.clientStateChanged.disconnect(onAwerenessChanged);
    };
  }, [props.model]);

  const allRightTabsDisabled =
    props.settings.objectPropertiesDisabled &&
    props.settings.annotationsDisabled &&
    props.settings.identifyDisabled;

  const rightPanelVisible =
    !props.settings.rightPanelDisabled && !allRightTabsDisabled;

  const toggleEditor = () => {
    setEditorMode(!editorMode);
  };

  return (
    <Draggable
      handle=".jgis-tabs-list"
      cancel=".jgis-tabs-trigger"
      bounds=".jGIS-Mainview-Container"
    >
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

          {!props.settings.objectPropertiesDisabled && (
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

          {!props.settings.storyMapsDisabled && (
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
                <StoryEditorPanel
                  model={props.model}
                  commands={props.commands}
                />
              ) : curTab === 'storyPanel' ? (
                <RightPanelStoryViewer
                  model={props.model}
                  addLayer={props.addLayer}
                  removeLayer={props.removeLayer}
                />
              ) : null}
            </TabsContent>
          )}

          {!props.settings.annotationsDisabled && (
            <TabsContent value="annotations" className="jgis-panel-tab-content">
              <AnnotationsPanel
                annotationModel={props.annotationModel}
                jgisModel={props.model}
              ></AnnotationsPanel>
            </TabsContent>
          )}

          {!props.settings.identifyDisabled && (
            <TabsContent
              value="identifyPanel"
              className="jgis-panel-tab-content"
            >
              <IdentifyPanelComponent
                model={props.model}
              ></IdentifyPanelComponent>
            </TabsContent>
          )}
        </PanelTabs>
      </div>
    </Draggable>
  );
};
