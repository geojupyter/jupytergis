import {
  IJupyterGISClientState,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import * as React from 'react';

interface IUseRightPanelOptionsResult {
  storyMapPresentationMode: boolean;
  editorMode: boolean;
  showEditor: boolean;
  storyPanelTitle: string;
  curTab: string;
  setCurTab: React.Dispatch<React.SetStateAction<string>>;
  toggleEditor: () => void;
}

export function useRightPanelOptions(
  model: IJupyterGISModel,
  settings: IJupyterGISSettings,
): IUseRightPanelOptionsResult {
  const [editorMode, setEditorMode] = React.useState(true);
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(model.getOptions().storyMapPresentationMode ?? false);

  const [curTab, setCurTab] = React.useState<string>(() => {
    const initialPresentationMode =
      model.getOptions().storyMapPresentationMode ?? false;
    if (initialPresentationMode) {
      return 'storyPanel';
    }
    if (!settings.objectPropertiesDisabled) {
      return 'objectProperties';
    }
    if (!settings.storyMapsDisabled) {
      return 'storyPanel';
    }
    if (!settings.annotationsDisabled) {
      return 'annotations';
    }
    if (!settings.identifyDisabled) {
      return 'identifyPanel';
    }
    return '';
  });

  React.useEffect(() => {
    const onOptionsChanged = () => {
      const { storyMapPresentationMode } = model.getOptions();
      setStoryMapPresentationMode(storyMapPresentationMode ?? false);
      storyMapPresentationMode && setCurTab('storyPanel');
    };
    let currentlyIdentifiedFeatures: any = undefined;
    const onAwarenessChanged = (
      _: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>,
    ) => {
      const clientId = model.getClientId();
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

    model.sharedOptionsChanged.connect(onOptionsChanged);
    model.clientStateChanged.connect(onAwarenessChanged);

    return () => {
      model.sharedOptionsChanged.disconnect(onOptionsChanged);
      model.clientStateChanged.disconnect(onAwarenessChanged);
    };
  }, [model]);

  const showEditor = !storyMapPresentationMode && editorMode;

  const storyPanelTitle = storyMapPresentationMode
    ? 'Story Map'
    : editorMode
      ? 'Story Editor'
      : 'Story Map';

  const toggleEditor = () => {
    setEditorMode(prev => !prev);
  };

  return {
    storyMapPresentationMode,
    editorMode,
    showEditor,
    storyPanelTitle,
    curTab,
    setCurTab,
    toggleEditor,
  };
}
