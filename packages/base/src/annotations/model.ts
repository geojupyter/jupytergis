import {
  IAnnotation,
  IAnnotationContent,
  IAnnotationModel,
  IJupyterGISWidgetContext
} from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';

export class AnnotationModel implements IAnnotationModel {
  constructor(options: AnnotationModel.IOptions) {
    this.context = options.context;
  }

  get updateSignal(): ISignal<this, null> {
    return this._updateSignal;
  }

  get user(): User.IIdentity | undefined {
    return this._user;
  }

  set context(context: IJupyterGISWidgetContext | undefined) {
    this._context = context;

    const state = this._context?.model.sharedModel.awareness.getLocalState();
    this._user = state?.user;

    this._contextChanged.emit(void 0);
  }

  get context(): IJupyterGISWidgetContext | undefined {
    return this._context;
  }

  get contextChanged(): ISignal<this, void> {
    return this._contextChanged;
  }

  update(): void {
    this._updateSignal.emit(null);
  }

  getAnnotation(id: string): IAnnotation | undefined {
    const rawData = this._context?.model.sharedModel.getMetadata(id);
    if (rawData) {
      return JSON.parse(rawData) as IAnnotation;
    }
  }

  getAnnotationIds(): string[] {
    const annotationIds: string[] = [];
    for (const id in this._context?.model.sharedModel.metadata) {
      if (id.startsWith('annotation')) {
        annotationIds.push(id);
      }
    }
    return annotationIds;
  }

  addAnnotation(key: string, value: IAnnotation): void {
    this._context?.model.sharedModel.setMetadata(
      `annotation_${key}`,
      JSON.stringify(value)
    );
  }

  removeAnnotation(key: string): void {
    this._context?.model.removeMetadata(key);
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

      this._context?.model.sharedModel.setMetadata(
        id,
        JSON.stringify(newAnnotation)
      );
    }
  }

  private _context: IJupyterGISWidgetContext | undefined;
  private _contextChanged = new Signal<this, void>(this);
  private _updateSignal = new Signal<this, null>(this);
  private _user?: User.IIdentity;
}

namespace AnnotationModel {
  export interface IOptions {
    context: IJupyterGISWidgetContext | undefined;
  }
}
