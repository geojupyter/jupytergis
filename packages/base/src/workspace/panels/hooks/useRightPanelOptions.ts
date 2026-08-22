import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

/**
 * Fires optional callbacks when identified features change.
 */
export function useRightPanelOptions(
  model: IJupyterGISModel,
  opts?: {
    onIdentifyFeatures?: () => void;
  },
): void {
  const onIdentifyFeaturesRef = React.useRef(opts?.onIdentifyFeatures);
  React.useEffect(() => {
    onIdentifyFeaturesRef.current = opts?.onIdentifyFeatures;
  });

  React.useEffect(() => {
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

    model.identifiedFeaturesChanged.connect(handleIdentifiedFeaturesChanged);
    handleIdentifiedFeaturesChanged();

    return () => {
      model.identifiedFeaturesChanged.disconnect(
        handleIdentifiedFeaturesChanged,
      );
    };
  }, [model]);
}
