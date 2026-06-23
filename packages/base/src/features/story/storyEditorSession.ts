import type { IJupyterGISModel } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { Widget } from '@lumino/widgets';
import React from 'react';

import { CommandIDs } from '@/src/constants';
import {
  MapPreviewBarActions,
  MapViewBarActions,
} from './components/MapInteractionBarActions';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import type { StoryEditorWidget } from './storyEditorDialog';
import type { IOverrideLayerEntry } from './types/types';
import { updateSegmentMapView } from './utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from './utils/storySegmentOverrides';

type StoryEditorMapInteractionMode = 'map-view' | 'previewing-segment';

export class StoryEditorSession {
  private static instance: StoryEditorSession;

  private _dialog: StoryEditorWidget | null = null;
  private _model: IJupyterGISModel | null = null;
  private _commands: CommandRegistry | null = null;
  private _mapViewSegmentId: string | null = null;
  private _mapInteractionMode: StoryEditorMapInteractionMode | null = null;
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
    commands: CommandRegistry,
  ): void {
    this._dialog = dialog;
    this._model = model;
    this._commands = commands;
    this._mapInteractionMode = null;
  }

  public isActiveFor(model: IJupyterGISModel): boolean {
    return this._dialog !== null && this._model === model;
  }

  public isMapViewMode(): boolean {
    return this._mapInteractionMode === 'map-view';
  }

  public isPreviewingSegment(): boolean {
    return this._mapInteractionMode === 'previewing-segment';
  }

  public isMapInteractionMode(): boolean {
    return this._mapInteractionMode !== null;
  }

  public enterMapViewMode(segmentId: string): void {
    if (!this._dialog || !this._model) {
      return;
    }

    this._mapViewSegmentId = segmentId;
    this._mapInteractionMode = 'map-view';
    this._focusSegmentOnMap(segmentId);
    this._dialog.minimize();
    this._togglePanels();
    this._showMapBar(
      'Pan and zoom the map, then apply this view to the segment.',
      React.createElement(MapViewBarActions, {
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

    this._mapInteractionMode = 'previewing-segment';
    this._focusSegmentOnMap(segmentId);
    applySegmentLayerOverrides(this._model, segmentId, this._overrideEntries);
    this._dialog.minimize();
    this._togglePanels();
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
    if (!this._model || !this._mapViewSegmentId) {
      return;
    }

    updateSegmentMapView(this._model, this._mapViewSegmentId);
    this.restoreEditor();
  }

  public restoreEditor(): void {
    if (this.isPreviewingSegment() && this._model) {
      clearSegmentLayerOverrideEntries(this._model, this._overrideEntries);
    }

    this._mapViewSegmentId = null;
    this._mapInteractionMode = null;
    this._togglePanels();
    this._hideMapBar();
    this._dialog?.restore();
  }

  public focusDialog(): void {
    this._dialog?.restore();
    this._dialog?.activate();
  }

  public clear(): void {
    if (this.isPreviewingSegment() && this._model) {
      clearSegmentLayerOverrideEntries(this._model, this._overrideEntries);
    }

    this._disposeMapBar();

    this._dialog = null;
    this._model = null;
    this._commands = null;
    this._mapViewSegmentId = null;
    this._mapInteractionMode = null;
    this._overrideEntries = [];
  }

  private _focusSegmentOnMap(segmentId: string): void {
    this._model?.centerOnPosition(segmentId);
  }

  private _togglePanels(): void {
    if (!this._commands) {
      return;
    }

    void this._commands.execute(CommandIDs.togglePanel);
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
