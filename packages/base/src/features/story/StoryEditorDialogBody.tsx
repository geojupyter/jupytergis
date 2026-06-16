import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
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
import {
  getStoryMarkdownFromSlide,
  getStorySegmentDisplayTitle,
} from '@/src/features/story/utils/storySegmentViewItems';
import type { SegmentContentPatch } from '@/src/features/story/utils/storySegmentContent';
import {
  formatSegmentTransitionTime,
  getSegmentTransitionTime,
  MAX_SEGMENT_TRANSITION_TIME,
  MIN_SEGMENT_TRANSITION_TIME,
  SEGMENT_TRANSITION_TIME_STEP,
  type SegmentTransitionPatch,
} from '@/src/features/story/utils/storySegmentTransition';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

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
  onContentModeChange,
  onContentChange,
  onTransitionChange,
}: {
  model: IJupyterGISModel;
  state: IStateDB;
  segment: IStorySegmentViewItem;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
  onContentChange: (patch: SegmentContentPatch) => void;
  onTransitionChange: (patch: SegmentTransitionPatch) => void;
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
          <div className="jgis-story-editor-segment-kicker">
            Segment {segment.index + 1}
          </div>
          <h3 className="jgis-story-editor-segment-title">{displayTitle}</h3>
        </div>
      </div>

      <SegmentStopTypePicker value={stopType} onChange={onContentModeChange} />

      {stopType === 'map' ? (
        <>
          <StoryEditorSection triggerText="Map view" defaultOpen>
            <div className="jgis-story-editor-map-view-row">
              <p className="jgis-story-editor-map-view-help">
                Set this stop&apos;s map view by positioning the main map.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  StoryEditorSession.getInstance().enterMapPickMode(segment.id);
                }}
              >
                Set map view on map
              </Button>
            </div>
          </StoryEditorSection>

          <StoryEditorSection triggerText="Content" defaultOpen>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
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
            triggerText="Layers on this stop"
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

          <StoryEditorSection
            triggerText="Animation to this stop"
            open={animationOpen}
            onOpenChange={setAnimationOpen}
          >
            <div className="jgis-story-editor-animation-row">
              <NativeSelect size="sm" defaultValue="smooth">
                <NativeSelectOption value="immediate">
                  Instant
                </NativeSelectOption>
                <NativeSelectOption value="smooth">
                  Smooth pan
                </NativeSelectOption>
                <NativeSelectOption value="linear">Linear</NativeSelectOption>
              </NativeSelect>
              <Input
                type="range"
                min={MIN_SEGMENT_TRANSITION_TIME}
                max={MAX_SEGMENT_TRANSITION_TIME}
                step={SEGMENT_TRANSITION_TIME_STEP}
                value={transitionTime}
                disabled={isImmediateTransition}
                aria-label="Transition duration"
                onChange={event => {
                  onTransitionChange({
                    time: Number(event.target.value),
                  });
                }}
              />
              <span>{formatSegmentTransitionTime(transitionTime)}</span>
            </div>
          </StoryEditorSection>
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

      <div className="jgis-story-editor-preview">
        <div className="jgis-story-editor-preview-label">
          Presentation preview
        </div>
        <div className="jgis-story-editor-preview-frame">
          <div className="jgis-story-editor-preview-chrome">
            <span>desktop</span>
            <span>mobile</span>
          </div>
          <div className="jgis-story-editor-preview-body">
            How this stop looks in Specta
          </div>
        </div>
      </div>
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
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentTransition,
  } = useStoryEditorSegmentList(model, commands);

  const portalContainerRef = useRef<HTMLDivElement>(null);

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
              onContentModeChange={mode => {
                updateSegmentContentMode(selectedSegment.id, mode);
              }}
              onContentChange={patch => {
                updateSegmentContent(selectedSegment.id, patch);
              }}
              onTransitionChange={patch => {
                updateSegmentTransition(selectedSegment.id, patch);
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
