import {
  IAnnotationModel,
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';

import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';

import { FormGenerator } from '../../processingLibrary/form';
import Draggable from 'react-draggable';

import { useStorySegmentSync } from '@/src/features/story/hooks/useStorySegmentSync';
import { STORY_TYPE } from '@/src/types';
import { geoProcessingOperationRegistry } from '../../processingLibrary/registry';
import { useRightPanelOptions } from './hooks/useRightPanelOptions';
import { useUIState } from './hooks/useUIState';

const _processingCtx = require.context('../../processingLibrary/operations', false, /\.js$/);
_processingCtx.keys().forEach((key: string) => _processingCtx(key));
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
  TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../shared/components/Tabs';

/** Story viewer + useStoryMap hook
 * only mounted when story tab is active to avoid the hook causing re-renders when tab is hidden.
 **/
export function RightPanelStoryViewer({
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

  useStorySegmentSync({ model, storyData, setIndex });

  return (
    <StoryViewerPanel
      isSpecta={false}
      storyData={storyData}
      currentIndex={currentIndex}
      activeSlide={activeSlide}
      layerName={layerName}
      segmentNav={{ handlePrev, handleNext, hasPrev, hasNext }}
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
  notebookTracker?: { currentWidget: { content: any } | null };
  patchGeoJSONFeatureProperties?: (
    sourceId: string,
    target: { featureId: string },
    propertyUpdates: IDict<any>,
  ) => Promise<boolean>;
}

const RightPanelComponent: React.FC<IRightPanelProps> = props => {
  const { patchGeoJSONFeatureProperties } = props;
  const isListStory =
    props.model.getSelectedStory().story?.storyType ===
    STORY_TYPE.verticalScroll;

  const [curTab, setCurTab] = React.useState<string>(() => {
    const initialPresentationMode =
      props.model.getOptions().storyMapPresentationMode ?? false;
    if (initialPresentationMode) {
      return 'storyPanel';
    }
    if (!props.settings.objectPropertiesDisabled) {
      return 'objectProperties';
    }
    if (!props.settings.storyMapsDisabled) {
      return 'storyPanel';
    }
    if (!props.settings.annotationsDisabled) {
      return 'annotations';
    }
    if (!props.settings.identifyDisabled) {
      return 'identifyPanel';
    }
    return '';
  });

  const {
    storyMapPresentationMode,
    editorMode,
    showEditor,
    storyPanelTitle,
    toggleEditor,
  } = useRightPanelOptions(props.model, {
    onPresentationModeEnabled: () => setCurTab('storyPanel'),
    onIdentifyFeatures: () => setCurTab('identifyPanel'),
  });

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  const [processingSelectedOp, setProcessingSelectedOp] =
    React.useState<any>(null);

  const tabInfo = [
    !props.settings.objectPropertiesDisabled && !storyMapPresentationMode
      ? { name: 'objectProperties', title: 'Object Properties' }
      : false,
    { name: 'processing', title: 'Processing' },
    !props.settings.storyMapsDisabled
      ? { name: 'storyPanel', title: storyPanelTitle }
      : false,
    !props.settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !props.settings.identifyDisabled
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const allRightTabsDisabled =
    props.settings.objectPropertiesDisabled &&
    props.settings.annotationsDisabled &&
    props.settings.identifyDisabled;

  const [rightPanelOpen] = useUIState('rightPanelOpen', props.model);

  const rightPanelVisible =
    !props.settings.rightPanelDisabled &&
    !allRightTabsDisabled &&
    rightPanelOpen !== false;

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
        <TabsRoot className="jgis-panel-tabs" curTab={curTab}>
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

          <TabsContent value="processing" className="jgis-panel-tab-content">
            {processingSelectedOp === null ? (
              <ul id="processing-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Array.from(geoProcessingOperationRegistry.operations.entries()).map(([id, item]) => (
                  <li key={id}>
                    <button
                      style={{ width: '100%', textAlign: 'left', padding: '6px 8px', cursor: 'pointer' }}
                      onClick={() => setProcessingSelectedOp(item)}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <button onClick={() => setProcessingSelectedOp(null)}>←</button>
                <div id="processing-form-div" style={{ padding: '10px' }}>
                  <FormGenerator
                    operation={processingSelectedOp}
                    layers={Object.entries(props.model.getLayers()).map(([lid, layer]) => ({
                      id: lid,
                      name: layer.name,
                      source: props.model.getSource(layer.parameters?.source)?.parameters?.path,
                      type: layer.type,
                      vectorType: layer.type === 'VectorLayer' ? layer.parameters?.symbologyState?.geometryType : undefined
                    }))}
                    jgisPath={props.model.filePath.split('/').pop() ?? ''}
                    onExecute={(output: string) => {
                      const notebook = props.notebookTracker?.currentWidget?.content;
                      if (!notebook?.model) {
                        console.debug('No Notebook model found');
                        return;
                      }
                      notebook.model.sharedModel.insertCell(
                        notebook.activeCellIndex + 1,
                        { cell_type: 'code', source: output, metadata: {} }
                      );
                    }}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {!props.settings.storyMapsDisabled && (
            <TabsContent
              value="storyPanel"
              className="jgis-panel-tab-content"
              style={{ paddingTop: 0 }}
            >
              {/* Only show switch when NOT in presentation mode */}
              {!storyMapPresentationMode && !isListStory && (
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
                patchGeoJSONFeatureProperties={patchGeoJSONFeatureProperties}
              ></IdentifyPanelComponent>
            </TabsContent>
          )}

        </TabsRoot>
      </div>
    </Draggable>
  );
};

RightPanelComponent.displayName = 'RightPanel';

export const RightPanel = React.memo(RightPanelComponent);
