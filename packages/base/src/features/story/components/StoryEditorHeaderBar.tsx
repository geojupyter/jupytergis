import { faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useState, type RefObject } from 'react';

import { SegmentWidthSelector } from '@/src/features/story/components/SegmentWidthSelector';
import { StoryEditorInput } from '@/src/features/story/components/StoryEditorInput';
import {
  getStoryPresentationMode,
  isColumnPresentation,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { StoryEditorSession } from '@/src/features/story/storyEditorSession';
import { CSS_WIDTH_PRESETS } from '@/src/features/story/utils/cssWidth';
import {
  resolveStoryOpacity,
  resolveStoryPresentationColorForInput,
} from '@/src/features/story/utils/spectaPresentation';
import { formatStoryTypeLabel } from '@/src/features/story/utils/storyEditorLabels';
import Badge from '@/src/shared/components/Badge';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import { Slider } from '@/src/shared/components/Slider';
import { Switch } from '@/src/shared/components/Switch';
import { STORY_TYPE } from '@/src/types';

export interface IStoryEditorHeaderBarProps {
  model: IJupyterGISModel;
  story: IJGISStoryMap | null;
  segmentCount: number;
  isMobile: boolean;
  onUpdateStory: (patch: Partial<IJGISStoryMap>) => void;
  portalContainerRef: RefObject<HTMLElement | null>;
}

function StoryOpacityField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (opacity: number) => void;
}): JSX.Element {
  const opacityPercent = Math.round(resolveStoryOpacity(value) * 100);

  return (
    <div className="jgis-story-editor-field">
      <span>{label}</span>
      <div className="jgis-story-editor-opacity-row">
        <Slider
          min={0}
          max={100}
          step={1}
          value={[opacityPercent]}
          aria-label={label}
          onValueChange={([next]) => {
            onChange(next / 100);
          }}
        />
        <span className="jgis-story-editor-opacity-value">
          {opacityPercent}%
        </span>
      </div>
    </div>
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
      <PopoverTrigger
        render={
          <Button variant="ghost" title="Story settings">
            <FontAwesomeIcon icon={faGear} />
          </Button>
        }
      />
      <PopoverContent align="end" side="bottom">
        <PopoverHeader>
          <PopoverTitle>Story settings</PopoverTitle>
        </PopoverHeader>
        <div className="jgis-story-editor-settings-sheet-body">
          <label className="jgis-story-editor-field">
            <span>Story type</span>
            <NativeSelect
              className="w-full"
              value={story.storyType ?? STORY_TYPE.guided}
              onChange={event => {
                onUpdateStory({
                  storyType: event.target.value as IJGISStoryMap['storyType'],
                });
              }}
            >
              {Object.values(STORY_TYPE).map(storyType => (
                <NativeSelectOption key={storyType} value={storyType}>
                  {formatStoryTypeLabel(storyType)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="jgis-story-editor-settings-section">
            <div className="jgis-story-editor-eyebrow">Presentation</div>
            {isColumnPresentation(getStoryPresentationMode(story.storyType)) ? (
              <label className="jgis-story-editor-toggle-row">
                <span>Use gradient background</span>
                <Switch
                  checked={story.showGradient !== false}
                  onCheckedChange={checked => {
                    onUpdateStory({ showGradient: checked });
                  }}
                />
              </label>
            ) : null}
            {isVerticalScrollPresentation(
              getStoryPresentationMode(story.storyType),
            ) ? (
              <>
                <label className="jgis-story-editor-toggle-row">
                  <span>Gap between markdown segments</span>
                  <Switch
                    checked={story.markdownSegmentGap === true}
                    onCheckedChange={checked => {
                      onUpdateStory({ markdownSegmentGap: checked });
                    }}
                  />
                </label>
                <SegmentWidthSelector
                  label="Overlay content width"
                  value={story.overlayContentWidth}
                  onChange={overlayContentWidth => {
                    onUpdateStory({ overlayContentWidth });
                  }}
                  presets={CSS_WIDTH_PRESETS}
                  presetGroupAriaLabel="Overlay content width presets"
                  size="xs"
                />
                <StoryOpacityField
                  label="Markdown segment opacity"
                  value={story.markdownSegmentOpacity}
                  onChange={markdownSegmentOpacity => {
                    onUpdateStory({ markdownSegmentOpacity });
                  }}
                />
              </>
            ) : null}
            <StoryOpacityField
              label="Story panel opacity"
              value={story.storyPanelOpacity}
              onChange={storyPanelOpacity => {
                onUpdateStory({ storyPanelOpacity });
              }}
            />
            <label className="jgis-story-editor-field">
              <span>Background color</span>
              <Input
                type="color"
                value={resolveStoryPresentationColorForInput(
                  story.presentationBgColor,
                  'bg',
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
                value={resolveStoryPresentationColorForInput(
                  story.presentationTextColor,
                  'text',
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
  model,
  story,
  segmentCount,
  isMobile,
  onUpdateStory,
  portalContainerRef,
}: IStoryEditorHeaderBarProps): JSX.Element {
  const canPreview = model.canUseStoryPreview();

  return (
    <div className="jgis-story-editor-context-bar">
      <StoryEditorInput
        value={story?.title ?? ''}
        placeholder="Enter Story Title..."
        aria-label="Story title"
        disabled={!story}
        onChange={title => {
          onUpdateStory({ title });
        }}
      />
      <div className="jgis-story-editor-context-meta-group">
        <Badge variant="secondary" className="jgis-story-editor-context-badge">
          {story ? formatStoryTypeLabel(story.storyType) : 'No story'}
        </Badge>
        <span className="jgis-story-editor-context-meta">
          {segmentCount} segment{segmentCount === 1 ? '' : 's'}
        </span>
        {story && canPreview ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              StoryEditorSession.getInstance().enterStoryPreviewMode();
            }}
          >
            {isMobile ? 'Preview' : 'Preview story'}
          </Button>
        ) : null}
        {story && (
          <StorySettingsPopover
            story={story}
            onUpdateStory={onUpdateStory}
            portalContainerRef={portalContainerRef}
          />
        )}
      </div>
    </div>
  );
}
