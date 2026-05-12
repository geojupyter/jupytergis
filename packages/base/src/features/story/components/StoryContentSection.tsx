import React from 'react';
import Markdown from 'react-markdown';

interface IStoryContentProps {
  contentMode?: 'map' | 'markdown';
  markdown: string;
}

function StoryContentSection({
  contentMode = 'map',
  markdown,
}: IStoryContentProps) {
  const shouldRenderMarkdown =
    contentMode === 'map' || contentMode === 'markdown';
  if (!shouldRenderMarkdown) {
    return null;
  }

  if (!markdown) {
    return null;
  }

  return (
    <div className="jgis-story-viewer-content">
      <Markdown>{markdown}</Markdown>
    </div>
  );
}

export default StoryContentSection;
