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

import StacPanel from '../stacBrowser/components/StacPanel';
import { AnnotationsPanel } from './annotationPanel';
import { ITabSpec, PanelContainer } from './components/PanelContainer';
import { LayersBodyComponent } from './components/layers';
import { useRightPanelOptions } from './hooks/useRightPanelOptions';
import { useLayerTree } from './hooks/useLayerTree';
import { IdentifyPanelComponent } from './identify-panel/IdentifyPanel';
import { ObjectPropertiesReact } from './objectproperties';
import StoryEditorPanel from './story-maps/StoryEditorPanel';
import { PreviewModeSwitch } from './story-maps/components/PreviewModeSwitch';
import { RightPanelStoryViewer } from './rightpanel';

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
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const handler = () => setVisible(v => !v);
    window.addEventListener('jgis:togglePanel', handler);
    return () => window.removeEventListener('jgis:togglePanel', handler);
  }, []);

  const [options, setOptions] = React.useState(props.model.getOptions());
  const storyMapPresentationModeLeft = options.storyMapPresentationMode ?? false;

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  const [curTab, setCurTab] = React.useState<string>(() => {
    if (!props.settings.layersDisabled) {
      return 'layers';
    }
    if (!props.settings.objectPropertiesDisabled) {
      return 'objectProperties';
    }
    return '';
  });

  React.useEffect(() => {
    const onOptionsChanged = () =>
      setOptions({ ...props.model.getOptions() });
    props.model.sharedOptionsChanged.connect(onOptionsChanged);
    return () => {
      props.model.sharedOptionsChanged.disconnect(onOptionsChanged);
    };
  }, [props.model]);

  const { filteredLayerTree, storySegmentLayerTree } = useLayerTree(
    props.model,
    props.commands,
    { onSegmentAdded: () => setCurTab('segments') },
  );

  const {
    storyMapPresentationMode,
    editorMode,
    setEditorMode,
    showEditor,
    storyPanelTitle,
  } = useRightPanelOptions(props.model, {
    onPresentationModeEnabled: () => setCurTab('storyPanel'),
    onIdentifyFeatures: () => setCurTab('identifyPanel'),
  });

  const tabs: ITabSpec[] = [
    {
      name: 'layers',
      title: 'Layers',
      enabled: !props.settings.layersDisabled,
      contentClassName: 'jp-gis-layerPanel',
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={filteredLayerTree}
        />
      ),
    },
    {
      name: 'stac',
      title: 'Stac Browser',
      enabled:
        !props.settings.stacBrowserDisabled && !storyMapPresentationModeLeft,
      contentClassName: 'jgis-panel-tab-content-stac-panel',
      content: <StacPanel model={props.model} />,
    },
    {
      name: 'segments',
      title: 'Segments',
      enabled: !props.settings.storyMapsDisabled,
      content: (
        <LayersBodyComponent
          model={props.model}
          commands={props.commands}
          state={props.state}
          layerTree={storySegmentLayerTree}
        />
      ),
    },
    {
      name: 'objectProperties',
      title: 'Object Properties',
      enabled:
        !props.settings.objectPropertiesDisabled && !storyMapPresentationMode,
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
      enabled: !props.settings.storyMapsDisabled,
      contentStyle: { paddingTop: 0 },
      content: (
        <>
          {!storyMapPresentationMode && (
            <PreviewModeSwitch
              checked={!editorMode}
              onCheckedChange={() => setEditorMode(m => !m)}
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
        </>
      ),
    },
    {
      name: 'annotations',
      title: 'Annotations',
      enabled: !props.settings.annotationsDisabled,
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
      enabled: !props.settings.identifyDisabled,
      content: <IdentifyPanelComponent model={props.model} />,
    },
  ];

  return (
    <PanelContainer
      tabs={tabs}
      containerClassName="jgis-merged-panel-container"
      curTab={curTab}
      onTabClick={name => setCurTab(prev => (prev === name ? '' : name))}
      style={{ display: visible ? 'block' : 'none' }}
    />
  );
};
