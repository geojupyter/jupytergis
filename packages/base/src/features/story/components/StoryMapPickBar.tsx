import React from 'react';

import { Button } from '@/src/shared/components/Button';

export interface IStoryMapPickBarProps {
  onApply: () => void;
  onBack: () => void;
}

export function StoryMapPickBar({
  onApply,
  onBack,
}: IStoryMapPickBarProps): JSX.Element {
  return (
    <div className="jgis-story-map-pick-bar">
      <p className="jgis-story-map-pick-bar-message">
        Pan and zoom the map, then apply this view to the story stop.
      </p>
      <div className="jgis-story-map-pick-bar-actions">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to editor
        </Button>
        <Button size="sm" onClick={onApply}>
          Apply view
        </Button>
      </div>
    </div>
  );
}
