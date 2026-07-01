import type { IJupyterGISDoc, IJupyterGISModel } from '@jupytergis/schema';
import type { IYText, SourceChange } from '@jupyter/ydoc';
import { Signal } from '@lumino/signaling';
// import * as Y from 'yjs';
import { Text, YTextEvent } from 'yjs';

import { debounce } from '@/src/tools';

import { updateSegmentContent } from './storySegmentContent';

const STORY_SEGMENT_MARKDOWN_PREFIX = 'storySegmentMarkdown:';
const PARAMETER_SYNC_DEBOUNCE_MS = 300;

function storySegmentMarkdownKey(segmentId: string): string {
  return `${STORY_SEGMENT_MARKDOWN_PREFIX}${segmentId}`;
}

/**
 * IYText view over a segment markdown field stored on the JupyterGIS Y.Doc.
 */
export class StorySegmentMarkdownSharedModel implements IYText {
  readonly ysource: Text;
  readonly awareness: IJupyterGISDoc['awareness'];
  readonly undoManager: IJupyterGISDoc['undoManager'];

  private readonly _doc: IJupyterGISDoc;
  private readonly _changed = new Signal<this, SourceChange>(this);
  private readonly _disposed = new Signal<this, void>(this);
  private _isDisposed = false;

  constructor(doc: IJupyterGISDoc, segmentId: string, initialMarkdown = '') {
    this._doc = doc;
    this.ysource = doc.ydoc.getText(storySegmentMarkdownKey(segmentId));
    this.awareness = doc.awareness;
    this.undoManager = doc.undoManager;
    doc.undoManager.addToScope(this.ysource);

    if (this.ysource.length === 0 && initialMarkdown) {
      doc.transact(() => {
        this.ysource.insert(0, initialMarkdown);
      });
    }

    this.ysource.observe(this._onYTextChange);
  }

  get changed(): Signal<this, SourceChange> {
    return this._changed;
  }

  get disposed(): Signal<this, void> {
    return this._disposed;
  }

  get source(): string {
    return this.getSource();
  }

  set source(value: string) {
    this.setSource(value);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  getSource(): string {
    return this.ysource.toString();
  }

  setSource(value: string): void {
    this.transact(() => {
      this.ysource.delete(0, this.ysource.length);
      this.ysource.insert(0, value);
    });
  }

  updateSource(start: number, end: number, value = ''): void {
    this.transact(() => {
      this.ysource.insert(start, value);
      this.ysource.delete(start + value.length, end - start);
    });
  }

  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    this._doc.undo();

    return true;
  }

  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this._doc.redo();

    return true;
  }

  canUndo(): boolean {
    return this._doc.canUndo();
  }

  canRedo(): boolean {
    return this._doc.canRedo();
  }

  clearUndoHistory(): void {
    this._doc.clearUndoHistory();
  }

  transact(callback: () => void, undoable = true, origin?: unknown): void {
    this._doc.transact(callback, undoable, origin);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this.ysource.unobserve(this._onYTextChange);
    this._disposed.emit(undefined);
    Signal.clearData(this);
  }

  private _onYTextChange = (event: YTextEvent): void => {
    this._changed.emit({
      sourceChange: event.changes.delta as SourceChange['sourceChange'],
    });
  };
}

const sharedModels = new WeakMap<
  IJupyterGISModel,
  Map<string, StorySegmentMarkdownSharedModel>
>();
const parameterSync = new WeakMap<IJupyterGISModel, Set<string>>();

function ensureParameterSync(
  model: IJupyterGISModel,
  segmentId: string,
  shared: StorySegmentMarkdownSharedModel,
): void {
  let synced = parameterSync.get(model);
  if (!synced) {
    synced = new Set();
    parameterSync.set(model, synced);
  }

  if (synced.has(segmentId)) {
    return;
  }
  synced.add(segmentId);

  const debouncedSync = debounce(() => {
    updateSegmentContent(model, segmentId, {
      markdown: shared.getSource(),
    });
  }, PARAMETER_SYNC_DEBOUNCE_MS);

  shared.changed.connect(() => {
    debouncedSync();
  });
}

export function getStorySegmentMarkdownSharedModel(
  model: IJupyterGISModel,
  segmentId: string,
  initialMarkdown = '',
): StorySegmentMarkdownSharedModel {
  let perModel = sharedModels.get(model);
  if (!perModel) {
    perModel = new Map();
    sharedModels.set(model, perModel);
  }

  let shared = perModel.get(segmentId);
  if (!shared || shared.isDisposed) {
    shared = new StorySegmentMarkdownSharedModel(
      model.sharedModel,
      segmentId,
      initialMarkdown,
    );
    perModel.set(segmentId, shared);
    ensureParameterSync(model, segmentId, shared);
  } else if (shared.getSource().length === 0 && initialMarkdown) {
    shared.setSource(initialMarkdown);
  }

  return shared;
}
