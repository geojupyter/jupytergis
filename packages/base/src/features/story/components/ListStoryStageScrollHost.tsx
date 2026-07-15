import React, { type RefObject } from 'react';

interface IListStoryStageScrollHostProps {
  scrollContainerRef: RefObject<HTMLDivElement>;
}

/**
 * Invisible scrollport for desktop vertical-scroll stories.
 */
export function ListStoryStageScrollHost({
  scrollContainerRef,
}: IListStoryStageScrollHostProps): JSX.Element {
  return (
    <div
      ref={scrollContainerRef}
      className="jgis-story-stage-scroll-host"
      aria-hidden
      data-testid="jgis-story-stage-scroll-host"
    />
  );
}
