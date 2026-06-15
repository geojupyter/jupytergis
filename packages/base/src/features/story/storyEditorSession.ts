import type { IJupyterGISModel } from '@jupytergis/schema';
import { Widget } from '@lumino/widgets';

import { StoryMapPickBarWidget } from './components/StoryMapPickBarWidget';
import type { StoryEditorWidget } from './storyEditorDialog';
import { updateSegmentMapView } from './utils/storySegmentMapView';

export type StoryEditorSessionMode = 'idle' | 'editing' | 'picking-map-view';

export class StoryEditorSession {
  private static instance: StoryEditorSession;

  private _dialog: StoryEditorWidget | null = null;
  private _model: IJupyterGISModel | null = null;
  private _pickingSegmentId: string | null = null;
  private _mode: StoryEditorSessionMode = 'idle';
  private _pickBar: StoryMapPickBarWidget | null = null;

  public static getInstance(): StoryEditorSession {
    if (!StoryEditorSession.instance) {
      StoryEditorSession.instance = new StoryEditorSession();
    }
    return StoryEditorSession.instance;
  }

  public attachDialog(
    dialog: StoryEditorWidget,
    model: IJupyterGISModel,
  ): void {
    this._dialog = dialog;
    this._model = model;
    this._mode = 'editing';
  }

  public isActiveFor(model: IJupyterGISModel): boolean {
    return this._dialog !== null && this._model === model;
  }

  public isPickingMapView(): boolean {
    return this._mode === 'picking-map-view';
  }

  public enterMapPickMode(segmentId: string): void {
    if (!this._dialog || !this._model) {
      return;
    }

    this._pickingSegmentId = segmentId;
    this._mode = 'picking-map-view';

    this._model.syncSelected(
      { [segmentId]: { type: 'layer' } },
      this._model.getClientId().toString(),
    );

    const segmentIndex =
      this._model.getSelectedStory().story?.storySegments?.indexOf(segmentId) ??
      -1;
    if (segmentIndex >= 0) {
      this._model.setCurrentSegmentIndex(segmentIndex);
    }

    this._model.centerOnPosition(segmentId);
    this._dialog.minimize();
    this._showPickBar();
  }

  public applyMapView(): void {
    if (!this._model || !this._pickingSegmentId) {
      return;
    }

    updateSegmentMapView(this._model, this._pickingSegmentId);
    this.restoreEditor();
  }

  public restoreEditor(): void {
    this._pickingSegmentId = null;
    this._mode = 'editing';
    this._hidePickBar();
    this._dialog?.restore();
  }

  public focusDialog(): void {
    this._dialog?.restore();
    this._dialog?.activate();
  }

  public clear(): void {
    if (this._pickBar) {
      this._pickBar.hide();
      this._pickBar.dispose();
      this._pickBar = null;
    }
    this._dialog = null;
    this._model = null;
    this._pickingSegmentId = null;
    this._mode = 'idle';
  }

  private _showPickBar(): void {
    if (!this._pickBar) {
      this._pickBar = new StoryMapPickBarWidget({
        onApply: () => {
          this.applyMapView();
        },
        onBack: () => {
          this.restoreEditor();
        },
      });
      Widget.attach(this._pickBar, document.body);
    }

    this._pickBar.show();
  }

  private _hidePickBar(): void {
    if (!this._pickBar) {
      return;
    }

    this._pickBar.hide();
  }
}
