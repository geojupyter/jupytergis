import type { IJGISStoryMap } from '@jupytergis/schema';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState, type RefObject } from 'react';

import {
  formatGradientLabel,
  formatStoryTypeLabel,
} from '@/src/features/story/utils/storyEditorLabels';
import { STORY_TYPE } from '@/src/types';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import { Switch } from '@/src/shared/components/Switch';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/src/shared/components/Popover';

export interface IStoryEditorHeaderBarProps {
  story: IJGISStoryMap | null;
  segmentCount: number;
  onUpdateStory: (patch: Partial<IJGISStoryMap>) => void;
  portalContainerRef: RefObject<HTMLElement | null>;
}

const STORY_TYPE_OPTIONS = [
  { value: STORY_TYPE.guided, label: 'Guided' },
  { value: STORY_TYPE.unguided, label: 'Unguided' },
  { value: STORY_TYPE.verticalScroll, label: 'Vertical scroll' },
] as const;

const DEFAULT_BG_COLOR = '#1a1a2e';
const DEFAULT_TEXT_COLOR = '#f5f5f5';

function toColorInputValue(
  color: string | undefined,
  fallback: string,
): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  return fallback;
}

function StoryTitleInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Input
      className="jgis-story-editor-toolbar-title"
      value={draft}
      placeholder="Untitled story"
      aria-label="Story title"
      onChange={event => {
        setDraft(event.target.value);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        if (draft !== value) {
          onChange(draft);
        }
      }}
    />
  );
}

function StorySettingsPopover({
  story,
  onUpdateStory,
  portalContainerRef,
}: {
  story: IJGISStoryMap;
  onUpdateStory: (patch: Partial<IJGISStoryMap>) => void;
  portalContainerRef: RefObject<HTMLElement | null>;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Story settings">
          <FontAwesomeIcon icon={faGear} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        portalContainer={portalContainerRef.current}
      >
        <PopoverHeader>
          <PopoverTitle>Story settings</PopoverTitle>
        </PopoverHeader>
        <div className="jgis-story-editor-settings-sheet-body">
          <label className="jgis-story-editor-field">
            <span>Story type</span>
            <NativeSelect
              className="jgis-story-editor-story-type-native-select"
              value={story.storyType ?? STORY_TYPE.guided}
              onChange={event => {
                onUpdateStory({
                  storyType: event.target.value as IJGISStoryMap['storyType'],
                });
              }}
            >
              {STORY_TYPE_OPTIONS.map(option => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="jgis-story-editor-settings-section">
            <div className="jgis-story-editor-eyebrow">Presentation</div>
            <label className="jgis-story-editor-toggle-row">
              <span>Use gradient background</span>
              <Switch
                checked={story.showGradient !== false}
                onCheckedChange={checked => {
                  onUpdateStory({ showGradient: checked });
                }}
              />
            </label>
            <label className="jgis-story-editor-field">
              <span>Background color</span>
              <Input
                type="color"
                value={toColorInputValue(
                  story.presentationBgColor,
                  DEFAULT_BG_COLOR,
                )}
                onChange={event => {
                  onUpdateStory({ presentationBgColor: event.target.value });
                }}
              />
            </label>
            <label className="jgis-story-editor-field">
              <span>Text color</span>
              <Input
                type="color"
                value={toColorInputValue(
                  story.presentationTextColor,
                  DEFAULT_TEXT_COLOR,
                )}
                onChange={event => {
                  onUpdateStory({ presentationTextColor: event.target.value });
                }}
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StoryEditorHeaderBar({
  story,
  segmentCount,
  onUpdateStory,
  portalContainerRef,
}: IStoryEditorHeaderBarProps): JSX.Element {
  return (
    <div className="jgis-story-editor-toolbar">
      <div className="jgis-story-editor-context-bar">
        {story ? (
          <StoryTitleInput
            value={story.title ?? ''}
            onChange={title => {
              onUpdateStory({ title });
            }}
          />
        ) : null}
        <span className="jgis-story-editor-context-pill">
          {story ? formatStoryTypeLabel(story.storyType) : 'No story'}
        </span>
        <span className="jgis-story-editor-context-meta">
          {segmentCount} segment{segmentCount === 1 ? '' : 's'}
        </span>
        {story ? (
          <span className="jgis-story-editor-context-meta">
            {formatGradientLabel(story.showGradient)}
          </span>
        ) : null}
      </div>
      {story ? (
        <StorySettingsPopover
          story={story}
          onUpdateStory={onUpdateStory}
          portalContainerRef={portalContainerRef}
        />
      ) : (
        <Button variant="ghost" size="icon-sm" title="Story settings" disabled>
          <FontAwesomeIcon icon={faGear} />
        </Button>
      )}
    </div>
  );
}
