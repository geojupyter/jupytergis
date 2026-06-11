import {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React, { useRef, useState } from 'react';

import { SegmentStopTypePicker } from '@/src/features/story/components/SegmentStopTypePicker';
import { StoryEditorHeaderBar } from '@/src/features/story/components/StoryEditorHeaderBar';
import { StoryEditorSegmentList } from '@/src/features/story/components/StoryEditorSegmentList';
import { useStoryEditorSegmentList } from '@/src/features/story/hooks/useStoryEditorSegmentList';
import type {
  IStorySegmentViewItem,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/types';
import { getSegmentDisplayMode } from '@/src/features/story/utils/listStoryScrollTrack';
import { getStorySegmentDisplayTitle } from '@/src/features/story/utils/storySegmentViewItems';
import { Button } from '@/src/shared/components/Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/shared/components/Collapsible';
import { Input } from '@/src/shared/components/Input';
import { Switch } from '@/src/shared/components/Switch';

export interface IStoryEditorDialogBodyDraftProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

const DUMMY_LAYERS = [
  { name: 'floods', visible: true, changed: true },
  { name: 'boundaries', visible: true, changed: true },
  { name: 'basemap', visible: true, changed: false },
];

function SegmentEditorPlaceholder({
  segment,
  onContentModeChange,
}: {
  segment: IStorySegmentViewItem;
  onContentModeChange: (mode: StorySegmentDisplayMode) => void;
}): JSX.Element {
  const [layersOpen, setLayersOpen] = useState(false);
  const [animationOpen, setAnimationOpen] = useState(false);
  const title = getStorySegmentDisplayTitle(segment);
  const stopType = getSegmentDisplayMode(segment.activeSlide);

  return (
    <div className="jgis-story-editor-draft-editor">
      <div className="jgis-story-editor-draft-editor-header">
        <div>
          <div className="jgis-story-editor-draft-editor-kicker">
            Segment {segment.index + 1}
          </div>
          <h3 className="jgis-story-editor-draft-editor-title">{title}</h3>
        </div>
        <Button variant="ghost" size="sm">
          ⋮
        </Button>
      </div>

      <SegmentStopTypePicker
        value={stopType}
        onChange={onContentModeChange}
      />

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
              <div className="jgis-story-editor-draft-image-placeholder">
                Hero image placeholder
              </div>
              <label className="jgis-story-editor-draft-field">
                <span>Title</span>
                <Input defaultValue={title} readOnly />
              </label>
              <div className="jgis-story-editor-draft-markdown-tabs">
                <span className="jgis-story-editor-draft-markdown-tab jgis-story-editor-draft-markdown-tab--active">
                  Write
                </span>
                <span className="jgis-story-editor-draft-markdown-tab">
                  Preview
                </span>
              </div>
              <textarea
                className="jgis-story-editor-draft-textarea"
                readOnly
                rows={4}
                defaultValue={
                  '## Rising waters\n\nIn 2019, rainfall exceeded historical norms across the basin…'
                }
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={layersOpen} onOpenChange={setLayersOpen}>
            <CollapsibleTrigger className="jgis-story-editor-draft-collapsible-trigger">
              Layers on this stop
            </CollapsibleTrigger>
            <CollapsibleContent className="jgis-story-editor-draft-collapsible-content">
              <ul className="jgis-story-editor-draft-layer-list">
                {DUMMY_LAYERS.map(layer => (
                  <li
                    key={layer.name}
                    className="jgis-story-editor-draft-layer-row"
                  >
                    <span>{layer.name}</span>
                    <Switch defaultChecked={layer.visible} disabled />
                    {layer.changed ? (
                      <span className="jgis-story-editor-draft-layer-changed">
                        changed
                      </span>
                    ) : (
                      <span className="jgis-story-editor-draft-layer-unchanged">
                        unchanged
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Button variant="link" size="sm">
                + Add style override…
              </Button>
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
            <div className="jgis-story-editor-draft-markdown-tabs">
              <span className="jgis-story-editor-draft-markdown-tab jgis-story-editor-draft-markdown-tab--active">
                Write
              </span>
              <span className="jgis-story-editor-draft-markdown-tab">
                Preview
              </span>
            </div>
            <textarea
              className="jgis-story-editor-draft-textarea jgis-story-editor-draft-textarea--tall"
              readOnly
              rows={10}
              defaultValue={
                '# Conclusion\n\nThese events highlight the need for improved early warning systems and resilient infrastructure planning.'
              }
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
              segment={selectedSegment}
              onContentModeChange={mode => {
                updateSegmentContentMode(selectedSegment.id, mode);
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
