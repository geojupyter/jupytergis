import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useEffect, useState } from 'react';

import { SymbologyTab, SymbologyValue } from '@/src/types';
import TiffRendering from './tiff_layer/TiffRendering';
import VectorRendering from './vector_layer/VectorRendering';

export interface ISymbologyDialogProps {
  model: IJupyterGISModel;
  okSignalPromise: PromiseDelegate<Signal<SymbologyWidget, null>>;
  layerId?: string;
  isStorySegmentOverride?: boolean;
  segmentId?: string;
}

export interface ISymbologyDialogWithAttributesProps extends ISymbologyDialogProps {
  selectableAttributesAndValues: Record<string, Set<any>>;
}

export interface ISymbologyTabbedDialogProps extends ISymbologyDialogProps {
  symbologyTab: SymbologyTab;
}

export type ISymbologyTabbedDialogWithAttributesProps =
  ISymbologyDialogWithAttributesProps & ISymbologyTabbedDialogProps;

export interface ISymbologyWidgetOptions {
  model: IJupyterGISModel;
  state: IStateDB;
  isStorySegmentOverride?: boolean;
  segmentId?: string;
}

export interface IStopRow {
  stop: number;
  output: SymbologyValue;
}

const SymbologyDialog: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [componentToRender, setComponentToRender] =
    useState<JSX.Element | null>(null);

  let LayerSymbology: React.JSX.Element;

  useEffect(() => {
    const handleClientStateChanged = () => {
      if (!model.localState?.selected?.value) {
        return;
      }

      const currentLayer = Object.keys(model.localState.selected.value)[0];

      setSelectedLayer(currentLayer);
    };

    // Initial state
    handleClientStateChanged();

    model.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      model.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedLayer) {
      return;
    }

    const layer = model.getLayer(selectedLayer);

    if (!layer) {
      return;
    }

    // TODO WebGlLayers can also be used for other layers, need a better way to determine source + layer combo
    switch (layer.type) {
      case 'VectorLayer':
      case 'VectorTileLayer':
      case 'HeatmapLayer':
        LayerSymbology = (
          <VectorRendering
            model={model}
            okSignalPromise={okSignalPromise}
            layerId={selectedLayer}
            isStorySegmentOverride={isStorySegmentOverride}
            segmentId={segmentId}
          />
        );
        break;
      case 'WebGlLayer':
        LayerSymbology = (
          <TiffRendering
            model={model}
            okSignalPromise={okSignalPromise}
            layerId={selectedLayer}
            isStorySegmentOverride={isStorySegmentOverride}
            segmentId={segmentId}
          />
        );
        break;
      default:
        LayerSymbology = <div>Layer Type Not Supported</div>;
    }
    setComponentToRender(LayerSymbology);
  }, [selectedLayer]);

  return <>{componentToRender}</>;
};

export class SymbologyWidget extends Dialog<boolean> {
  private okSignal: Signal<SymbologyWidget, null>;

  constructor(options: ISymbologyWidgetOptions) {
    const okSignalPromise = new PromiseDelegate<
      Signal<SymbologyWidget, null>
    >();

    const body = (
      <SymbologyDialog
        model={options.model}
        okSignalPromise={okSignalPromise}
        isStorySegmentOverride={options.isStorySegmentOverride}
        segmentId={options.segmentId}
      />
    );

    super({ title: 'Symbology', body });

    this.id = 'jupytergis::symbologyWidget';
    this.okSignal = new Signal(this);

    okSignalPromise.resolve(this.okSignal);

    this.addClass('jp-gis-symbology-dialog');
  }

  resolve(index: number): void {
    if (index === 1) {
      // Emit signal to let symbology components save
      this.okSignal.emit(null);
    }

    super.resolve(index);
  }
}

export default SymbologyWidget;
