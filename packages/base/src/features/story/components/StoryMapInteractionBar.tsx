import React from 'react';

export interface IStoryMapInteractionBarProps {
  message: string;
  children: React.ReactNode;
}

export function StoryMapInteractionBar({
  message,
  children,
}: IStoryMapInteractionBarProps): JSX.Element {
  return (
    <div className="jgis-story-map-pick-bar">
      <p className="jgis-story-map-pick-bar-message">{message}</p>
      <div className="jgis-story-map-pick-bar-actions">{children}</div>
    </div>
  );
}
