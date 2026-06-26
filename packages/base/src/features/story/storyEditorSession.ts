import type {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { IStateDB } from '@jupyterlab/statedb';

import { CommandIDs } from '@/src/constants';
import type { JupyterGISTracker } from '@/src/types';
import { StoryEditorWidget } from './storyEditorDialog';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import { StoryMapBarController } from './storyMapBarController';
import type { IOverrideLayerEntry } from './types/types';
import { setModelPanelsOpen } from './utils/modelPanelState';
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
  panelsHidden: boolean;
}

interface IModelEditorState {
  dialog: StoryEditorWidget | null;
  wantsEditor: boolean;
  interaction: IModelEditorInteraction | null;
  mapBar: StoryMapInteractionBarWidget | null;
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
  private readonly _bars: StoryMapBarController;

  private readonly _onTrackerCurrentChanged = (): void => {
    this._syncDialogVisibility();
    this._bars.refresh();
  };

  private readonly _onTrackerWidgetAdded = (): void => {
    if (this._context?.tracker) {
      this._bars.bindPreviewListeners(this._context.tracker);
    }
  };

  private constructor() {
    this._bars = new StoryMapBarController(
      {
        getTracker: () => this._context?.tracker ?? null,
        getInteraction: model => this._getInteraction(model),
        getEditorState: model => this._editors.get(model),
        getOrCreateEditorState: model => this._getOrCreateEditorState(model),
        forEachEditor: callback => {
          for (const [model, editorState] of this._editors) {
            callback(model, editorState);
          }
        },
      },
      {
        restoreEditorForModel: model => this.restoreEditorForModel(model),
        applyMapViewForModel: model => this.applyMapViewForModel(model),
        exitStoryPreviewForModel: model => this._exitStoryPreviewForModel(model),
      },
    );
  }

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
    state: IStateDB,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    tracker: JupyterGISTracker,
  ): void {
    this._context = {
      commands,
      state,
      formSchemaRegistry,
      tracker,
    };
    this._parkDialogsExcept(model);
    const editorState = this._getOrCreateEditorState(model);
    editorState.dialog = dialog;
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
      this._bars.refresh();
    }
  }

  public isActiveFor(model: IJupyterGISModel): boolean {
    return (
      this._hasOpenDialog(model) ||
      this._getInteraction(model) !== null ||
      model.isStoryPreviewActive()
    );
  }

  public isMapViewMode(): boolean {
    const model = this._resolveContextModel();
    return model ? this._getInteraction(model)?.mode === 'map-view' : false;
  }

  public isPreviewingSegment(): boolean {
    const model = this._resolveContextModel();
    return model
      ? this._getInteraction(model)?.mode === 'previewing-segment'
      : false;
  }

  public isPreviewingStory(): boolean {
    const model = this._resolveContextModel();
    return model?.isStoryPreviewActive() ?? false;
  }

  public isMapInteractionMode(): boolean {
    return this._hasAnyEditorInteraction();
  }

  public enterMapViewMode(segmentId: string): void {
    this._enterSegmentInteraction('map-view', segmentId);
  }

  public enterPreviewMode(segmentId: string): void {
    this._enterSegmentInteraction('previewing-segment', segmentId);
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
    this._bars.refresh();
  }

  public applyMapView(): void {
    const model = this._resolveContextModel();
    if (model) {
      this.applyMapViewForModel(model);
    }
  }

  public applyMapViewForModel(model: IJupyterGISModel): void {
    const interaction = this._getInteraction(model);
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
      this._exitStoryPreviewForModel(model);
      return;
    }

    this.restoreEditorForModel(model);
  }

  public restoreEditorForModel(model: IJupyterGISModel): void {
    this._clearInteractionForModel(model, { restorePanels: true });
    this._bars.disposeForModel(model);
    this._bars.refresh();
    void this._openDialogForModel(model);
  }

  public focusDialog(): void {
    const model = this._resolveContextModel();
    if (model) {
      this.focusDialogForModel(model);
    }
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
    for (const [model] of this._editors) {
      this._clearInteractionForModel(model, { restorePanels: true });
    }

    this._context?.tracker.forEach(widget => {
      const model = widget.model;
      if (model?.isStoryPreviewActive()) {
        model.setStoryPreviewActive(false);
        this._notifyPreviewChanged();
      }
    });

    this._bars.disposeAll();

    for (const [, editorState] of this._editors) {
      if (editorState.dialog) {
        editorState.dialog.dispose();
      }
    }
    this._editors.clear();
    this._unbindTracker();
    this._context = null;
  }

  private _getOrCreateEditorState(model: IJupyterGISModel): IModelEditorState {
    let editorState = this._editors.get(model);
    if (!editorState) {
      editorState = {
        dialog: null,
        wantsEditor: false,
        interaction: null,
        mapBar: null,
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

  private _getInteraction(
    model: IJupyterGISModel,
  ): IModelEditorInteraction | null {
    return this._editors.get(model)?.interaction ?? null;
  }

  private _setInteraction(
    model: IJupyterGISModel,
    interaction: IModelEditorInteraction,
  ): void {
    this._getOrCreateEditorState(model).interaction = interaction;
  }

  private _enterSegmentInteraction(
    mode: ModelEditorInteractionMode,
    segmentId: string,
  ): void {
    const model = this._resolveEditingModel();
    if (!model || !this._hasOpenDialog(model)) {
      return;
    }

    const overrideEntries: IOverrideLayerEntry[] = [];
    const panelsHidden = setModelPanelsOpen(model, false);
    if (panelsHidden) {
      this._notifyPanelStateChanged();
    }

    this._setInteraction(model, {
      mode,
      segmentId,
      overrideEntries,
      panelsHidden,
    });
    model.centerOnPosition(segmentId);
    if (mode === 'previewing-segment') {
      applySegmentLayerOverrides(model, segmentId, overrideEntries);
    }
    this._releaseDialogForModel(model);
    this._bars.refresh();
  }

  private _clearInteractionForModel(
    model: IJupyterGISModel,
    options: { restorePanels?: boolean } = {},
  ): void {
    const editorState = this._editors.get(model);
    const interaction = editorState?.interaction;
    if (!interaction || !editorState) {
      return;
    }

    if (interaction.mode === 'previewing-segment') {
      clearSegmentLayerOverrideEntries(model, interaction.overrideEntries);
    }

    if (options.restorePanels && interaction.panelsHidden) {
      if (setModelPanelsOpen(model, true)) {
        this._notifyPanelStateChanged();
      }
    }

    editorState.interaction = null;
  }

  private _exitStoryPreviewForModel(model: IJupyterGISModel): void {
    if (model.isStoryPreviewActive()) {
      model.setStoryPreviewActive(false);
      this._notifyPreviewChanged();
    }

    this._bars.disposeForModel(model);
    this._bars.refresh();
    void this._openDialogForModel(model);
  }

  private _clearModelEditorInteraction(model: IJupyterGISModel): void {
    this._clearInteractionForModel(model);
    this._bars.disposeForModel(model);
  }

  private _bindTracker(): void {
    this._unbindTracker();
    this._context?.tracker.currentChanged.connect(this._onTrackerCurrentChanged);
    this._context?.tracker.widgetAdded.connect(this._onTrackerWidgetAdded);
    if (this._context?.tracker) {
      this._bars.bindPreviewListeners(this._context.tracker);
    }
  }

  private _unbindTracker(): void {
    this._context?.tracker.currentChanged.disconnect(
      this._onTrackerCurrentChanged,
    );
    this._context?.tracker.widgetAdded.disconnect(this._onTrackerWidgetAdded);
    this._bars.unbindPreviewListeners();
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

    for (const editorState of this._editors.values()) {
      if (editorState.interaction) {
        return true;
      }
    }

    return false;
  }

  private _trackerHasStoryPreview(): boolean {
    if (!this._context?.tracker) {
      return false;
    }

    let found = false;
    this._context.tracker.forEach(widget => {
      const model = widget.model;
      if (!found && model?.isStoryPreviewActive()) {
        found = true;
      }
    });

    return found;
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
        !editorState.interaction &&
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

  private _notifyPanelStateChanged(): void {
    this._context?.commands.notifyCommandChanged(CommandIDs.togglePanel);
    this._context?.commands.notifyCommandChanged(CommandIDs.toggleLeftPanel);
    this._context?.commands.notifyCommandChanged(CommandIDs.toggleRightPanel);
  }
}
