import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

interface IUseRightPanelOptionsResult {
  storyMapPresentationMode: boolean;
}

/**
 * Tracks story map presentation mode and fires optional callbacks when the
 * active tab should change.
 */
export function useRightPanelOptions(
  model: IJupyterGISModel,
  opts?: {
    onIdentifyFeatures?: () => void;
  },
): IUseRightPanelOptionsResult {
  const [storyMapPresentationMode, setStoryMapPresentationMode] =
    React.useState(model.getOptions().storyMapPresentationMode ?? false);

  const onIdentifyFeaturesRef = React.useRef(opts?.onIdentifyFeatures);
  React.useEffect(() => {
    onIdentifyFeaturesRef.current = opts?.onIdentifyFeatures;
  });

  React.useEffect(() => {
    const onOptionsChanged = () => {
      const { storyMapPresentationMode: presentationMode } = model.getOptions();
      setStoryMapPresentationMode(presentationMode ?? false);
    };

    let currentlyIdentifiedFeatures: unknown;

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

  return {
    storyMapPresentationMode,
  };
}
