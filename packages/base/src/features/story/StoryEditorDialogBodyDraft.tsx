import { IJGISFormSchemaRegistry, IJupyterGISModel } from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React, { useRef, useState } from 'react';

import { SegmentImageUrlField } from '@/src/features/story/components/SegmentImageUrlField';
import { SegmentLayerOverrides } from '@/src/features/story/components/SegmentLayerOverrides';
import { SegmentMarkdownEditor } from '@/src/features/story/components/SegmentMarkdownEditor';
import { SegmentStopTypePicker } from '@/src/features/story/components/SegmentStopTypePicker';
import { StoryEditorHeaderBar } from '@/src/features/story/components/StoryEditorHeaderBar';
import { StoryEditorSegmentList } from '@/src/features/story/components/StoryEditorSegmentList';
import { useStoryEditorSegmentList } from '@/src/features/story/hooks/useStoryEditorSegmentList';
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
import { Button } from '@/src/shared/components/Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/shared/components/Collapsible';
import { Input } from '@/src/shared/components/Input';

export interface IStoryEditorDialogBodyDraftProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

function SegmentEditorPlaceholder({
  model,
  state,
  segment,
  portalContainerRef,
  onContentModeChange,
  onContentChange,
}: {
  model: IJupyterGISModel;
  state: IStateDB;
  segment: IStorySegmentViewItem;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
  onContentChange: (patch: SegmentContentPatch) => void;
}): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(false);
  const [animationOpen, setAnimationOpen] = useState(false);
  const displayTitle = getStorySegmentDisplayTitle(segment);
  const contentTitle = segment.activeSlide?.content?.title ?? '';
  const imageUrl = segment.activeSlide?.content?.image ?? '';
  const markdown = getStoryMarkdownFromSlide(segment.activeSlide);
  const stopType = getSegmentDisplayMode(segment.activeSlide);

  return (
    <div className="jgis-story-editor-draft-editor">
      <div className="jgis-story-editor-draft-editor-header">
        <div>
          <div className="jgis-story-editor-draft-editor-kicker">
            Segment {segment.index + 1}
          </div>
          <h3 className="jgis-story-editor-draft-editor-title">
            {displayTitle}
          </h3>
        </div>
        <Button variant="ghost" size="sm">
          ⋮
        </Button>
      </div>

      <SegmentStopTypePicker value={stopType} onChange={onContentModeChange} />

      {stopType === 'map' ? (
        <>
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
              Map view
            </CollapsibleTrigger>
            <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
              <div className="jgis-story-editor-draft-map-view-row">
                <div
                  className="jgis-story-editor-draft-map-thumb"
                  aria-hidden
                />
                <div className="jgis-story-editor-draft-map-view-actions">
                  <Button variant="outline" size="sm">
                    Use current map view
                  </Button>
                  <Button variant="ghost" size="sm">
                    Preview on main map
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
              Content
            </CollapsibleTrigger>
            <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
              <label className="jgis-story-editor-draft-field">
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
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={layersOpen} onOpenChange={setLayersOpen}>
            <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
              Layers on this stop
            </CollapsibleTrigger>
            <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
              <SegmentLayerOverrides
                model={model}
                state={state}
                segmentId={segment.id}
                portalContainerRef={portalContainerRef}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={animationOpen} onOpenChange={setAnimationOpen}>
            <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
              Animation to this stop
            </CollapsibleTrigger>
            <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
              <div className="jgis-story-editor-draft-animation-row">
                <select
                  className="jgis-story-editor-draft-select"
                  defaultValue="smooth"
                  disabled
                >
                  <option value="immediate">Instant</option>
                  <option value="smooth">Smooth pan</option>
                  <option value="linear">Linear</option>
                </select>
                <Input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  defaultValue={1}
                  disabled
                />
                <span>1.0s</span>
                <Button variant="outline" size="sm">
                  Play
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
            Content
          </CollapsibleTrigger>
          <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
            <SegmentMarkdownEditor
              value={markdown}
              onChange={nextMarkdown => {
                onContentChange({ markdown: nextMarkdown });
              }}
              tall
              rows={10}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="jgis-story-editor-draft-preview">
        <div className="jgis-story-editor-draft-preview-label">
          Presentation preview
        </div>
        <div className="jgis-story-editor-draft-preview-frame">
          <div className="jgis-story-editor-draft-preview-chrome">
            <span>desktop</span>
            <span>mobile</span>
          </div>
          <div className="jgis-story-editor-draft-preview-body">
            Preview placeholder — how this stop looks in Specta
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentEditorEmptyState(): JSX.Element {
  return (
    <div className="jgis-story-editor-draft-workspace-empty">
      <p>Select a segment to edit its properties.</p>
    </div>
  );
}

export function StoryEditorDialogBodyDraft({
  model,
  commands,
  state,
}: IStoryEditorDialogBodyDraftProps): JSX.Element {
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
  } = useStoryEditorSegmentList(model, commands);

  const portalContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={portalContainerRef} className="jgis-story-editor-draft">
      <StoryEditorHeaderBar
        story={story}
        segmentCount={segments.length}
        onUpdateStory={updateStory}
        portalContainerRef={portalContainerRef}
      />

      <div className="jgis-story-editor-draft-main">
        <StoryEditorSegmentList
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={selectSegment}
          onAddSegment={addSegment}
        />

        <main className="jgis-story-editor-draft-workspace">
          {selectedSegment ? (
            <SegmentEditorPlaceholder
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
            />
          ) : (
            <SegmentEditorEmptyState />
          )}
        </main>
      </div>
    </div>
  );
}
