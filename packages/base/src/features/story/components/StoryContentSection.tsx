import React from 'react';
import Markdown from 'react-markdown';

interface IStoryContentProps {
  contentMode?: 'map' | 'html';
  markdown: string;
  htmlContent?: string;
}

function StoryContentSection({
  contentMode = 'map',
  markdown,
  htmlContent = '',
}: IStoryContentProps) {
  if (contentMode === 'html') {
    if (!htmlContent.trim()) {
      return null;
    }

    return (
      <div className="jgis-story-viewer-content">
        <iframe
          className="jgis-story-viewer-html-preview"
          sandbox=""
          srcDoc={htmlContent}
          title="Story segment HTML content"
        />
      </div>
    );
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
