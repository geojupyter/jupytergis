import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { SegmentImageUrlField } from '@/src/features/story/components/SegmentImageUrlField';
import { SegmentLayerOverrides } from '@/src/features/story/components/SegmentLayerOverrides';
import { SegmentMarkdownEditor } from '@/src/features/story/components/SegmentMarkdownEditor';
import { SegmentModePicker } from '@/src/features/story/components/SegmentModePicker';
import { StoryEditorHeaderBar } from '@/src/features/story/components/StoryEditorHeaderBar';
import { StoryEditorSection } from '@/src/features/story/components/StoryEditorSection';
import { StoryEditorSegmentList } from '@/src/features/story/components/StoryEditorSegmentList';
import { TitleInput } from '@/src/features/story/components/TitleInput';
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
  editorServices: IEditorServices;
}

function SegmentEditor({
  model,
  state,
  segment,
  editorServices,
  portalContainerRef,
  canRemoveSegment,
  showSegmentAnimation,
  onContentModeChange,
  onContentChange,
  onLayerNameChange,
  onTransitionChange,
  onRemoveSegment,
}: {
  model: IJupyterGISModel;
  state: IStateDB;
  segment: IStorySegmentViewItem;
  editorServices: IEditorServices;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  canRemoveSegment: boolean;
  showSegmentAnimation: boolean;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
  onContentChange: (patch: SegmentContentPatch) => void;
  onLayerNameChange: (name: string) => void;
  onTransitionChange: (patch: SegmentTransitionPatch) => void;
  onRemoveSegment: () => void;
}): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(true);
  const [animationOpen, setAnimationOpen] = useState(false);
  const displayTitle = getStorySegmentDisplayTitle(segment);
  const imageUrl = segment.activeSlide?.content?.image ?? '';
  const markdown = getStoryMarkdownFromSlide(segment.activeSlide);
  const segmentMode = getSegmentDisplayMode(segment.activeSlide);
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
          <TitleInput
            value={displayTitle}
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
          <Trash2 data-icon="inline-start" className="jgis-inline-icon" />{' '}
          Delete
        </Button>
      </div>

      <SegmentModePicker value={segmentMode} onChange={onContentModeChange} />

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
    removeSegment,
    canRemoveSegment,
    reorderSegments,
    updateStory,
    updateSegmentContentMode,
    updateSegmentContent,
    updateSegmentLayerName,
    updateSegmentTransition,
  } = useStoryEditorSegmentList(model, commands);

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const showSegmentAnimation = story?.storyType !== STORY_TYPE.verticalScroll;

  return (
    <div ref={portalContainerRef} className="jgis-story-editor">
      <StoryEditorHeaderBar
        model={model}
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
              showSegmentAnimation={showSegmentAnimation}
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
            />
          ) : (
            <SegmentEditorEmptyState />
          )}
        </main>
      </div>
    </div>
  );
}
