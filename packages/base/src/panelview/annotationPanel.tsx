import { IAnnotationModel } from '@jupytergis/schema';
import { PanelWithToolbar, ReactWidget } from '@jupyterlab/ui-components';
import React, { Component } from 'react';

import Annotation from '@/src/annotations/components/Annotation';
import { IControlPanelModel } from '@/src/types';

interface IAnnotationPanelProps {
  annotationModel: IAnnotationModel;
  rightPanelModel: IControlPanelModel;
}

export class AnnotationsPanel extends Component<IAnnotationPanelProps> {
  constructor(props: IAnnotationPanelProps) {
    super(props);

    const updateCallback = () => {
      this.forceUpdate();
    };

    this._annotationModel = props.annotationModel;
    this._rightPanelModel = props.rightPanelModel;

    this._annotationModel.modelChanged.connect(async () => {
      // await this._annotationModel?.context?.ready;

      this._annotationModel?.model?.sharedMetadataChanged.disconnect(
        updateCallback,
      );
      this._annotationModel = props.annotationModel;
      this._annotationModel?.model?.sharedMetadataChanged.connect(
        updateCallback,
      );
      this.forceUpdate();
    });
  }

  render(): JSX.Element {
    const annotationIds = this._annotationModel?.getAnnotationIds();

    if (!annotationIds || !this._annotationModel) {
      return <div></div>;
    }

    const annotations = annotationIds.map((id: string) => {
      return (
        <div>
          <Annotation
            rightPanelModel={this._rightPanelModel}
            annotationModel={this._annotationModel}
            itemId={id}
          />
          <hr className="jGIS-Annotations-Separator"></hr>
        </div>
      );
    });

    return <div className="jgis-scrollable">{annotations}</div>;
  }

  private _annotationModel: IAnnotationModel;
  private _rightPanelModel: IControlPanelModel;
}

export class Annotations extends PanelWithToolbar {
  constructor(options: Annotations.IOptions) {
    super({});

    this.title.label = 'Annotations';
    this.addClass('jgis-scrollable');

    this._annotationModel = options.annotationModel;
    this._rightPanelModel = options.rightPanelModel;

    this._widget = ReactWidget.create(
      <AnnotationsPanel
        rightPanelModel={this._rightPanelModel}
        annotationModel={this._annotationModel}
      />,
    );

    this.addWidget(this._widget);
  }

  private _widget: ReactWidget;
  private _annotationModel: IAnnotationModel;
  private _rightPanelModel: IControlPanelModel;
}

export namespace Annotations {
  export interface IOptions {
    annotationModel: IAnnotationModel;
    rightPanelModel: IControlPanelModel;
  }
}
