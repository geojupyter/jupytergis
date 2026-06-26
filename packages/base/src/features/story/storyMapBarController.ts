import type { IJupyterGISModel } from '@jupytergis/schema';
import { Widget } from '@lumino/widgets';
import React from 'react';

import { STORY_TYPE, type JupyterGISTracker } from '@/src/types';
import { resolveMainViewContainer } from '@/src/features/story/utils/resolveMainViewContainer';
import {
  MapPreviewBarActions,
  MapViewBarActions,
} from './components/MapInteractionBarActions';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import type { StoryMapInteractionBarPlacement } from './types/types';

type MapBarInteractionMode = 'map-view' | 'previewing-segment';

interface IMapBarConfig {
  message: string;
  children: React.ReactNode;
  placement: StoryMapInteractionBarPlacement;
}

export interface IStoryMapBarEditorState {
  mapBar: StoryMapInteractionBarWidget | null;
}

export interface IStoryMapBarHost {
  getTracker(): JupyterGISTracker | null;
  getInteraction(
    model: IJupyterGISModel,
  ): { mode: MapBarInteractionMode } | null;
  getEditorState(model: IJupyterGISModel): IStoryMapBarEditorState | undefined;
  getOrCreateEditorState(model: IJupyterGISModel): IStoryMapBarEditorState;
  forEachEditor(
    callback: (
      model: IJupyterGISModel,
      editorState: IStoryMapBarEditorState,
    ) => void,
  ): void;
  restoreEditorForModel(model: IJupyterGISModel): void;
  applyMapViewForModel(model: IJupyterGISModel): void;
  exitStoryPreviewForModel(model: IJupyterGISModel): void;
}

export class StoryMapBarController {
  constructor(private readonly _host: IStoryMapBarHost) {}

  public refresh(): void {
    this._host.forEachEditor((model, editorState) => {
      if (editorState.mapBar && !this._modelNeedsBar(model)) {
        this.disposeForModel(model);
      }
    });

    const tracker = this._host.getTracker();
    const modelsToEnsure = new Set<IJupyterGISModel>();
    const currentModel = tracker?.currentWidget?.model ?? null;

    if (currentModel && this._modelNeedsBar(currentModel)) {
      modelsToEnsure.add(currentModel);
    }

    tracker?.forEach(widget => {
      const model = widget.model;
      if (model && this._modelNeedsBar(model)) {
        modelsToEnsure.add(model);
      }
    });

    for (const model of modelsToEnsure) {
      this._ensureBarForModel(model);
    }

    this._syncVisibility();
  }

  public disposeForModel(model: IJupyterGISModel): void {
    const editorState = this._host.getEditorState(model);
    const bar = editorState?.mapBar;
    if (!bar) {
      return;
    }

    bar.hide();
    bar.dispose();
    editorState.mapBar = null;
  }

  public disposeAll(): void {
    this._host.forEachEditor(model => {
      this.disposeForModel(model);
    });
  }

  private _modelNeedsBar(model: IJupyterGISModel): boolean {
    return (
      model.isStoryPreviewActive() || this._host.getInteraction(model) !== null
    );
  }

  private _ensureBarForModel(model: IJupyterGISModel, retry = 0): void {
    const config = this._getBarConfigForModel(model);
    const editorState = this._host.getOrCreateEditorState(model);

    if (!config) {
      this.disposeForModel(model);
      return;
    }

    if (editorState.mapBar) {
      return;
    }

    const parent = this._resolveMapBarParentForModel(model);
    if (!parent) {
      if (retry < 10) {
        requestAnimationFrame(() => {
          this._ensureBarForModel(model, retry + 1);
        });
      }
      return;
    }

    const bar = new StoryMapInteractionBarWidget(config);
    Widget.attach(bar, parent);
    editorState.mapBar = bar;
  }

  private _syncVisibility(): void {
    const currentModel = this._host.getTracker()?.currentWidget?.model ?? null;

    this._host.forEachEditor((model, editorState) => {
      const bar = editorState.mapBar;
      if (!bar) {
        return;
      }

      if (model === currentModel && this._modelNeedsBar(model)) {
        bar.show();
      } else {
        bar.hide();
      }
    });
  }

  private _getBarConfigForModel(model: IJupyterGISModel): IMapBarConfig | null {
    if (model.isStoryPreviewActive()) {
      return {
        message: this._getStoryPreviewBarMessage(model),
        children: React.createElement(MapPreviewBarActions, {
          onBack: () => {
            this._host.exitStoryPreviewForModel(model);
          },
        }),
        placement: this._getStoryPreviewBarPlacement(model),
      };
    }

    const interaction = this._host.getInteraction(model);
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
              this._host.restoreEditorForModel(model);
            },
            onApply: () => {
              this._host.applyMapViewForModel(model);
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
              this._host.restoreEditorForModel(model);
            },
          }),
          placement: 'overlay-bottom',
        };
      default:
        return null;
    }
  }

  private _getStoryPreviewBarPlacement(
    model: IJupyterGISModel,
  ): StoryMapInteractionBarPlacement {
    const storyType = model.getSelectedStory().story?.storyType;
    if (storyType === STORY_TYPE.guided) {
      return 'main-top-left';
    }

    return 'overlay-bottom';
  }

  private _getStoryPreviewBarMessage(model: IJupyterGISModel): string {
    const title = model.getSelectedStory().story?.title?.trim();
    if (title) {
      return `Previewing "${title}".`;
    }

    return 'Previewing the story.';
  }

  private _resolveMapBarParentForModel(
    model: IJupyterGISModel,
  ): HTMLElement | null {
    const tracker = this._host.getTracker();
    if (!tracker) {
      return null;
    }

    return resolveMainViewContainer(tracker, model);
  }
}
