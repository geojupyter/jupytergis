import React from 'react';

import { TitleInput } from '@/src/features/story/components/TitleInput';

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
      <TitleInput
        value={value}
        onChange={caption => {
          onChange(caption);
        }}
      />
    </div>
  );
}

export default SegmentImageCaptionField;
