import React from 'react';
import Markdown from 'react-markdown';

interface IStoryContentProps {
  markdown: string;
}

function StoryContentSection({ markdown }: IStoryContentProps) {
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
