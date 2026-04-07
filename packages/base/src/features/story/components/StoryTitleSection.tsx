import React from 'react';

interface IStoryTitleSectionProps {
  title: string;
  navSlot?: React.ReactNode;
}

function StoryTitleSection({ title, navSlot }: IStoryTitleSectionProps) {
  return (
    <>
      <h1 className="jgis-story-viewer-title">{title}</h1>
      {navSlot}
    </>
  );
}

export default StoryTitleSection;
