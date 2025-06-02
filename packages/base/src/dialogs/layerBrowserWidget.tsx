import {
  IDict,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISTracker,
  IRasterLayerGalleryEntry
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React from 'react';
import { LayerBrowserComponent } from './layerBrowserDialog';

export interface ILayerBrowserOptions {
  type: 'og' | 'stac';
  tracker: IJupyterGISTracker;
  model: IJupyterGISModel;
  registry: IRasterLayerGalleryEntry[];
  formSchemaRegistry: IJGISFormSchemaRegistry;
}

export class LayerBrowserWidget extends Dialog<boolean> {
  constructor(options: ILayerBrowserOptions) {
    let cancelCallback: (() => void) | undefined = undefined;
    cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, number>
    >();

    let body;

    if (options.type === 'og') {
      body = (
        <LayerBrowserComponent
          model={options.model}
          registry={options.registry}
          formSchemaRegistry={options.formSchemaRegistry}
          okSignalPromise={okSignalPromise}
          cancel={cancelCallback}
        />
      );
    }

    // if (options.type === 'stac') {
    //   body = (
    //     <StacBrowser
    //       model={options.model}
    //       tracker={options.tracker}
    //       display="grid"
    //     />
    //   );
    // }

    super({ body, buttons: [Dialog.cancelButton(), Dialog.okButton()] });

    this.id = 'jupytergis::layerBrowser';

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);

    // Override default dialog style
    this.addClass('jGIS-layerbrowser-FormDialog');
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(1);
    }
  }

  private okSignal: Signal<Dialog<any>, number>;
}
