import type {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { IStateDB } from '@jupyterlab/statedb';
import { Widget } from '@lumino/widgets';
import React from 'react';

import { CommandIDs } from '@/src/constants';
import { STORY_TYPE, type JupyterGISTracker } from '@/src/types';
import { resolveMainViewContainer } from '@/src/features/story/utils/resolveMainViewContainer';
import {
  MapPreviewBarActions,
  MapViewBarActions,
} from './components/MapInteractionBarActions';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import { StoryEditorWidget } from './storyEditorDialog';
import type {
  IOverrideLayerEntry,
  StoryMapInteractionBarPlacement,
} from './types/types';
import { updateSegmentMapView } from './utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from './utils/storySegmentOverrides';

type StoryEditorMapInteractionMode =
  | 'map-view'
  | 'previewing-segment'
  | 'previewing-story';

interface IMapBarConfig {
  message: string;
  children: React.ReactNode;
  placement: StoryMapInteractionBarPlacement;
}

export class StoryEditorSession {
  private static instance: StoryEditorSession;

  private _dialog: StoryEditorWidget | null = null;
  private _model: IJupyterGISModel | null = null;
  private _commands: CommandRegistry | null = null;
  private _state: IStateDB | null = null;
  private _formSchemaRegistry: IJGISFormSchemaRegistry | null = null;
  private _mapViewSegmentId: string | null = null;
  private _mapInteractionMode: StoryEditorMapInteractionMode | null = null;
  private readonly _mapBars = new Map<
    IJupyterGISModel,
    StoryMapInteractionBarWidget
  >();
  private _overrideEntries: IOverrideLayerEntry[] = [];
  private _mainViewContainer: HTMLElement | null = null;
  private _tracker: JupyterGISTracker | null = null;
  private readonly _previewListeners = new Map<IJupyterGISModel, () => void>();

  private readonly _onTrackerCurrentChanged = (): void => {
    this._refreshBars();
  };

  private readonly _onTrackerWidgetAdded = (): void => {
    this._bindPreviewListeners();
  };

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
    mainViewContainer: HTMLElement | null,
    state: IStateDB,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    tracker: JupyterGISTracker,
  ): void {
    this._dialog = dialog;
    this._model = model;
    this._commands = commands;
    this._mainViewContainer = mainViewContainer;
    this._state = state;
    this._formSchemaRegistry = formSchemaRegistry;
    this._tracker = tracker;
    this._bindTracker();
    this._mapInteractionMode = null;
  }

  public onDialogDisposed(): void {
    this._dialog = null;
    this.closeEditorIfIdle();
  }

  public closeEditorIfIdle(): void {
    if (this.isMapInteractionMode()) {
      return;
    }

    if (this._trackerHasStoryPreview()) {
      this._dialog = null;
      this._refreshBars();
      return;
    }

    this.clear();
  }

  public isActiveFor(model: IJupyterGISModel): boolean {
    return (
      this._model === model &&
      (this._dialog !== null || this.isMapInteractionMode())
    );
  }

  public isMapViewMode(): boolean {
    return this._mapInteractionMode === 'map-view';
  }

  public isPreviewingSegment(): boolean {
    return this._mapInteractionMode === 'previewing-segment';
  }

  public isPreviewingStory(): boolean {
    return this._mapInteractionMode === 'previewing-story';
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
    this._releaseDialog();
    this._togglePanels();
    this._refreshBars();
  }

  public enterPreviewMode(segmentId: string): void {
    if (!this._dialog || !this._model) {
      return;
    }

    this._mapInteractionMode = 'previewing-segment';
    this._focusSegmentOnMap(segmentId);
    applySegmentLayerOverrides(this._model, segmentId, this._overrideEntries);
    this._releaseDialog();
    this._togglePanels();
    this._refreshBars();
  }

  public enterStoryPreviewMode(): void {
    if (!this._dialog || !this._model || !this._model.canUseStoryPreview()) {
      return;
    }

    this._clearMapInteractionState();
    this._mapInteractionMode = 'previewing-story';
    this._model.setStoryPreviewActive(true);
    this._notifyPreviewChanged();
    this._releaseDialog();
    this._refreshBars();
  }

  public applyMapView(): void {
    if (!this._model || !this._mapViewSegmentId) {
      return;
    }

    updateSegmentMapView(this._model, this._mapViewSegmentId);
    this.restoreEditor();
  }

  public restoreEditor(): void {
    const previousMode = this._mapInteractionMode;
    this._exitCurrentMapInteractionMode();
    this._mapViewSegmentId = null;
    this._mapInteractionMode = null;
    if (previousMode === 'map-view' || previousMode === 'previewing-segment') {
      this._togglePanels();
    }
    this._refreshBars();

    void this._openDialog();
  }

  public focusDialog(): void {
    if (!this._dialog) {
      void this._openDialog();
      return;
    }

    this._dialog.show();
    this._dialog.activate();
  }

  public clear(): void {
    if (this._model) {
      this._exitCurrentMapInteractionMode();
      if (this._model.isStoryPreviewActive()) {
        this._model.setStoryPreviewActive(false);
        this._notifyPreviewChanged();
      }
    }

    this._disposeAllMapBars();
    this._unbindTracker();

    this._dialog = null;
    this._model = null;
    this._commands = null;
    this._state = null;
    this._formSchemaRegistry = null;
    this._mapViewSegmentId = null;
    this._mapInteractionMode = null;
    this._overrideEntries = [];
    this._mainViewContainer = null;
    this._tracker = null;
  }

  private _bindTracker(): void {
    this._unbindTracker();
    this._tracker?.currentChanged.connect(this._onTrackerCurrentChanged);
    this._tracker?.widgetAdded.connect(this._onTrackerWidgetAdded);
    this._bindPreviewListeners();
  }

  private _unbindTracker(): void {
    this._tracker?.currentChanged.disconnect(this._onTrackerCurrentChanged);
    this._tracker?.widgetAdded.disconnect(this._onTrackerWidgetAdded);
    this._unbindPreviewListeners();
  }

  private _bindPreviewListeners(): void {
    if (!this._tracker) {
      return;
    }

    this._tracker.forEach(widget => {
      const model = widget.model;
      if (!model || this._previewListeners.has(model)) {
        return;
      }

      const handler = (): void => {
        this._refreshBars();
      };
      model.storyPreviewActiveChanged.connect(handler);
      this._previewListeners.set(model, handler);
    });
  }

  private _unbindPreviewListeners(): void {
    for (const [model, handler] of this._previewListeners) {
      model.storyPreviewActiveChanged.disconnect(handler);
    }
    this._previewListeners.clear();
  }

  private _refreshBars(): void {
    for (const model of [...this._mapBars.keys()]) {
      if (!this._modelNeedsBar(model)) {
        this._disposeBarForModel(model);
      }
    }

    const modelsToEnsure = new Set<IJupyterGISModel>();
    const currentModel = this._tracker?.currentWidget?.model ?? null;
    if (currentModel && this._modelNeedsBar(currentModel)) {
      modelsToEnsure.add(currentModel);
    }

    this._tracker?.forEach(widget => {
      const model = widget.model;
      if (model && this._modelNeedsBar(model)) {
        modelsToEnsure.add(model);
      }
    });

    for (const model of modelsToEnsure) {
      this._ensureBarForModel(model);
    }

    this._syncBarVisibility();
  }

  private _syncBarVisibility(): void {
    const currentModel = this._tracker?.currentWidget?.model ?? null;

    for (const [model, bar] of this._mapBars) {
      if (model === currentModel && this._modelNeedsBar(model)) {
        bar.show();
      } else {
        bar.hide();
      }
    }
  }

  private _modelNeedsBar(model: IJupyterGISModel): boolean {
    if (model.isStoryPreviewActive()) {
      return true;
    }

    return model === this._model && this.isMapInteractionMode();
  }

  private _ensureBarForModel(model: IJupyterGISModel, retry = 0): void {
    const config = this._getBarConfigForModel(model);
    if (!config) {
      this._disposeBarForModel(model);
      return;
    }

    if (this._mapBars.has(model)) {
      return;
    }

    const bar = new StoryMapInteractionBarWidget(config);
    const parent = this._resolveMapBarParentForModel(model);
    if (!parent) {
      if (retry < 10) {
        requestAnimationFrame(() => {
          this._ensureBarForModel(model, retry + 1);
        });
      }
      return;
    }

    Widget.attach(bar, parent);
    this._mapBars.set(model, bar);
  }

  private _getBarConfigForModel(model: IJupyterGISModel): IMapBarConfig | null {
    if (model.isStoryPreviewActive()) {
      return {
        message: this._getStoryPreviewBarMessageForModel(model),
        children: React.createElement(MapPreviewBarActions, {
          onBack: () => {
            this._exitStoryPreviewForModel(model);
          },
        }),
        placement: this._getStoryPreviewBarPlacementForModel(model),
      };
    }

    if (model !== this._model || !this.isMapInteractionMode()) {
      return null;
    }

    switch (this._mapInteractionMode) {
      case 'map-view':
        return {
          message:
            'Pan and zoom the map, then apply this view to the segment.',
          children: React.createElement(MapViewBarActions, {
            onBack: () => {
              this.restoreEditor();
            },
            onApply: () => {
              this.applyMapView();
            },
          }),
          placement: 'overlay-bottom',
        };
      case 'previewing-segment':
        return {
          message:
            'Previewing this segment on the map with its layer overrides.',
          children: React.createElement(MapPreviewBarActions, {
            onBack: () => {
              this.restoreEditor();
            },
          }),
          placement: 'overlay-bottom',
        };
      case 'previewing-story':
        return null;
      default:
        return null;
    }
  }

  private _exitStoryPreviewForModel(model: IJupyterGISModel): void {
    if (model === this._model && this.isMapInteractionMode()) {
      this.restoreEditor();
      return;
    }

    if (model.isStoryPreviewActive()) {
      model.setStoryPreviewActive(false);
      this._notifyPreviewChanged();
    }

    this._disposeBarForModel(model);
    this._syncBarVisibility();
    this._syncSessionToModel(model);
    void this._openDialog();
  }

  private _syncSessionToModel(model: IJupyterGISModel): void {
    this._model = model;
    if (this._tracker) {
      this._mainViewContainer =
        resolveMainViewContainer(this._tracker, model) ??
        this._mainViewContainer;
    }
  }

  private _someTrackedModel(
    predicate: (model: IJupyterGISModel) => boolean,
  ): boolean {
    if (!this._tracker) {
      return false;
    }

    let found = false;
    this._tracker.forEach(widget => {
      const model = widget.model;
      if (!found && model && predicate(model)) {
        found = true;
      }
    });

    return found;
  }

  private _trackerHasStoryPreview(): boolean {
    return this._someTrackedModel(model => model.isStoryPreviewActive());
  }

  private _getStoryPreviewBarPlacementForModel(
    model: IJupyterGISModel,
  ): StoryMapInteractionBarPlacement {
    const storyType = model.getSelectedStory().story?.storyType;
    if (storyType === STORY_TYPE.guided) {
      return 'main-top-left';
    }

    return 'overlay-bottom';
  }

  private _getStoryPreviewBarMessageForModel(model: IJupyterGISModel): string {
    const title = model.getSelectedStory().story?.title?.trim();
    if (title) {
      return `Previewing "${title}".`;
    }

    return 'Previewing the story.';
  }

  private _resolveMapBarParentForModel(
    model: IJupyterGISModel,
  ): HTMLElement | null {
    if (!this._tracker) {
      return this._mainViewContainer;
    }

    return (
      resolveMainViewContainer(this._tracker, model) ?? this._mainViewContainer
    );
  }

  private _disposeBarForModel(model: IJupyterGISModel): void {
    const bar = this._mapBars.get(model);
    if (!bar) {
      return;
    }

    bar.hide();
    bar.dispose();
    this._mapBars.delete(model);
  }

  private _disposeAllMapBars(): void {
    for (const model of [...this._mapBars.keys()]) {
      this._disposeBarForModel(model);
    }
  }

  private async _openDialog(): Promise<void> {
    if (
      !this._model ||
      !this._commands ||
      !this._state ||
      !this._formSchemaRegistry
    ) {
      return;
    }

    if (this._dialog) {
      this._releaseDialog();
    }

    const dialog = new StoryEditorWidget({
      model: this._model,
      commands: this._commands,
      state: this._state,
      formSchemaRegistry: this._formSchemaRegistry,
    });
    this._dialog = dialog;

    try {
      await dialog.launch();
    } finally {
      this.closeEditorIfIdle();
    }
  }

  private _releaseDialog(): void {
    if (!this._dialog) {
      return;
    }

    const dialog = this._dialog;
    this._dialog = null;
    dialog.reject();
  }

  private _exitCurrentMapInteractionMode(): void {
    if (!this._model) {
      return;
    }

    switch (this._mapInteractionMode) {
      case 'previewing-segment':
        clearSegmentLayerOverrideEntries(this._model, this._overrideEntries);
        break;
      case 'previewing-story':
        this._model.setStoryPreviewActive(false);
        this._notifyPreviewChanged();
        break;
      case 'map-view':
      case null:
        break;
    }
  }

  private _clearMapInteractionState(): void {
    this._exitCurrentMapInteractionMode();
    this._mapViewSegmentId = null;
    this._mapInteractionMode = null;
    if (this._model) {
      this._disposeBarForModel(this._model);
    }
  }

  private _notifyPreviewChanged(): void {
    this._commands?.notifyCommandChanged(CommandIDs.openStoryEditor);
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
}
