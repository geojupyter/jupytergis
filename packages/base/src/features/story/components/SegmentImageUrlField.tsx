import React, { useEffect, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';

export interface ISegmentImageUrlFieldProps {
  value: string;
  onChange: (imageUrl: string) => void;
}

export function SegmentImageUrlField({
  value,
  onChange,
}: ISegmentImageUrlFieldProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(value);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setDraftUrl(value);
    setPreviewFailed(false);
    if (value.trim()) {
      setIsEditing(false);
    }
  }, [value]);

  const trimmedValue = value.trim();
  const showUrlInput = !trimmedValue || isEditing || previewFailed;

  const handleCommit = (): void => {
    const nextUrl = draftUrl.trim();
    onChange(nextUrl);
    setIsEditing(false);
    setPreviewFailed(false);
  };

  const handleRemove = (): void => {
    onChange('');
    setDraftUrl('');
    setIsEditing(false);
    setPreviewFailed(false);
  };

  if (showUrlInput) {
    return (
      <div className="jgis-story-editor-segment-image">
        <label className="jgis-story-editor-field">
          <span>Hero image URL</span>
          <Input
            type="url"
            className="jgis-story-editor-segment-image-url-input"
            placeholder="https://example.com/image.jpg"
            value={draftUrl}
            onChange={event => setDraftUrl(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                handleCommit();
              }
            }}
          />
        </label>
        <div className="jgis-story-editor-segment-image-url-actions">
          <Button
            type="button"
            size="sm"
            onClick={handleCommit}
            variant="secondary"
          >
            Use URL
          </Button>
          {trimmedValue ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                setDraftUrl(value);
                setIsEditing(false);
                setPreviewFailed(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="jgis-story-editor-segment-image">
      <div className="jgis-story-editor-segment-image-card">
        <img
          className="jgis-story-editor-segment-image-card-media"
          src={value}
          alt=""
          onError={() => setPreviewFailed(true)}
        />
        <div className="jgis-story-editor-segment-image-card-actions">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDraftUrl(value);
              setIsEditing(true);
            }}
          >
            Change
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
