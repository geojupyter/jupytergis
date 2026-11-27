import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import {
  StoryMapInteractionBar,
  type IStoryMapInteractionBarProps,
} from '@/src/features/story/components/StoryMapInteractionBar';
import type { StoryMapInteractionBarPlacement } from '../types/types';

interface IStoryMapInteractionBarWidgetOptions extends IStoryMapInteractionBarProps {
  placement?: StoryMapInteractionBarPlacement;
}

export class StoryMapInteractionBarWidget extends ReactWidget {
  private readonly _barProps: IStoryMapInteractionBarProps;

  constructor(options: IStoryMapInteractionBarWidgetOptions) {
    const { placement = 'overlay-bottom', ...barProps } = options;
    super();
    this._barProps = barProps;
    this.addClass('jgis-story-map-interaction-bar-root');
    if (placement === 'main-top-left') {
      this.addClass('jgis-story-map-interaction-bar-root--main-top-left');
    } else {
      this.addClass('jgis-story-map-interaction-bar-root--overlay-bottom');
    }
  }

  render(): JSX.Element {
    return <StoryMapInteractionBar {...this._barProps} />;
  }
}
