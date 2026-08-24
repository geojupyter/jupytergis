import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import SegmentImageCaptionField from '@/src/features/story/components/SegmentImageCaptionField';
import { SegmentImageUrlField } from '@/src/features/story/components/SegmentImageUrlField';
import { SegmentLayerOverrides } from '@/src/features/story/components/SegmentLayerOverrides';
import { SegmentMarkdownEditor } from '@/src/features/story/components/SegmentMarkdownEditor';
import { SegmentModePicker } from '@/src/features/story/components/SegmentModePicker';
import { SegmentPaneAlignmentPicker } from '@/src/features/story/components/SegmentPaneAlignmentPicker';
import { SegmentWidthSelector } from '@/src/features/story/components/SegmentWidthSelector';
import { StoryEditorHeaderBar } from '@/src/features/story/components/StoryEditorHeaderBar';
import { StoryEditorInput } from '@/src/features/story/components/StoryEditorInput';
import { StoryEditorSection } from '@/src/features/story/components/StoryEditorSection';
import { StoryEditorSegmentList } from '@/src/features/story/components/StoryEditorSegmentList';
import { useStoryEditorSegmentList } from '@/src/features/story/hooks/useStoryEditorSegmentList';
import { StoryEditorSession } from '@/src/features/story/storyEditorSession';
import type {
  IStorySegmentViewItem,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/types';
import {
  isMarkdownOverlayWidthFull,
  MAP_PANEL_WIDTH_PRESETS,
} from '@/src/features/story/utils/cssWidth';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import {
  copyStorySegment,
  duplicateStorySegment,
  isAccelKey,
  isStoryEditorTypingTarget,
} from '@/src/features/story/utils/storySegmentClipboard';
import {
  getSegmentPaneAlignment,
  type SegmentContentPatch,
} from '@/src/features/story/utils/storySegmentContent';
import {
  formatSegmentTransitionTime,
  getSegmentTransitionTime,
  MAX_SEGMENT_TRANSITION_TIME,
  MIN_SEGMENT_TRANSITION_TIME,
  SEGMENT_TRANSITION_TIME_STEP,
  type SegmentTransitionPatch,
} from '@/src/features/story/utils/storySegmentTransition';
import {
  getStoryMarkdownFromSlide,
  getStorySegmentDisplayTitle,
} from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import { Slider } from '@/src/shared/components/Slider';
import { JGIS_NARROW_BREAKPOINT } from '@/src/shared/hooks/useIsMobile';

export interface IStoryEditorDialogBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  editorServices: IEditorServices;
}

function SegmentEditor({
  model,
  state,
  segment,
  editorServices,
  portalContainerRef,
  canRemoveSegment,
  isMobile,
  onContentModeChange,
  onContentChange,
  onLayerNameChange,
  onTransitionChange,
  onRemoveSegment,
  isTextSegmentWidthFull,
}: {
  model: IJupyterGISModel;
  state: IStateDB;
  segment: IStorySegmentViewItem;
  editorServices: IEditorServices;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  canRemoveSegment: boolean;
  isMobile: boolean;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
  onContentChange: (patch: SegmentContentPatch) => void;
  onLayerNameChange: (name: string) => void;
  onTransitionChange: (patch: SegmentTransitionPatch) => void;
  onRemoveSegment: () => void;
  isTextSegmentWidthFull: boolean;
}): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(true);
  const [animationOpen, setAnimationOpen] = useState(false);
  const displayTitle = getStorySegmentDisplayTitle(segment);
  const imageUrl = segment.activeSlide?.content?.image ?? '';
  const imageCaption = segment.activeSlide?.content?.imageCaption ?? '';
  const markdown = getStoryMarkdownFromSlide(segment.activeSlide);
  const segmentMode = getSegmentDisplayMode(segment.activeSlide);
  const paneAlignment = getSegmentPaneAlignment(
    segment.activeSlide?.content,
    segmentMode,
  );
  const transitionType = segment.activeSlide?.transition?.type ?? 'linear';
  const transitionTime = getSegmentTransitionTime(
    segment.activeSlide?.transition,
  );
  const isImmediateTransition = transitionType === 'immediate';

  return (
    <div className="jgis-story-editor-segment">
      <div className="jgis-story-editor-segment-header">
        <div>
          <div className="jgis-story-editor-eyebrow">
            Segment {segment.index + 1}
          </div>
          <StoryEditorInput
            value={displayTitle}
            placeholder="Enter Segment Title..."
            aria-label="Segment title"
            onChange={title => {
              onLayerNameChange(title);
            }}
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={!canRemoveSegment}
          onClick={onRemoveSegment}
        >
          <Trash2
            data-icon={isMobile ? undefined : 'inline-start'}
            className="jgis-inline-icon"
          />
          {isMobile ? null : 'Delete'}
        </Button>
      </div>

      <SegmentModePicker value={segmentMode} onChange={onContentModeChange} />

      {segmentMode === 'map' || !isTextSegmentWidthFull ? (
        <div className="jgis-story-editor-split">
          {segmentMode === 'map' ? (
            <SegmentWidthSelector
              label="Panel width"
              layout="block"
              value={segment.activeSlide?.content?.panelWidth}
              onChange={panelWidth => {
                onContentChange({ panelWidth });
              }}
              presets={MAP_PANEL_WIDTH_PRESETS}
              presetGroupAriaLabel="Map panel width presets"
            />
          ) : null}
          <SegmentPaneAlignmentPicker
            value={paneAlignment}
            onChange={alignment => {
              onContentChange({ paneAlignment: alignment });
            }}
          />
        </div>
      ) : null}

      {segmentMode === 'map' ? (
        <>
          <StoryEditorSection triggerText="Map view" defaultOpen>
            <div className="jgis-story-editor-stack jgis-story-editor-stack--tight">
              <p className="jgis-story-editor-help">
                Set the map view by panning and zooming on the map, or preview
                this segment with its layer overrides applied.
              </p>
              <div className="jgis-story-editor-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    StoryEditorSession.getInstance().enterMapViewMode(
                      segment.id,
                    );
                  }}
                >
                  Set segment viewport
                </Button>
                <Button
                  type="button"
                  className="jp-mod-styled jp-mod-accept"
                  onClick={() => {
                    StoryEditorSession.getInstance().enterPreviewMode(
                      segment.id,
                    );
                  }}
                >
                  Preview layer overrides
                </Button>
              </div>
            </div>
          </StoryEditorSection>

          <StoryEditorSection triggerText="Content" defaultOpen>
            <div className="jgis-story-editor-stack">
              <SegmentImageUrlField
                value={imageUrl}
                onChange={nextImageUrl => {
                  onContentChange({ image: nextImageUrl });
                }}
              />
              <SegmentImageCaptionField
                value={imageCaption}
                onChange={caption => onContentChange({ imageCaption: caption })}
              />
              <SegmentMarkdownEditor
                model={model}
                segmentId={segment.id}
                editorServices={editorServices}
                initialMarkdown={markdown}
                rows={4}
              />
            </div>
          </StoryEditorSection>

          <StoryEditorSection
            triggerText="Layers on this segment"
            open={layersOpen}
            onOpenChange={setLayersOpen}
          >
            <SegmentLayerOverrides
              model={model}
              state={state}
              segmentId={segment.id}
              isMobile={isMobile}
              portalContainerRef={portalContainerRef}
            />
          </StoryEditorSection>

          <StoryEditorSection
            triggerText="Animation to this segment"
            open={animationOpen}
            onOpenChange={setAnimationOpen}
          >
            <div className="jgis-story-editor-row">
              <NativeSelect
                size="sm"
                value={transitionType}
                onChange={event => {
                  onTransitionChange({
                    type: event.target.value as SegmentTransitionPatch['type'],
                  });
                }}
              >
                <NativeSelectOption value="immediate">
                  Instant
                </NativeSelectOption>
                <NativeSelectOption value="smooth">
                  Smooth pan
                </NativeSelectOption>
                <NativeSelectOption value="linear">Linear</NativeSelectOption>
              </NativeSelect>
              <div className="jgis-story-editor-slider">
                <Slider
                  min={MIN_SEGMENT_TRANSITION_TIME}
                  max={MAX_SEGMENT_TRANSITION_TIME}
                  step={SEGMENT_TRANSITION_TIME_STEP}
                  value={[transitionTime]}
                  disabled={isImmediateTransition}
                  aria-label="Transition duration"
                  style={{ maxWidth: '10rem' }}
                  onValueChange={([time]) => {
                    onTransitionChange({ time });
                  }}
                />
                <span>{formatSegmentTransitionTime(transitionTime)}</span>
              </div>
            </div>
          </StoryEditorSection>
        </>
      ) : (
        <StoryEditorSection triggerText="Content" defaultOpen>
          <SegmentMarkdownEditor
            model={model}
            segmentId={segment.id}
            editorServices={editorServices}
            initialMarkdown={markdown}
            tall
            rows={10}
          />
        </StoryEditorSection>
      )}
    </div>
  );
}

function SegmentEditorEmptyState(): JSX.Element {
  return (
    <div className="jgis-story-editor-workspace-empty">
      <p>Select a segment to edit its properties.</p>
    </div>
  );
}

export function StoryEditorDialogBody({
  model,
  commands,
  state,
  editorServices,
}: IStoryEditorDialogBodyProps): JSX.Element {
  const {
    story,
    segments,
    selectedSegmentId,
    selectedSegment,
    selectSegment,
    addSegment,
    pasteSegment,
    removeSegment,
    canRemoveSegment,
    reorderSegments,
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentLayerName,
    updateSegmentTransition,
  } = useStoryEditorSegmentList(model, commands);

  const isTextSegmentWidthFull = isMarkdownOverlayWidthFull(
    story?.overlayContentWidth,
  );

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${JGIS_NARROW_BREAKPOINT}px)`,
    );
    const update = (): void => {
      setIsMobile(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener('change', update);
    return () => {
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  const handleEditorKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (isStoryEditorTypingTarget(event.target)) {
      return;
    }

    if (isAccelKey(event, 'z', { shift: true })) {
      event.preventDefault();
      model.sharedModel.redo();
      return;
    }

    if (isAccelKey(event, 'z')) {
      event.preventDefault();
      model.sharedModel.undo();
      return;
    }

    if (isAccelKey(event, 'c')) {
      if (selectedSegmentId && copyStorySegment(model, selectedSegmentId)) {
        event.preventDefault();
      }
      return;
    }

    if (isAccelKey(event, 'd')) {
      if (
        selectedSegmentId &&
        duplicateStorySegment(model, selectedSegmentId)
      ) {
        event.preventDefault();
      }
      return;
    }

    if (isAccelKey(event, 'v')) {
      event.preventDefault();
      pasteSegment();
      return;
    }

    if (event.key === 'Delete' && canRemoveSegment) {
      event.preventDefault();
      removeSegment();
      portalContainerRef.current?.focus();
    }
  };

  return (
    <div
      ref={portalContainerRef}
      className="jgis-story-editor"
      tabIndex={-1}
      onKeyDown={handleEditorKeyDown}
    >
      <StoryEditorHeaderBar
        model={model}
        story={story}
        segmentCount={segments.length}
        isMobile={isMobile}
        onUpdateStory={updateStory}
        portalContainerRef={portalContainerRef}
      />

      <div className="jgis-story-editor-main">
        <StoryEditorSegmentList
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          isMobile={isMobile}
          onSelectSegment={selectSegment}
          onAddSegment={addSegment}
          onReorderSegments={reorderSegments}
        />

        <main className="jgis-story-editor-workspace">
          {selectedSegment ? (
            <SegmentEditor
              key={selectedSegment.id}
              model={model}
              state={state}
              segment={selectedSegment}
              editorServices={editorServices}
              portalContainerRef={portalContainerRef}
              canRemoveSegment={canRemoveSegment}
              isMobile={isMobile}
              onContentModeChange={mode => {
                updateSegmentContentMode(selectedSegment.id, mode);
              }}
              onContentChange={patch => {
                updateSegmentContent(selectedSegment.id, patch);
              }}
              onLayerNameChange={name => {
                updateSegmentLayerName(selectedSegment.id, name);
              }}
              onTransitionChange={patch => {
                updateSegmentTransition(selectedSegment.id, patch);
              }}
              onRemoveSegment={removeSegment}
              isTextSegmentWidthFull={isTextSegmentWidthFull}
            />
          ) : (
            <SegmentEditorEmptyState />
          )}
        </main>
      </div>
    </div>
  );
}
