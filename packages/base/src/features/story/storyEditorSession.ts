import type {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import { IStateDB } from '@jupyterlab/statedb';

import { CommandIDs } from '@/src/constants';
import type { JupyterGISTracker } from '@/src/types';
import { StoryEditorWidget } from './storyEditorDialog';
import {
  StoryMapBarController,
  type IStoryMapBarHost,
} from './storyMapBarController';
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
}

interface ISharedEditorContext {
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  tracker: JupyterGISTracker;
}

export type StoryEditorMode =
  | 'inactive'
  | 'editing'
  | 'map-view'
  | 'segment-preview'
  | 'story-preview';

export class StoryEditorSession implements IStoryMapBarHost {
  private static instance: StoryEditorSession;

  private _context: ISharedEditorContext | null = null;
  private readonly _editors = new Map<IJupyterGISModel, IModelEditorState>();
  private readonly _bars: StoryMapBarController;

  private readonly onTrackerCurrentChanged = (): void => {
    this.syncDialogVisibility();
    this._bars.refresh();
  };

  private constructor() {
    this._bars = new StoryMapBarController(this);
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

    this.parkDialogsExcept(model);
    const editorState = this.getOrCreateEditorState(model);
    editorState.dialog = dialog;
    editorState.wantsEditor = true;
    this.bindTracker();
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
    if (!this.hasActiveInteraction()) {
      this.clear();
      return;
    }

    for (const [, editorState] of this._editors) {
      editorState.dialog = null;
      editorState.wantsEditor = false;
    }

    if (this.trackerHasStoryPreview()) {
      this._bars.refresh();
    }
  }

  public getMode(model: IJupyterGISModel): StoryEditorMode {
    if (model.isStoryPreviewActive()) {
      return 'story-preview';
    }

    const interaction = this.getInteraction(model);
    if (interaction?.mode === 'map-view') {
      return 'map-view';
    }

    if (interaction?.mode === 'previewing-segment') {
      return 'segment-preview';
    }

    if (this.getDialog(model)) {
      return 'editing';
    }

    return 'inactive';
  }

  public hasActiveInteraction(): boolean {
    if (this.trackerHasStoryPreview()) {
      return true;
    }

    for (const editorState of this._editors.values()) {
      if (editorState.interaction) {
        return true;
      }
    }

    return false;
  }

  public getTracker(): JupyterGISTracker | null {
    return this._context?.tracker ?? null;
  }

  public getInteraction(
    model: IJupyterGISModel,
  ): IModelEditorInteraction | null {
    return this._editors.get(model)?.interaction ?? null;
  }

  public enterMapViewMode(segmentId: string): void {
    this.enterSegmentInteraction('map-view', segmentId);
  }

  public enterPreviewMode(segmentId: string): void {
    this.enterSegmentInteraction('previewing-segment', segmentId);
  }

  public enterStoryPreviewMode(): void {
    const model = this.resolveEditingModel();
    if (!model || !this.getDialog(model) || !model.canUseStoryPreview()) {
      return;
    }

    this.clearInteractionForModel(model);
    this._bars.disposeForModel(model);
    model.setStoryPreviewActive(true);
    this.notifyPreviewChanged();
    this.releaseDialogForModel(model);
    this._bars.refresh();
  }

  public applyMapView(): void {
    const model = this.resolveContextModel();
    if (model) {
      this.applyMapViewForModel(model);
    }
  }

  public applyMapViewForModel(model: IJupyterGISModel): void {
    const interaction = this.getInteraction(model);
    if (!interaction || interaction.mode !== 'map-view') {
      return;
    }

    updateSegmentMapView(model, interaction.segmentId);
    this.restoreEditorForModel(model);
  }

  public restoreEditor(): void {
    const model = this.resolveContextModel();
    if (!model) {
      return;
    }

    if (model.isStoryPreviewActive()) {
      this.exitStoryPreviewForModel(model);
      return;
    }

    this.restoreEditorForModel(model);
  }

  public restoreEditorForModel(model: IJupyterGISModel): void {
    this.clearInteractionForModel(model, { restorePanels: true });
    this._bars.disposeForModel(model);
    this._bars.refresh();
    void this.openDialogForModel(model);
  }

  public focusDialog(): void {
    const model = this.resolveContextModel();
    if (model) {
      this.focusDialogForModel(model);
    }
  }

  public focusDialogForModel(model: IJupyterGISModel): void {
    const dialog = this.getDialog(model);

    if (!dialog) {
      void this.openDialogForModel(model);
      return;
    }

    this.parkDialogsExcept(model);
    dialog.show();
    dialog.activate();
  }

  public clear(): void {
    for (const [model] of this._editors) {
      this.clearInteractionForModel(model, { restorePanels: true });
    }

    this._context?.tracker.forEach(widget => {
      const model = widget.model;
      if (model?.isStoryPreviewActive()) {
        model.setStoryPreviewActive(false);
        this.notifyPreviewChanged();
      }
    });

    this._bars.disposeAll();

    for (const [, editorState] of this._editors) {
      if (editorState.dialog) {
        editorState.dialog.dispose();
      }
    }
    this._editors.clear();
    this.unbindTracker();
    this._context = null;
  }

  private getOrCreateEditorState(model: IJupyterGISModel): IModelEditorState {
    let editorState = this._editors.get(model);
    if (!editorState) {
      editorState = {
        dialog: null,
        wantsEditor: false,
        interaction: null,
      };

      this._editors.set(model, editorState);
    }

    return editorState;
  }

  private getDialog(model: IJupyterGISModel): StoryEditorWidget | null {
    return this._editors.get(model)?.dialog ?? null;
  }

  private setInteraction(
    model: IJupyterGISModel,
    interaction: IModelEditorInteraction,
  ): void {
    this.getOrCreateEditorState(model).interaction = interaction;
  }

  private enterSegmentInteraction(
    mode: ModelEditorInteractionMode,
    segmentId: string,
  ): void {
    const model = this.resolveEditingModel();
    if (!model || !this.getDialog(model)) {
      return;
    }

    const overrideEntries: IOverrideLayerEntry[] = [];
    const panelsHidden = setModelPanelsOpen(model, false);
    if (panelsHidden) {
      this.notifyPanelStateChanged();
    }

    this.setInteraction(model, {
      mode,
      segmentId,
      overrideEntries,
      panelsHidden,
    });

    model.centerOnPosition(segmentId);

    if (mode === 'previewing-segment') {
      applySegmentLayerOverrides(model, segmentId, overrideEntries);
    }

    this.releaseDialogForModel(model);
    this._bars.refresh();
  }

  private clearInteractionForModel(
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
        this.notifyPanelStateChanged();
      }
    }

    editorState.interaction = null;
  }

  public exitStoryPreviewForModel(model: IJupyterGISModel): void {
    if (model.isStoryPreviewActive()) {
      model.setStoryPreviewActive(false);
      this.notifyPreviewChanged();
    }

    this._bars.disposeForModel(model);
    this._bars.refresh();
    void this.openDialogForModel(model);
  }

  private bindTracker(): void {
    this.unbindTracker();
    this._context?.tracker.currentChanged.connect(this.onTrackerCurrentChanged);
  }

  private unbindTracker(): void {
    this._context?.tracker.currentChanged.disconnect(
      this.onTrackerCurrentChanged,
    );
  }

  private resolveContextModel(): IJupyterGISModel | null {
    return this._context?.tracker.currentWidget?.model ?? null;
  }

  private resolveEditingModel(): IJupyterGISModel | null {
    const currentModel = this.resolveContextModel();
    if (currentModel && this.getDialog(currentModel)) {
      return currentModel;
    }

    for (const [model, editorState] of this._editors) {
      if (editorState.dialog) {
        return model;
      }
    }

    return currentModel;
  }

  private trackerHasStoryPreview(): boolean {
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

  private async openDialogForModel(model: IJupyterGISModel): Promise<void> {
    if (!this._context) {
      return;
    }

    const existingDialog = this.getDialog(model);
    if (existingDialog) {
      this.parkDialogsExcept(model);
      existingDialog.show();
      existingDialog.activate();
      return;
    }

    this.parkDialogsExcept(model);

    const editorState = this.getOrCreateEditorState(model);
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

  private syncDialogVisibility(): void {
    const currentModel = this.resolveContextModel();

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

  private parkDialogsExcept(activeModel: IJupyterGISModel | null): void {
    for (const [model, editorState] of this._editors) {
      if (!editorState.dialog || model === activeModel) {
        continue;
      }

      editorState.dialog.hide();
    }
  }

  private releaseDialogForModel(model: IJupyterGISModel): void {
    const editorState = this._editors.get(model);
    if (!editorState?.dialog) {
      return;
    }

    const dialog = editorState.dialog;
    editorState.dialog = null;
    dialog.reject();
  }

  private notifyPreviewChanged(): void {
    this._context?.commands.notifyCommandChanged(CommandIDs.openStoryEditor);
  }

  private notifyPanelStateChanged(): void {
    this._context?.commands.notifyCommandChanged(CommandIDs.togglePanel);
    this._context?.commands.notifyCommandChanged(CommandIDs.toggleLeftPanel);
    this._context?.commands.notifyCommandChanged(CommandIDs.toggleRightPanel);
  }
}
