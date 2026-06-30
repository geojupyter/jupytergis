import type {
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
} from '@jupytergis/schema';
import type { IEditorServices } from '@jupyterlab/codeeditor';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';

import { CommandIDs } from '@/src/constants';
import type { JupyterGISTracker } from '@/src/types';
import { StoryEditorWidget } from './storyEditorDialog';
import {
  StoryMapBarController,
  type IStoryMapBarHost,
} from './storyMapBarController';
import {
  SegmentInteractionMode,
  type IOverrideLayerEntry,
} from './types/types';
import { setModelPanelsOpen } from './utils/modelPanelState';
import { updateSegmentMapView } from './utils/storySegmentMapView';
import {
  applySegmentLayerOverrides,
  clearSegmentLayerOverrideEntries,
} from './utils/storySegmentOverrides';

interface IModelEditorInteraction {
  mode: SegmentInteractionMode;
  segmentId: string;
  overrideEntries: IOverrideLayerEntry[];
  panelsHidden: boolean;
}

interface IModelEditorState {
  dialog: StoryEditorWidget | null;
  interaction: IModelEditorInteraction | null;
}

interface ISharedEditorContext {
  commands: CommandRegistry;
  state: IStateDB;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  tracker: JupyterGISTracker;
  editorServices: IEditorServices;
}

export const StoryEditorMode = {
  inactive: 'inactive',
  editing: 'editing',
  mapView: 'map-view',
  segmentPreview: 'segment-preview',
  storyPreview: 'story-preview',
} as const;

export type StoryEditorMode =
  (typeof StoryEditorMode)[keyof typeof StoryEditorMode];

export class StoryEditorSession implements IStoryMapBarHost {
  private static instance: StoryEditorSession;

  private _context: ISharedEditorContext | null = null;
  private readonly _editors = new Map<IJupyterGISModel, IModelEditorState>();
  private readonly _bars: StoryMapBarController;

  private readonly onTrackerCurrentChanged = (): void => {
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
    editorServices: IEditorServices,
  ): void {
    this._context = {
      commands,
      state,
      formSchemaRegistry,
      tracker,
      editorServices,
    };

    this.releaseOtherDialogs(model);
    const editorState = this.getOrCreateEditorState(model);
    editorState.dialog = dialog;
    this.bindTracker();
  }

  public async openEditor(
    model: IJupyterGISModel,
    commands: CommandRegistry,
    state: IStateDB,
    formSchemaRegistry: IJGISFormSchemaRegistry,
    tracker: JupyterGISTracker,
    editorServices: IEditorServices,
  ): Promise<void> {
    this._context = {
      commands,
      state,
      formSchemaRegistry,
      tracker,
      editorServices,
    };
    this.bindTracker();

    await this.openDialogForModel(model);
  }

  public onDialogDisposed(model: IJupyterGISModel): void {
    const editorState = this._editors.get(model);
    if (editorState) {
      editorState.dialog = null;
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
    }

    if (this.trackerHasStoryPreview()) {
      this._bars.refresh();
    }
  }

  public getMode(model: IJupyterGISModel): StoryEditorMode {
    if (model.isStoryPreviewActive()) {
      return StoryEditorMode.storyPreview;
    }

    const interaction = this.getInteraction(model);
    if (interaction?.mode === SegmentInteractionMode.mapView) {
      return StoryEditorMode.mapView;
    }

    if (interaction?.mode === SegmentInteractionMode.previewingSegment) {
      return StoryEditorMode.segmentPreview;
    }

    if (this.getDialog(model)) {
      return StoryEditorMode.editing;
    }

    return StoryEditorMode.inactive;
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
    this.enterSegmentInteraction(SegmentInteractionMode.mapView, segmentId);
  }

  public enterPreviewMode(segmentId: string): void {
    this.enterSegmentInteraction(
      SegmentInteractionMode.previewingSegment,
      segmentId,
    );
  }

  public enterStoryPreviewMode(): void {
    const model = this.dialogOwnerModel();
    if (!model || !this.getDialog(model) || !model.canUseStoryPreview()) {
      return;
    }

    this.clearInteractionForModel(model);
    model.setStoryPreviewActive(true);
    this.notifyPreviewChanged();
    this.releaseDialogForModel(model);
    this._bars.recreateBarForModel(model);
  }

  public applyMapView(): void {
    const model = this.activeTabModel();
    if (model) {
      this.applyMapViewForModel(model);
    }
  }

  public applyMapViewForModel(model: IJupyterGISModel): void {
    const interaction = this.getInteraction(model);
    if (!interaction || interaction.mode !== SegmentInteractionMode.mapView) {
      return;
    }

    updateSegmentMapView(model, interaction.segmentId);
    this.restoreEditorForModel(model);
  }

  public restoreEditor(): void {
    const model = this.activeTabModel();
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
    this._bars.recreateBarForModel(model);
    void this.openDialogForModel(model);
  }

  public focusDialog(): void {
    const model = this.activeTabModel();
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
    mode: SegmentInteractionMode,
    segmentId: string,
  ): void {
    const model = this.dialogOwnerModel();

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

    if (mode === SegmentInteractionMode.previewingSegment) {
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

    if (interaction.mode === SegmentInteractionMode.previewingSegment) {
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

    this._bars.recreateBarForModel(model);
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

  private activeTabModel(): IJupyterGISModel | null {
    return this._context?.tracker.currentWidget?.model ?? null;
  }

  private dialogOwnerModel(): IJupyterGISModel | null {
    const model = this.activeTabModel();
    if (!model || !this.getDialog(model)) {
      return null;
    }

    return model;
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
      existingDialog.show();
      existingDialog.activate();
      return;
    }

    this.releaseOtherDialogs(model);

    const editorState = this.getOrCreateEditorState(model);

    const dialog = new StoryEditorWidget({
      model,
      commands: this._context.commands,
      state: this._context.state,
      formSchemaRegistry: this._context.formSchemaRegistry,
      editorServices: this._context.editorServices,
    });
    editorState.dialog = dialog;

    try {
      await dialog.launch();
    } finally {
      this.closeEditorIfIdle();
    }
  }

  private releaseOtherDialogs(keepModel: IJupyterGISModel): void {
    for (const [model] of this._editors) {
      if (model !== keepModel) {
        this.releaseDialogForModel(model);
      }
    }
  }

  private releaseDialogForModel(model: IJupyterGISModel): void {
    const editorState = this._editors.get(model);
    if (!editorState?.dialog) {
      return;
    }

    const dialog = editorState.dialog;
    editorState.dialog = null;
    dialog.close();
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
