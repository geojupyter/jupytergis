import {
  IAnnotation,
  IAnnotationContent,
  IAnnotationModel,
  IJupyterGISModel
} from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';

export class AnnotationModel implements IAnnotationModel {
  constructor(options: AnnotationModel.IOptions) {
    this.model = options.model;
  }

  get updateSignal(): ISignal<this, null> {
    return this._updateSignal;
  }

  get user(): User.IIdentity | undefined {
    return this._user;
  }

  set model(model: IJupyterGISModel | undefined) {
    this._model = model;

    const state = this._model?.sharedModel.awareness.getLocalState();
    this._user = state?.user;

    this._modelChanged.emit(void 0);
  }

  get model(): IJupyterGISModel | undefined {
    return this._model;
  }

  get modelChanged(): ISignal<this, void> {
    return this._modelChanged;
  }

  update(): void {
    this._updateSignal.emit(null);
  }

  getAnnotation(id: string): IAnnotation | undefined {
    const rawData = this._model?.sharedModel.getMetadata(id);
    if (rawData) {
      return rawData as IAnnotation;
    }
  }

  getAnnotationIds(): string[] {
    const annotationIds: string[] = [];
    for (const id in this._model?.sharedModel.metadata) {
      if (id.startsWith('annotation')) {
        annotationIds.push(id);
      }
    }
    return annotationIds;
  }

  addAnnotation(key: string, value: IAnnotation): void {
    this._model?.sharedModel.setMetadata(`annotation_${key}`, value);
  }

  removeAnnotation(key: string): void {
    this._model?.removeMetadata(key);
  }

  addContent(id: string, value: string): void {
    const newContent: IAnnotationContent = {
      value,
      user: this._user
    };
    const currentAnnotation = this.getAnnotation(id);
    if (currentAnnotation) {
      const newAnnotation: IAnnotation = {
        ...currentAnnotation,
        contents: [...currentAnnotation.contents, newContent]
      };

      this._model?.sharedModel.setMetadata(id, newAnnotation);
    }
  }

  private _model: IJupyterGISModel | undefined;
  private _modelChanged = new Signal<this, void>(this);
  private _updateSignal = new Signal<this, null>(this);
  private _user?: User.IIdentity;
}

namespace AnnotationModel {
  export interface IOptions {
    model: IJupyterGISModel | undefined;
  }
}
