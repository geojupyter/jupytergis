import { IJupyterGISClientState, IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

export interface IRightPanelOptions {
  storyMapPresentationMode: boolean;
  editorMode: boolean;
  setEditorMode: React.Dispatch<React.SetStateAction<boolean>>;
  showEditor: boolean;
  storyPanelTitle: string;
}

export function useRightPanelOptions(
  model: IJupyterGISModel,
  opts?: {
    onPresentationModeEnabled?: () => void;
    onIdentifyFeatures?: () => void;
  },
): IRightPanelOptions {
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(model.getOptions().storyMapPresentationMode ?? false);
  const [editorMode, setEditorMode] = React.useState(true);

  // Keep stable refs to callbacks
  const onPresentationModeEnabledRef = React.useRef(
    opts?.onPresentationModeEnabled,
  );
  const onIdentifyFeaturesRef = React.useRef(opts?.onIdentifyFeatures);
  React.useEffect(() => {
    onPresentationModeEnabledRef.current = opts?.onPresentationModeEnabled;
    onIdentifyFeaturesRef.current = opts?.onIdentifyFeatures;
  });

  React.useEffect(() => {
    const onOptionsChanged = () => {
      const { storyMapPresentationMode } = model.getOptions();
      setStoryMapPresentationMode(storyMapPresentationMode ?? false);
      if (storyMapPresentationMode) {
        onPresentationModeEnabledRef.current?.();
      }
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
        onIdentifyFeaturesRef.current?.();
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

  return {
    storyMapPresentationMode,
    editorMode,
    setEditorMode,
    showEditor,
    storyPanelTitle,
  };
}
