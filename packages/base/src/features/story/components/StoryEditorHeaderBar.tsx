import { faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState, type RefObject } from 'react';

import { TitleInput } from '@/src/features/story/components/TitleInput';
import {
  getStoryPresentationMode,
  isVerticalScrollPresentation,
} from '@/src/features/story/presentation/getStoryPresentationMode';
import { StoryEditorSession } from '@/src/features/story/storyEditorSession';
import {
  formatOverlayContentWidth,
  matchOverlayContentWidthPreset,
  OVERLAY_CONTENT_WIDTH_PRESETS,
  OVERLAY_CONTENT_WIDTH_UNITS,
  parseOverlayContentWidth,
  resolveStoryPresentationColorForInput,
  type OverlayContentWidthUnit,
} from '@/src/features/story/utils/spectaPresentation';
import {
  formatGradientLabel,
  formatMarkdownSegmentGapLabel,
  formatStoryTypeLabel,
} from '@/src/features/story/utils/storyEditorLabels';
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
import { Switch } from '@/src/shared/components/Switch';
import { STORY_TYPE } from '@/src/types';

export interface IStoryEditorHeaderBarProps {
  model: IJupyterGISModel;
  story: IJGISStoryMap | null;
  segmentCount: number;
  onUpdateStory: (patch: Partial<IJGISStoryMap>) => void;
  portalContainerRef: RefObject<HTMLElement | null>;
}

/**
 * CSS length amount accepts digits with at most one decimal point.
 * Allows intermediate edit states ("", ".", "1.") that type="number"
 * mishandles in Firefox when the input is controlled.
 */
const CSS_AMOUNT_FRAGMENT = /^\d*\.?\d*$/;
const CSS_AMOUNT_COMPLETE = /^\d*\.?\d+$/;

function sanitizeCssAmountInput(raw: string): string {
  if (CSS_AMOUNT_FRAGMENT.test(raw)) {
    return raw;
  }

  let result = '';
  let hasDot = false;
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      result += char;
    } else if (char === '.' && !hasDot) {
      result += '.';
      hasDot = true;
    }
  }
  return result;
}

function OverlayContentWidthField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (width: string) => void;
}): JSX.Element {
  const matchedPreset = matchOverlayContentWidthPreset(value);
  const [isCustom, setIsCustom] = useState(matchedPreset === null);
  const parsed = parseOverlayContentWidth(value);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState(parsed.unit);
  const [widthError, setWidthError] = useState<string | null>(null);
  const selectedPresetId = isCustom ? null : matchedPreset;

  useEffect(() => {
    const next = parseOverlayContentWidth(value);
    setAmount(next.amount);
    setUnit(next.unit);
    setWidthError(null);
  }, [value]);

  return (
    <div className="jgis-story-editor-field">
      <span>Overlay content width</span>
      <div
        className="jgis-story-editor-width-presets"
        role="group"
        aria-label="Overlay content width presets"
      >
        {OVERLAY_CONTENT_WIDTH_PRESETS.map(preset => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className={`jgis-story-editor-width-preset${
              selectedPresetId === preset.id
                ? ' jgis-story-editor-width-preset--selected'
                : ''
            }`}
            aria-pressed={selectedPresetId === preset.id}
            title={preset.value}
            onClick={() => {
              setIsCustom(false);
              onChange(preset.value);
            }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`jgis-story-editor-width-preset${
            isCustom ? ' jgis-story-editor-width-preset--selected' : ''
          }`}
          aria-pressed={isCustom}
          onClick={() => {
            setIsCustom(true);
          }}
        >
          Custom
        </Button>
      </div>
      {isCustom ? (
        <>
          <div className="jgis-story-editor-width-custom">
            <Input
              aria-label="Width amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={event => {
                const nextAmount = sanitizeCssAmountInput(event.target.value);
                setAmount(nextAmount);

                if (!CSS_AMOUNT_COMPLETE.test(nextAmount)) {
                  setWidthError('Enter a valid width');
                  return;
                }

                setWidthError(null);
                onChange(formatOverlayContentWidth(nextAmount, unit));
              }}
            />
            <NativeSelect
              aria-label="Width unit"
              value={unit}
              onChange={event => {
                const nextUnit = event.target.value as OverlayContentWidthUnit;
                setUnit(nextUnit);

                if (!CSS_AMOUNT_COMPLETE.test(amount.trim())) {
                  setWidthError('Enter a valid width');
                  return;
                }

                setWidthError(null);
                onChange(formatOverlayContentWidth(amount.trim(), nextUnit));
              }}
            >
              {OVERLAY_CONTENT_WIDTH_UNITS.map(unitOption => (
                <NativeSelectOption key={unitOption} value={unitOption}>
                  {unitOption}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {widthError ? (
            <p className="jgis-story-editor-field-error">{widthError}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
//sdsds
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
        <Button
          variant="ghost"
          title="Story settings"
          style={{ marginBottom: 1 }}
        >
          <FontAwesomeIcon icon={faGear} style={{ marginBottom: 3 }} />
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
              {Object.values(STORY_TYPE).map(storyType => (
                <NativeSelectOption key={storyType} value={storyType}>
                  {formatStoryTypeLabel(storyType)}
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
                <OverlayContentWidthField
                  value={story.overlayContentWidth}
                  onChange={overlayContentWidth => {
                    onUpdateStory({ overlayContentWidth });
                  }}
                />
              </>
            ) : null}
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
  onUpdateStory,
  portalContainerRef,
}: IStoryEditorHeaderBarProps): JSX.Element {
  const canPreview = model.canUseStoryPreview();

  return (
    <div className="jgis-story-editor-context-bar">
      <TitleInput
        value={story?.title ?? ''}
        disabled={!story}
        onChange={title => {
          onUpdateStory({ title });
        }}
      />
      <div className="jgis-story-editor-context-meta-group">
        <Badge variant="secondary">
          {story ? formatStoryTypeLabel(story.storyType) : 'No story'}
        </Badge>
        <span className="jgis-story-editor-context-meta">
          {segmentCount} segment{segmentCount === 1 ? '' : 's'}
        </span>
        {story ? (
          <span className="jgis-story-editor-context-meta">
            {formatGradientLabel(story.showGradient)}
          </span>
        ) : null}
        {story &&
        isVerticalScrollPresentation(
          getStoryPresentationMode(story.storyType),
        ) ? (
          <span className="jgis-story-editor-context-meta">
            {formatMarkdownSegmentGapLabel(story.markdownSegmentGap)}
          </span>
        ) : null}
        {story && canPreview ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              StoryEditorSession.getInstance().enterStoryPreviewMode();
            }}
          >
            Preview story
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
