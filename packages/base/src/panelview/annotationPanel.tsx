import { IAnnotationModel, IJupyterGISModel } from '@jupytergis/schema';
import React, { Component } from 'react';

import Annotation from '@/src/annotations/components/Annotation';

interface IAnnotationPanelProps {
  annotationModel: IAnnotationModel;
  rightPanelModel: IJupyterGISModel;
}

export class AnnotationsPanel extends Component<IAnnotationPanelProps> {
  constructor(props: IAnnotationPanelProps) {
    super(props);

    const updateCallback = () => {
      this.forceUpdate();
    };

    this._annotationModel = props.annotationModel;
    this._rightPanelModel = props.rightPanelModel;

    this._annotationModel?.model?.sharedMetadataChanged.connect(updateCallback);
    this.forceUpdate();
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
  private _rightPanelModel: IJupyterGISModel;
}
