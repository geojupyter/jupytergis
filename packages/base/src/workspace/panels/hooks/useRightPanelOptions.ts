import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

interface IUseRightPanelOptionsResult {
  storyMapPresentationMode: boolean;
  editorMode: boolean;
  showEditor: boolean;
  storyPanelTitle: string;
  toggleEditor: () => void;
}

/**
 * Tracks story map presentation mode and editor mode, and fires optional
 * callbacks when the active tab should change. This keeps tab state in the
 * caller (RightPanel, MergedPanel, …) rather than inside this hook, so the
 * same hook can drive any panel layout.
 *
 * @param model - The JupyterGIS model to subscribe to.
 * @param opts.onPresentationModeEnabled - Called when story presentation mode
 *   is activated; the caller should switch to the story tab.
 * @param opts.onIdentifyFeatures - Called when new features are identified on
 *   the map; the caller should switch to the identify tab.
 * @returns storyMapPresentationMode, editorMode, showEditor, storyPanelTitle,
 *   toggleEditor.
 */
export function useRightPanelOptions(
  model: IJupyterGISModel,
  opts?: {
    onPresentationModeEnabled?: () => void;
    onIdentifyFeatures?: () => void;
  },
): IUseRightPanelOptionsResult {
  const [editorMode, setEditorMode] = React.useState(true);
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(model.getOptions().storyMapPresentationMode ?? false);

  // Keep refs fresh to avoid stale closures in the effect below
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

    const handleIdentifiedFeaturesChanged = () => {
      const identifiedFeatures = model.localState?.identifiedFeatures?.value;
      if (!identifiedFeatures) {
        return;
      }

      if (identifiedFeatures !== currentlyIdentifiedFeatures) {
        currentlyIdentifiedFeatures = identifiedFeatures;
        onIdentifyFeaturesRef.current?.();
      }
    };

    model.sharedOptionsChanged.connect(onOptionsChanged);
    model.identifiedFeaturesChanged.connect(handleIdentifiedFeaturesChanged);
    handleIdentifiedFeaturesChanged();

    return () => {
      model.sharedOptionsChanged.disconnect(onOptionsChanged);
      model.identifiedFeaturesChanged.disconnect(
        handleIdentifiedFeaturesChanged,
      );
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
    toggleEditor,
  };
}
