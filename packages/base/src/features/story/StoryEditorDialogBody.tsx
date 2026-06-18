import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { SegmentImageUrlField } from '@/src/features/story/components/SegmentImageUrlField';
import { SegmentLayerOverrides } from '@/src/features/story/components/SegmentLayerOverrides';
import { SegmentMarkdownEditor } from '@/src/features/story/components/SegmentMarkdownEditor';
import { SegmentStopTypePicker } from '@/src/features/story/components/SegmentStopTypePicker';
import { StoryEditorHeaderBar } from '@/src/features/story/components/StoryEditorHeaderBar';
import StoryEditorSection from '@/src/features/story/components/StoryEditorSection';
import { StoryEditorSegmentList } from '@/src/features/story/components/StoryEditorSegmentList';
import { useStoryEditorSegmentList } from '@/src/features/story/hooks/useStoryEditorSegmentList';
import { StoryEditorSession } from '@/src/features/story/storyEditorSession';
import type {
  IStorySegmentViewItem,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/types';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import type { SegmentContentPatch } from '@/src/features/story/utils/storySegmentContent';
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
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import { Slider } from '@/src/shared/components/Slider';
import { STORY_TYPE } from '@/src/types';

export interface IStoryEditorDialogBodyProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

function SegmentEditor({
  model,
  state,
  segment,
  portalContainerRef,
  canRemoveSegment,
  showSegmentAnimation,
  onContentModeChange,
  onContentChange,
  onTransitionChange,
  onRemoveSegment,
}: {
  model: IJupyterGISModel;
  state: IStateDB;
  segment: IStorySegmentViewItem;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  canRemoveSegment: boolean;
  showSegmentAnimation: boolean;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
  onContentChange: (patch: SegmentContentPatch) => void;
  onTransitionChange: (patch: SegmentTransitionPatch) => void;
  onRemoveSegment: () => void;
}): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(true);
  const [animationOpen, setAnimationOpen] = useState(false);
  const displayTitle = getStorySegmentDisplayTitle(segment);
  const contentTitle = segment.activeSlide?.content?.title ?? '';
  const imageUrl = segment.activeSlide?.content?.image ?? '';
  const markdown = getStoryMarkdownFromSlide(segment.activeSlide);
  const stopType = getSegmentDisplayMode(segment.activeSlide);
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
          <h3 className="jgis-story-editor-segment-title">{displayTitle}</h3>
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={!canRemoveSegment}
          onClick={onRemoveSegment}
        >
          <Trash2 data-icon="inline-start" className="jgis-inline-icon" />{' '}
          Delete
        </Button>
      </div>

      <SegmentStopTypePicker value={stopType} onChange={onContentModeChange} />

      {stopType === 'map' ? (
        <>
          <StoryEditorSection triggerText="Map view" defaultOpen>
            <div className="jgis-story-editor-stack jgis-story-editor-stack--tight">
              <p className="jgis-story-editor-help">
                Set the map view by panning and zooming on the map, or preview
                this stop with its layer overrides applied.
              </p>
              <div className="jgis-story-editor-row">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    StoryEditorSession.getInstance().enterMapPickMode(
                      segment.id,
                    );
                  }}
                >
                  Set map view on map
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
                  Preview layer overrides on map
                </Button>
              </div>
            </div>
          </StoryEditorSection>

          <StoryEditorSection triggerText="Content" defaultOpen>
            <div className="jgis-story-editor-stack">
              <label className="jgis-story-editor-field">
                <span>Title</span>
                <Input
                  value={contentTitle}
                  onChange={event => {
                    onContentChange({ title: event.target.value });
                  }}
                />
              </label>
              <SegmentImageUrlField
                value={imageUrl}
                onChange={nextImageUrl => {
                  onContentChange({ image: nextImageUrl });
                }}
              />
              <SegmentMarkdownEditor
                value={markdown}
                onChange={nextMarkdown => {
                  onContentChange({ markdown: nextMarkdown });
                }}
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
              portalContainerRef={portalContainerRef}
            />
          </StoryEditorSection>

          {showSegmentAnimation ? (
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
                      type: event.target
                        .value as SegmentTransitionPatch['type'],
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
            </StoryEditorSection>
          ) : null}
        </>
      ) : (
        <StoryEditorSection triggerText="Content" defaultOpen>
          <SegmentMarkdownEditor
            value={markdown}
            onChange={nextMarkdown => {
              onContentChange({ markdown: nextMarkdown });
            }}
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
}: IStoryEditorDialogBodyProps): JSX.Element {
  const {
    story,
    segments,
    selectedSegmentId,
    selectedSegment,
    selectSegment,
    addSegment,
    removeSegment,
    canRemoveSegment,
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentTransition,
  } = useStoryEditorSegmentList(model, commands);

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const showSegmentAnimation = story?.storyType !== STORY_TYPE.verticalScroll;

  return (
    <div ref={portalContainerRef} className="jgis-story-editor">
      <StoryEditorHeaderBar
        story={story}
        segmentCount={segments.length}
        onUpdateStory={updateStory}
        portalContainerRef={portalContainerRef}
      />

      <div className="jgis-story-editor-main">
        <StoryEditorSegmentList
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={selectSegment}
          onAddSegment={addSegment}
        />

        <main className="jgis-story-editor-workspace">
          {selectedSegment ? (
            <SegmentEditor
              key={selectedSegment.id}
              model={model}
              state={state}
              segment={selectedSegment}
              portalContainerRef={portalContainerRef}
              canRemoveSegment={canRemoveSegment}
              showSegmentAnimation={showSegmentAnimation}
              onContentModeChange={mode => {
                updateSegmentContentMode(selectedSegment.id, mode);
              }}
              onContentChange={patch => {
                updateSegmentContent(selectedSegment.id, patch);
              }}
              onTransitionChange={patch => {
                updateSegmentTransition(selectedSegment.id, patch);
              }}
              onRemoveSegment={() => {
                removeSegment(selectedSegment.id);
              }}
            />
          ) : (
            <SegmentEditorEmptyState />
          )}
        </main>
      </div>
    </div>
  );
}
