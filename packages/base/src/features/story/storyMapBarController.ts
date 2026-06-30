import type { IJupyterGISModel } from '@jupytergis/schema';
import { Widget } from '@lumino/widgets';
import React from 'react';

import { STORY_TYPE, type JupyterGISTracker } from '@/src/types';
import { JupyterGISPanel } from '@/src/workspace/widget';
import {
  MapPreviewBarActions,
  MapViewBarActions,
} from './components/MapInteractionBarActions';
import { StoryMapInteractionBarWidget } from './components/StoryMapInteractionBarWidget';
import {
  SegmentInteractionMode,
  type StoryMapInteractionBarPlacement,
} from './types/types';

interface IMapBarConfig {
  message: string;
  children: React.ReactNode;
  placement: StoryMapInteractionBarPlacement;
}

export interface IStoryMapBarHost {
  getTracker(): JupyterGISTracker | null;
  getInteraction(
    model: IJupyterGISModel,
  ): { mode: SegmentInteractionMode } | null;
  restoreEditorForModel(model: IJupyterGISModel): void;
  applyMapViewForModel(model: IJupyterGISModel): void;
  exitStoryPreviewForModel(model: IJupyterGISModel): void;
}

export class StoryMapBarController {
  private readonly _mapBars = new Map<
    IJupyterGISModel,
    StoryMapInteractionBarWidget
  >();

  constructor(private readonly _host: IStoryMapBarHost) {}

  public refresh(): void {
    for (const model of [...this._mapBars.keys()]) {
      if (!this._modelNeedsBar(model)) {
        this.disposeForModel(model);
      }
    }

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
    const bar = this._mapBars.get(model);
    if (!bar) {
      return;
    }

    bar.hide();
    bar.dispose();
    this._mapBars.delete(model);
  }

  public disposeAll(): void {
    for (const model of [...this._mapBars.keys()]) {
      this.disposeForModel(model);
    }
  }

  public reconcileModel(model: IJupyterGISModel): void {
    this.disposeForModel(model);
    this.refresh();
  }

  private _modelNeedsBar(model: IJupyterGISModel): boolean {
    return (
      model.isStoryPreviewActive() || this._host.getInteraction(model) !== null
    );
  }

  private _ensureBarForModel(model: IJupyterGISModel): void {
    const config = this._getBarConfigForModel(model);
    if (!config) {
      this.disposeForModel(model);
      return;
    }

    if (this._mapBars.has(model)) {
      return;
    }

    const parent = this._resolveMapBarParentForModel(model);
    if (!parent) {
      this._ensureBarForModel(model);
      return;
    }

    const bar = new StoryMapInteractionBarWidget(config);
    Widget.attach(bar, parent);
    this._mapBars.set(model, bar);
  }

  private _syncVisibility(): void {
    const currentModel = this._host.getTracker()?.currentWidget?.model ?? null;

    for (const [model, bar] of this._mapBars) {
      if (model === currentModel && this._modelNeedsBar(model)) {
        bar.show();
      } else {
        bar.hide();
      }
    }
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
      case SegmentInteractionMode.mapView:
        return {
          message: 'Pan and zoom the map, then apply this view to the segment',
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
      case SegmentInteractionMode.previewingSegment:
        return {
          message:
            'Previewing this segment on the map with its layer overrides',
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
      return `Previewing "${title}"`;
    }

    return 'Previewing the story';
  }

  private _resolveMapBarParentForModel(
    model: IJupyterGISModel,
  ): HTMLElement | null {
    const tracker = this._host.getTracker();
    if (!tracker) {
      return null;
    }

    const widget = tracker.find(w => w.model === model);
    const panel = widget?.content;
    if (!(panel instanceof JupyterGISPanel)) {
      return null;
    }

    return (
      panel.jupyterGISMainViewPanel?.node.querySelector<HTMLElement>(
        '.jGIS-Mainview-Container',
      ) ?? null
    );
  }
}
