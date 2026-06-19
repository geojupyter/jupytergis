import type { IJupyterGISModel } from '@jupytergis/schema';
import { Widget } from '@lumino/widgets';
import React from 'react';

import {
  MapPickBarActions,
  MapPreviewBarActions,
} from './components/PickBarActions';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import type { StoryEditorWidget } from './storyEditorDialog';
import type { IOverrideLayerEntry } from './types/types';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from './utils/storySegmentLayerPreview';
import { updateSegmentMapView } from './utils/storySegmentMapView';

export type StoryEditorSessionMode =
  | 'idle'
  | 'editing'
  | 'picking-map-view'
  | 'previewing-segment';

export class StoryEditorSession {
  private static instance: StoryEditorSession;

  private _dialog: StoryEditorWidget | null = null;
  private _model: IJupyterGISModel | null = null;
  private _pickingSegmentId: string | null = null;
  private _previewSegmentId: string | null = null;
  private _mode: StoryEditorSessionMode = 'idle';
  private _mapBar: StoryMapInteractionBarWidget | null = null;
  private _overrideEntries: IOverrideLayerEntry[] = [];

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

  public isPreviewingSegment(): boolean {
    return this._mode === 'previewing-segment';
  }

  public isMapInteractionMode(): boolean {
    return this.isPickingMapView() || this.isPreviewingSegment();
  }

  public enterMapPickMode(segmentId: string): void {
    if (!this._dialog || !this._model) {
      return;
    }

    this._pickingSegmentId = segmentId;
    this._mode = 'picking-map-view';
    this._focusSegmentOnMap(segmentId);
    this._dialog.minimize();
    this._showMapBar(
      'Pan and zoom the map, then apply this view to the segment.',
      React.createElement(MapPickBarActions, {
        onBack: () => {
          this.restoreEditor();
        },
        onApply: () => {
          this.applyMapView();
        },
      }),
    );
  }

  public enterPreviewMode(segmentId: string): void {
    if (!this._dialog || !this._model) {
      return;
    }

    this._previewSegmentId = segmentId;
    this._mode = 'previewing-segment';
    this._focusSegmentOnMap(segmentId);
    applySegmentLayerOverrides(this._model, segmentId, this._overrideEntries);
    this._dialog.minimize();
    this._showMapBar(
      'Previewing this segment on the map with its layer overrides.',
      React.createElement(MapPreviewBarActions, {
        onBack: () => {
          this.restoreEditor();
        },
      }),
    );
  }

  public applyMapView(): void {
    if (!this._model || !this._pickingSegmentId) {
      return;
    }

    updateSegmentMapView(this._model, this._pickingSegmentId);
    this.restoreEditor();
  }

  public restoreEditor(): void {
    if (this._mode === 'previewing-segment' && this._model) {
      clearSegmentLayerOverrideEntries(this._model, this._overrideEntries);
    }

    this._pickingSegmentId = null;
    this._previewSegmentId = null;
    this._mode = 'editing';
    this._hideMapBar();
    this._dialog?.restore();
  }

  public focusDialog(): void {
    this._dialog?.restore();
    this._dialog?.activate();
  }

  public clear(): void {
    if (this._model && this._mode === 'previewing-segment') {
      clearSegmentLayerOverrideEntries(this._model, this._overrideEntries);
    }

    this._disposeMapBar();

    this._dialog = null;
    this._model = null;
    this._pickingSegmentId = null;
    this._previewSegmentId = null;
    this._mode = 'idle';
    this._overrideEntries = [];
  }

  private _focusSegmentOnMap(segmentId: string): void {
    if (!this._model) {
      return;
    }

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
  }

  private _showMapBar(message: string, children: React.ReactNode): void {
    this._disposeMapBar();
    this._mapBar = new StoryMapInteractionBarWidget({ message, children });
    Widget.attach(this._mapBar, document.body);
    this._mapBar.show();
  }

  private _hideMapBar(): void {
    this._mapBar?.hide();
  }

  private _disposeMapBar(): void {
    if (!this._mapBar) {
      return;
    }

    this._mapBar.hide();
    this._mapBar.dispose();
    this._mapBar = null;
  }
}
