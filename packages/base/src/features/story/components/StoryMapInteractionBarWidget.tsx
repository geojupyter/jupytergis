import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import {
  StoryMapInteractionBar,
  type IStoryMapInteractionBarProps,
} from './StoryMapInteractionBar';

export class StoryMapInteractionBarWidget extends ReactWidget {
  constructor(private readonly _props: IStoryMapInteractionBarProps) {
    super();
    this.addClass('jgis-story-map-pick-bar-root');
  }

  render(): JSX.Element {
    return <StoryMapInteractionBar {...this._props} />;
  }
}
