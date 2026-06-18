import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import {
  StoryMapPreviewBar,
  type IStoryMapPreviewBarProps,
} from './StoryMapPreviewBar';

export class StoryMapPreviewBarWidget extends ReactWidget {
  constructor(private readonly _props: IStoryMapPreviewBarProps) {
    super();
    this.addClass('jgis-story-map-pick-bar-root');
  }

  render(): JSX.Element {
    return <StoryMapPreviewBar {...this._props} />;
  }
}
