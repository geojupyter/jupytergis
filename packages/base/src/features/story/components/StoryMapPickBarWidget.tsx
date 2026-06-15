import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import {
  StoryMapPickBar,
  type IStoryMapPickBarProps,
} from './StoryMapPickBar';

export class StoryMapPickBarWidget extends ReactWidget {
  constructor(private readonly _props: IStoryMapPickBarProps) {
    super();
    this.addClass('jgis-story-map-pick-bar-root');
  }

  render(): JSX.Element {
    return <StoryMapPickBar {...this._props} />;
  }
}
