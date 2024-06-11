import { MapChange } from '@jupyter/ydoc';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PartialJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import Ajv from 'ajv';

import { IJCadContent, IJCadModel } from './_interface/jcad';
import { JupyterCadDoc } from './doc';
import {
  Camera,
  IAnnotationModel,
  IJGISLayersDocChange,
  IJupyterCadClientState,
  IJupyterCadDoc,
  IJupyterCadModel,
  ISelection,
  IUserData,
  Pointer
} from './interfaces';
import jcadSchema from './schema/jcad.json';

export class JupyterCadModel implements IJupyterCadModel {
  constructor(options: JupyterCadModel.IOptions) {
    const { annotationModel, sharedModel } = options;
    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = JupyterCadDoc.create();
      this._sharedModel.changed.connect(this._onSharedModelChanged);
    }
    this.sharedModel.awareness.on('change', this._onClientStateChanged);
    this.annotationModel = annotationModel;
  }

  private _onSharedModelChanged = (sender: any, changes: any): void => {
    if (changes && changes?.objectChange?.length) {
      this._contentChanged.emit(void 0);
      this.dirty = true;
    }
  };

  readonly collaborative = true;

  get sharedModel(): IJupyterCadDoc {
    return this._sharedModel;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  get stateChanged(): ISignal<this, IChangedArgs<any, any, string>> {
    return this._stateChanged;
  }

  get themeChanged(): Signal<
    this,
    IChangedArgs<string, string | null, string>
  > {
    return this._themeChanged;
  }

  get currentUserId(): number | undefined {
    return this.sharedModel?.awareness.clientID;
  }

  get users(): IUserData[] {
    this._usersMap = this._sharedModel?.awareness.getStates();
    const users: IUserData[] = [];
    if (this._usersMap) {
      this._usersMap.forEach((val, key) => {
        users.push({ userId: key, userData: val.user });
      });
    }
    return users;
  }

  get userChanged(): ISignal<this, IUserData[]> {
    return this._userChanged;
  }

  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(value: boolean) {
    this._dirty = value;
  }

  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(value: boolean) {
    this._readOnly = value;
  }

  get localState(): IJupyterCadClientState | null {
    return this.sharedModel.awareness.getLocalState() as IJupyterCadClientState | null;
  }

  get clientStateChanged(): ISignal<this, Map<number, IJupyterCadClientState>> {
    return this._clientStateChanged;
  }

  get sharedOptionsChanged(): ISignal<IJupyterCadDoc, MapChange> {
    return this.sharedModel.optionsChanged;
  }

  get sharedLayersChanged(): ISignal<IJupyterCadDoc, IJGISLayersDocChange> {
    return this.sharedModel.layersChanged;
  }

  get disposed(): ISignal<JupyterCadModel, void> {
    return this._disposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._sharedModel.dispose();
    this._disposed.emit();
    Signal.clearData(this);
  }

  toString(): string {
    return JSON.stringify(this.getContent(), null, 2);
  }

  fromString(data: string): void {
    const jsonData: IJCadContent = JSON.parse(data);
    const ajv = new Ajv();
    const validate = ajv.compile(jcadSchema);
    const valid = validate(jsonData);

    if (!valid) {
      throw Error('File format error');
    }

    this.sharedModel.transact(() => {
      this.sharedModel.addObjects(jsonData.objects);
      this.sharedModel.setOptions(jsonData.options ?? {});
    });
    this.dirty = true;
  }

  toJSON(): PartialJSONObject {
    return JSON.parse(this.toString());
  }

  fromJSON(data: PartialJSONObject): void {
    // nothing to do
  }

  initialize(): void {
    //
  }

  getWorker(): Worker {
    return JupyterCadModel.worker;
  }

  getContent(): IJCadContent {
    return {
      objects: this.sharedModel.objects,
      options: this.sharedModel.options
    };
  }

  getLayers(): IJCadModel {
    return this.sharedModel.layers;
  }

  syncPointer(pointer?: Pointer, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('pointer', {
      value: pointer,
      emitter: emitter
    });
  }

  syncCamera(camera?: Camera, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('camera', {
      value: camera,
      emitter: emitter
    });
  }

  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('selected', {
      value,
      emitter: emitter
    });
  }

  syncSelectedPropField(data: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  }): void {
    this.sharedModel.awareness.setLocalStateField('selectedPropField', data);
  }

  setUserToFollow(userId?: number): void {
    if (this._sharedModel) {
      this._sharedModel.awareness.setLocalStateField('remoteUser', userId);
    }
  }

  syncFormData(form: any): void {
    if (this._sharedModel) {
      this._sharedModel.awareness.setLocalStateField('toolbarForm', form);
    }
  }

  getClientId(): number {
    return this.sharedModel.awareness.clientID;
  }

  addMetadata(key: string, value: string): void {
    this.sharedModel.setMetadata(key, value);
  }

  removeMetadata(key: string): void {
    this.sharedModel.removeMetadata(key);
  }

  private _onClientStateChanged = changed => {
    const clients = this.sharedModel.awareness.getStates() as Map<
      number,
      IJupyterCadClientState
    >;

    this._clientStateChanged.emit(clients);

    this._sharedModel.awareness.on('change', update => {
      if (update.added.length || update.removed.length) {
        this._userChanged.emit(this.users);
      }
    });
  };

  readonly defaultKernelName: string = '';
  readonly defaultKernelLanguage: string = '';
  readonly annotationModel?: IAnnotationModel;

  private _sharedModel: IJupyterCadDoc;

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;

  private _userChanged = new Signal<this, IUserData[]>(this);
  private _usersMap?: Map<number, any>;

  private _disposed = new Signal<this, void>(this);
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _themeChanged = new Signal<this, IChangedArgs<any>>(this);
  private _clientStateChanged = new Signal<
    this,
    Map<number, IJupyterCadClientState>
  >(this);

  static worker: Worker;
}

export namespace JupyterCadModel {
  export interface IOptions
    extends DocumentRegistry.IModelOptions<IJupyterCadDoc> {
    annotationModel?: IAnnotationModel;
  }
}
