import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';

import { ITabConfig, TabbedPanel } from './components/TabbedPanel';
import { LayersBodyComponent } from './components/layers';
import { useLayerTree } from './hooks/useLayerTree';
import { useRightPanelOptions } from './hooks/useRightPanelOptions';
import { useUIState } from './hooks/useUIState';
import { RightPanelStoryViewer } from './rightpanel';
import { AnnotationsPanel } from '../../features/annotations';
import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';
import { ObjectPropertiesReact } from '../../features/objectproperties';
import StacPanel from '../../features/stac-browser/components/StacPanel';
import StoryEditorPanel from '../../features/story/StoryEditorPanel';
import { PreviewModeSwitch } from '../../features/story/components/PreviewModeSwitch';

export interface IMergedPanelProps {
  model: IJupyterGISModel;
  state: IStateDB;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer?: (id: string) => void;
}

export const MergedPanel: React.FC<IMergedPanelProps> = props => {
  const [leftPanelOpen] = useUIState('leftPanelOpen', props.model);
  const [rightPanelOpen] = useUIState('rightPanelOpen', props.model);

  const [panelHeight, setPanelHeight] = React.useState<number | null>(null);

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    const newHeight = window.innerHeight - e.clientY;
    setPanelHeight(Math.max(60, Math.min(newHeight, window.innerHeight * 0.9)));
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const [curTab, setCurTab] = React.useState<string>(() => {
    const { leftPanelDisabled, rightPanelDisabled } = props.settings;
    if (!leftPanelDisabled && !props.settings.layersDisabled) {
      return 'layers';
    }
    if (!rightPanelDisabled && !props.settings.objectPropertiesDisabled) {
      return 'objectProperties';
    }
    return '';
  });

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  const { layerTree, segmentTree } = useLayerTree(props.model, props.commands, {
    onSegmentAdded: () => setCurTab('segments'),
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

  const { leftPanelDisabled, rightPanelDisabled } = props.settings;

  const tabs: ITabConfig[] = [
    {
      name: 'layers',
      title: 'Layers',
      enabled:
        !leftPanelDisabled &&
        !props.settings.layersDisabled &&
        !storyMapPresentationMode,
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={layerTree}
        />
      ),
    },
    {
      name: 'stac',
      title: 'Stac Browser',
      enabled:
        !leftPanelDisabled &&
        !props.settings.stacBrowserDisabled &&
        !storyMapPresentationMode,
      content: <StacPanel model={props.model} />,
    },
    {
      name: 'segments',
      title: 'Segments',
      enabled: !leftPanelDisabled && !props.settings.storyMapsDisabled,
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={segmentTree}
        />
      ),
    },
    {
      name: 'objectProperties',
      title: 'Object Properties',
      enabled:
        !rightPanelDisabled &&
        !props.settings.objectPropertiesDisabled &&
        !storyMapPresentationMode,
      content: (
        <ObjectPropertiesReact
          setSelectedObject={setSelectedObjectProperties}
          selectedObject={selectedObjectProperties}
          formSchemaRegistry={props.formSchemaRegistry}
          model={props.model}
        />
      ),
    },
    {
      name: 'storyPanel',
      title: storyPanelTitle,
      enabled: !rightPanelDisabled && !props.settings.storyMapsDisabled,
      content: (
        <>
          {!storyMapPresentationMode && (
            <PreviewModeSwitch
              checked={!editorMode}
              onCheckedChange={toggleEditor}
            />
          )}
          {showEditor ? (
            <StoryEditorPanel model={props.model} commands={props.commands} />
          ) : curTab === 'storyPanel' ? (
            <RightPanelStoryViewer
              model={props.model}
              addLayer={props.addLayer}
              removeLayer={props.removeLayer}
            />
          ) : null}
        </>
      ),
    },
    {
      name: 'annotations',
      title: 'Annotations',
      enabled: !rightPanelDisabled && !props.settings.annotationsDisabled,
      content: (
        <AnnotationsPanel
          annotationModel={props.annotationModel}
          jgisModel={props.model}
        />
      ),
    },
    {
      name: 'identifyPanel',
      title: 'Identified Features',
      enabled: !rightPanelDisabled && !props.settings.identifyDisabled,
      content: <IdentifyPanelComponent model={props.model} />,
    },
  ];

  const enabledTabNames = tabs.filter(t => t.enabled).map(t => t.name);
  const effectiveCurTab = enabledTabNames.includes(curTab)
    ? curTab
    : (enabledTabNames[0] ?? '');

  return (
    <div
      className="jgis-merged-panel-container"
      style={{
        display:
          (leftPanelDisabled || leftPanelOpen === false) &&
          (rightPanelDisabled || rightPanelOpen === false)
            ? 'none'
            : undefined,
        ...(panelHeight !== null ? { height: `${panelHeight}px` } : {}),
      }}
    >
      <div
        className="jgis-resize-handle"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
      <TabbedPanel
        tabs={tabs}
        curTab={effectiveCurTab}
        onTabClick={name => setCurTab(prev => (prev === name ? '' : name))}
      />
    </div>
  );
};
