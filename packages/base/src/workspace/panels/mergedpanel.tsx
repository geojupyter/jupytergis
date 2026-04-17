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
  const panelHeightRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);

  const startTabListInteract = (startX: number, startY: number) => {
    const startHeight = panelHeightRef.current ?? window.innerHeight * 0.3;
    let gesture: 'undecided' | 'vertical' | 'horizontal' = 'undecided';

    const classify = (dx: number, dy: number) => {
      if (Math.hypot(dx, dy) > 6) {
        gesture = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal';
      }
    };

    const applyResize = (clientY: number) => {
      const clamped = Math.max(
        60,
        Math.min(startHeight + (startY - clientY), window.innerHeight * 0.9),
      );
      panelHeightRef.current = clamped;
      setPanelHeight(clamped);
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (gesture === 'undecided') {
        classify(ev.clientX - startX, ev.clientY - startY);
      }
      if (gesture === 'vertical') {
        isDraggingRef.current = true;
        applyResize(ev.clientY);
      }
    };

    const onTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (gesture === 'undecided') {
        classify(t.clientX - startX, t.clientY - startY);
      }
      if (gesture === 'vertical') {
        ev.preventDefault();
        isDraggingRef.current = true;
        applyResize(t.clientY);
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', cleanup);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', cleanup);
      // Reset after click fires (click follows mouseup synchronously)
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', cleanup);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', cleanup);
  };

  const onTabListMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    startTabListInteract(e.clientX, e.clientY);
  };

  const onTabListTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    startTabListInteract(t.clientX, t.clientY);
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
      <div className="jgis-resize-handle" />
      <TabbedPanel
        tabs={tabs}
        curTab={effectiveCurTab}
        onTabClick={name => {
          if (isDraggingRef.current) {
            return;
          }
          setCurTab(prev => (prev === name ? '' : name));
        }}
        onTabListMouseDown={onTabListMouseDown}
        onTabListTouchStart={onTabListTouchStart}
      />
    </div>
  );
};
