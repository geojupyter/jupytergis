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

type ModelEditorInteractionMode = 'map-view' | 'previewing-segment';

interface IModelEditorInteraction {
  mode: ModelEditorInteractionMode;
  segmentId: string;
  overrideEntries: IOverrideLayerEntry[];
}

interface IModelEditorState {
  dialog: StoryEditorWidget | null;
  mainViewContainer: HTMLElement | null;
  wantsEditor: boolean;
}

interface IMapBarConfig {
  message: string;
  children: React.ReactNode;
  placement: StoryMapInteractionBarPlacement;
}

interface ISharedEditorContext {
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  tracker: JupyterGISTracker;
}

export class StoryEditorSession {
  private static instance: StoryEditorSession;

  private _context: ISharedEditorContext | null = null;
  private readonly _editors = new Map<IJupyterGISModel, IModelEditorState>();
  private readonly _modelInteractions = new Map<
    IJupyterGISModel,
    IModelEditorInteraction
  >();
  private readonly _mapBars = new Map<
    IJupyterGISModel,
    StoryMapInteractionBarWidget
  >();
  private readonly _previewListeners = new Map<IJupyterGISModel, () => void>();

  private readonly _onTrackerCurrentChanged = (): void => {
    this._syncDialogVisibility();
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
    this._setSharedContext({
      commands,
      state,
      formSchemaRegistry,
      tracker,
    });
    this._parkDialogsExcept(model);
    const editorState = this._getOrCreateEditorState(model);
    editorState.dialog = dialog;
    editorState.mainViewContainer = mainViewContainer;
    editorState.wantsEditor = true;
    this._bindTracker();
  }

  public onDialogDisposed(model: IJupyterGISModel): void {
    const editorState = this._editors.get(model);
    if (editorState) {
      editorState.dialog = null;
      editorState.wantsEditor = false;
    }

    this.closeEditorIfIdle();
  }

  public closeEditorIfIdle(): void {
    if (!this._hasAnyEditorInteraction()) {
      this.clear();
      return;
    }

    for (const [, editorState] of this._editors) {
      editorState.dialog = null;
      editorState.wantsEditor = false;
    }

    if (this._trackerHasStoryPreview()) {
      this._refreshBars();
    }
  }

  public isActiveFor(model: IJupyterGISModel): boolean {
    return (
      this._hasOpenDialog(model) ||
      this._modelInteractions.has(model) ||
      model.isStoryPreviewActive()
    );
  }

  public isMapViewMode(): boolean {
    const model = this._resolveContextModel();
    if (!model) {
      return false;
    }

    return this._modelInteractions.get(model)?.mode === 'map-view';
  }

  public isPreviewingSegment(): boolean {
    const model = this._resolveContextModel();
    if (!model) {
      return false;
    }

    return this._modelInteractions.get(model)?.mode === 'previewing-segment';
  }

  public isPreviewingStory(): boolean {
    const model = this._resolveContextModel();
    return model?.isStoryPreviewActive() ?? false;
  }

  public isMapInteractionMode(): boolean {
    return this._hasAnyEditorInteraction();
  }

  public enterMapViewMode(segmentId: string): void {
    const model = this._resolveEditingModel();
    if (!model || !this._hasOpenDialog(model)) {
      return;
    }

    const shouldHidePanels = !this._hasAnyEditorInteraction();
    this._modelInteractions.set(model, {
      mode: 'map-view',
      segmentId,
      overrideEntries: [],
    });
    this._focusSegmentOnMap(model, segmentId);
    this._releaseDialogForModel(model);
    if (shouldHidePanels) {
      this._togglePanelsForModel(model);
    }
    this._refreshBars();
  }

  public enterPreviewMode(segmentId: string): void {
    const model = this._resolveEditingModel();
    if (!model || !this._hasOpenDialog(model)) {
      return;
    }

    const overrideEntries: IOverrideLayerEntry[] = [];
    const shouldHidePanels = !this._hasAnyEditorInteraction();
    this._modelInteractions.set(model, {
      mode: 'previewing-segment',
      segmentId,
      overrideEntries,
    });
    this._focusSegmentOnMap(model, segmentId);
    applySegmentLayerOverrides(model, segmentId, overrideEntries);
    this._releaseDialogForModel(model);
    if (shouldHidePanels) {
      this._togglePanelsForModel(model);
    }
    this._refreshBars();
  }

  public enterStoryPreviewMode(): void {
    const model = this._resolveEditingModel();
    if (!model || !this._hasOpenDialog(model) || !model.canUseStoryPreview()) {
      return;
    }

    this._clearModelEditorInteraction(model);
    model.setStoryPreviewActive(true);
    this._notifyPreviewChanged();
    this._releaseDialogForModel(model);
    this._refreshBars();
  }

  public applyMapView(): void {
    const model = this._resolveContextModel();
    if (!model) {
      return;
    }

    this.applyMapViewForModel(model);
  }

  public applyMapViewForModel(model: IJupyterGISModel): void {
    const interaction = this._modelInteractions.get(model);
    if (!interaction || interaction.mode !== 'map-view') {
      return;
    }

    updateSegmentMapView(model, interaction.segmentId);
    this.restoreEditorForModel(model);
  }

  public restoreEditor(): void {
    const model = this._resolveContextModel();
    if (!model) {
      return;
    }

    if (model.isStoryPreviewActive()) {
      this._restoreFromStoryPreview(model);
      return;
    }

    this.restoreEditorForModel(model);
  }

  public restoreEditorForModel(model: IJupyterGISModel): void {
    const interaction = this._modelInteractions.get(model);
    const hadInteraction = Boolean(interaction);

    if (interaction?.mode === 'previewing-segment') {
      clearSegmentLayerOverrideEntries(model, interaction.overrideEntries);
    }

    if (hadInteraction) {
      this._modelInteractions.delete(model);
    }

    if (hadInteraction && !this._hasAnyEditorInteraction()) {
      this._togglePanelsForModel(model);
    }

    this._disposeBarForModel(model);
    this._refreshBars();
    void this._openDialogForModel(model);
  }

  public focusDialog(): void {
    const model = this._resolveContextModel();
    if (!model) {
      return;
    }

    this.focusDialogForModel(model);
  }

  public focusDialogForModel(model: IJupyterGISModel): void {
    const dialog = this._getDialog(model);
    if (!dialog) {
      void this._openDialogForModel(model);
      return;
    }

    this._parkDialogsExcept(model);
    dialog.show();
    dialog.activate();
  }

  public clear(): void {
    for (const [model, interaction] of this._modelInteractions) {
      if (interaction.mode === 'previewing-segment') {
        clearSegmentLayerOverrideEntries(model, interaction.overrideEntries);
      }
    }

    this._context?.tracker.forEach(widget => {
      const model = widget.model;
      if (model?.isStoryPreviewActive()) {
        model.setStoryPreviewActive(false);
        this._notifyPreviewChanged();
      }
    });

    this._modelInteractions.clear();
    for (const [, editorState] of this._editors) {
      if (editorState.dialog) {
        editorState.dialog.dispose();
      }
    }
    this._editors.clear();
    this._disposeAllMapBars();
    this._unbindTracker();
    this._context = null;
  }

  private _setSharedContext(context: ISharedEditorContext): void {
    this._context = context;
  }

  private _getOrCreateEditorState(model: IJupyterGISModel): IModelEditorState {
    let editorState = this._editors.get(model);
    if (!editorState) {
      editorState = {
        dialog: null,
        mainViewContainer: null,
        wantsEditor: false,
      };
      this._editors.set(model, editorState);
    }

    return editorState;
  }

  private _getDialog(model: IJupyterGISModel): StoryEditorWidget | null {
    return this._editors.get(model)?.dialog ?? null;
  }

  private _hasOpenDialog(model: IJupyterGISModel): boolean {
    return this._getDialog(model) !== null;
  }

  private _bindTracker(): void {
    this._unbindTracker();
    this._context?.tracker.currentChanged.connect(this._onTrackerCurrentChanged);
    this._context?.tracker.widgetAdded.connect(this._onTrackerWidgetAdded);
    this._bindPreviewListeners();
  }

  private _unbindTracker(): void {
    this._context?.tracker.currentChanged.disconnect(
      this._onTrackerCurrentChanged,
    );
    this._context?.tracker.widgetAdded.disconnect(this._onTrackerWidgetAdded);
    this._unbindPreviewListeners();
  }

  private _bindPreviewListeners(): void {
    if (!this._context?.tracker) {
      return;
    }

    this._context.tracker.forEach(widget => {
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
    const currentModel = this._context?.tracker.currentWidget?.model ?? null;
    if (currentModel && this._modelNeedsBar(currentModel)) {
      modelsToEnsure.add(currentModel);
    }

    this._context?.tracker.forEach(widget => {
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
    const currentModel = this._context?.tracker.currentWidget?.model ?? null;

    for (const [model, bar] of this._mapBars) {
      if (model === currentModel && this._modelNeedsBar(model)) {
        bar.show();
      } else {
        bar.hide();
      }
    }
  }

  private _modelNeedsBar(model: IJupyterGISModel): boolean {
    return model.isStoryPreviewActive() || this._modelInteractions.has(model);
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

    const interaction = this._modelInteractions.get(model);
    if (!interaction) {
      return null;
    }

    switch (interaction.mode) {
      case 'map-view':
        return {
          message:
            'Pan and zoom the map, then apply this view to the segment.',
          children: React.createElement(MapViewBarActions, {
            onBack: () => {
              this.restoreEditorForModel(model);
            },
            onApply: () => {
              this.applyMapViewForModel(model);
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
              this.restoreEditorForModel(model);
            },
          }),
          placement: 'overlay-bottom',
        };
      default:
        return null;
    }
  }

  private _exitStoryPreviewForModel(model: IJupyterGISModel): void {
    if (model.isStoryPreviewActive()) {
      this._restoreFromStoryPreview(model);
      return;
    }

    this._disposeBarForModel(model);
    this._syncBarVisibility();
    void this._openDialogForModel(model);
  }

  private _restoreFromStoryPreview(model: IJupyterGISModel): void {
    if (model.isStoryPreviewActive()) {
      model.setStoryPreviewActive(false);
      this._notifyPreviewChanged();
    }

    this._disposeBarForModel(model);
    this._refreshBars();
    void this._openDialogForModel(model);
  }

  private _clearModelEditorInteraction(model: IJupyterGISModel): void {
    const interaction = this._modelInteractions.get(model);
    if (interaction?.mode === 'previewing-segment') {
      clearSegmentLayerOverrideEntries(model, interaction.overrideEntries);
    }

    this._modelInteractions.delete(model);
    this._disposeBarForModel(model);
  }

  private _resolveContextModel(): IJupyterGISModel | null {
    return this._context?.tracker.currentWidget?.model ?? null;
  }

  private _resolveEditingModel(): IJupyterGISModel | null {
    const currentModel = this._resolveContextModel();
    if (currentModel && this._hasOpenDialog(currentModel)) {
      return currentModel;
    }

    for (const [model, editorState] of this._editors) {
      if (editorState.dialog) {
        return model;
      }
    }

    return currentModel;
  }

  private _hasAnyEditorInteraction(): boolean {
    if (this._trackerHasStoryPreview()) {
      return true;
    }

    return this._modelInteractions.size > 0;
  }

  private _trackerHasStoryPreview(): boolean {
    return this._someTrackedModel(model => model.isStoryPreviewActive());
  }

  private _someTrackedModel(
    predicate: (model: IJupyterGISModel) => boolean,
  ): boolean {
    if (!this._context?.tracker) {
      return false;
    }

    let found = false;
    this._context.tracker.forEach(widget => {
      const model = widget.model;
      if (!found && model && predicate(model)) {
        found = true;
      }
    });

    return found;
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
    const editorState = this._editors.get(model);
    if (!this._context?.tracker) {
      return editorState?.mainViewContainer ?? null;
    }

    return (
      resolveMainViewContainer(this._context.tracker, model) ??
      editorState?.mainViewContainer ??
      null
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

  private async _openDialogForModel(model: IJupyterGISModel): Promise<void> {
    if (!this._context) {
      return;
    }

    const existingDialog = this._getDialog(model);
    if (existingDialog) {
      this._parkDialogsExcept(model);
      existingDialog.show();
      existingDialog.activate();
      return;
    }

    this._parkDialogsExcept(model);

    const editorState = this._getOrCreateEditorState(model);
    editorState.wantsEditor = true;
    editorState.mainViewContainer =
      resolveMainViewContainer(this._context.tracker, model) ??
      editorState.mainViewContainer;

    const dialog = new StoryEditorWidget({
      model,
      commands: this._context.commands,
      state: this._context.state,
      formSchemaRegistry: this._context.formSchemaRegistry,
    });
    editorState.dialog = dialog;

    try {
      await dialog.launch();
    } finally {
      this.closeEditorIfIdle();
    }
  }

  private _syncDialogVisibility(): void {
    const currentModel = this._resolveContextModel();

    for (const [model, editorState] of this._editors) {
      const dialog = editorState.dialog;
      if (!dialog) {
        continue;
      }

      const shouldShow =
        model === currentModel &&
        editorState.wantsEditor &&
        !this._modelInteractions.has(model) &&
        !model.isStoryPreviewActive();

      if (shouldShow) {
        dialog.show();
      } else {
        dialog.hide();
      }
    }
  }

  private _parkDialogsExcept(activeModel: IJupyterGISModel | null): void {
    for (const [model, editorState] of this._editors) {
      if (!editorState.dialog || model === activeModel) {
        continue;
      }

      editorState.dialog.hide();
    }
  }

  private _releaseDialogForModel(model: IJupyterGISModel): void {
    const editorState = this._editors.get(model);
    if (!editorState?.dialog) {
      return;
    }

    const dialog = editorState.dialog;
    editorState.dialog = null;
    dialog.reject();
  }

  private _notifyPreviewChanged(): void {
    this._context?.commands.notifyCommandChanged(CommandIDs.openStoryEditor);
  }

  private _focusSegmentOnMap(
    model: IJupyterGISModel,
    segmentId: string,
  ): void {
    model.centerOnPosition(segmentId);
  }

  private _togglePanelsForModel(_model: IJupyterGISModel): void {
    if (!this._context) {
      return;
    }

    void this._context.commands.execute(CommandIDs.togglePanel);
  }
}
