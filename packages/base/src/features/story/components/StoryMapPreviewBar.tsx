import React from 'react';

import { Button } from '@/src/shared/components/Button';

export interface IStoryMapPreviewBarProps {
  onBack: () => void;
}

export function StoryMapPreviewBar({
  onBack,
}: IStoryMapPreviewBarProps): JSX.Element {
  return (
    <div className="jgis-story-map-pick-bar">
      <p className="jgis-story-map-pick-bar-message">
        Previewing this stop on the map with its layer overrides.
      </p>
      <div className="jgis-story-map-pick-bar-actions">
        <Button size="sm" onClick={onBack}>
          Back to editor
        </Button>
      </div>
    </div>
  );
}
