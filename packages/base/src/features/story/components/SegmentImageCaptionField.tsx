import React from 'react';

import { StoryEditorInput } from '@/src/features/story/components/StoryEditorInput';

interface ISegmentImageCaptionFieldProps {
  value: string;
  onChange: (caption: string) => void;
}

function SegmentImageCaptionField({
  value,
  onChange,
}: ISegmentImageCaptionFieldProps) {
  return (
    <div style={{ flexDirection: 'row' }}>
      <div className="jgis-story-editor-eyebrow">Image Caption</div>
      <StoryEditorInput
        value={value}
        placeholder="Enter Image Caption..."
        aria-label="Image caption"
        onChange={caption => {
          onChange(caption);
        }}
      />
    </div>
  );
}

export default SegmentImageCaptionField;
