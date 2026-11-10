import {
  IDict,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  LayerType,
  SourceType,
} from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

import { FollowMirrorContext } from '@/src/features/follow/useFollowedState';
import { CreationForm } from '@/src/shared/formbuilder';

export type DeckGlLayerChoice = 'Trips' | 'Polygon' | 'GeoJSON';

export interface IDeckGlLayerPreset {
  label: DeckGlLayerChoice;
  sourceType: SourceType;
  layerType: LayerType;
  layerName: string;
}

export const DECK_GL_LAYER_PRESETS: readonly IDeckGlLayerPreset[] = [
  {
    label: 'Trips',
    sourceType: 'TripsSource',
    layerType: 'TripsLayer',
    layerName: 'Custom Trips Layer',
  },
  {
    label: 'Polygon',
    sourceType: 'PolygonSource',
    layerType: 'PolygonLayer',
    layerName: 'Custom Polygon Layer',
  },
  {
    label: 'GeoJSON',
    sourceType: 'GeoJSONSource',
    layerType: 'GeoJsonLayer',
    layerName: 'Custom GeoJSON Layer',
  },
] as const;

export function presetForChoice(choice: DeckGlLayerChoice): IDeckGlLayerPreset {
  const preset = DECK_GL_LAYER_PRESETS.find(item => item.label === choice);
  if (!preset) {
    return DECK_GL_LAYER_PRESETS[0];
  }
  return preset;
}

interface IDeckGlCreationFormProps {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  cancel: () => void;
  formErrorSignal?: Signal<Dialog<any>, boolean>;
  registerConfirmHandler?: (fn: () => void) => void;
  dialogOptions?: any;
  initialChoice?: DeckGlLayerChoice;
}

/**
 * DeckGL layer creation: type dropdown owned by React; source/layer RJSF forms
 * remount when the selection changes.
 */
export function DeckGlCreationForm(
  props: IDeckGlCreationFormProps,
): React.ReactElement {
  const {
    model,
    formSchemaRegistry,
    cancel,
    formErrorSignal,
    registerConfirmHandler,
    dialogOptions,
    initialChoice = 'Trips',
  } = props;

  const [choice, setChoice] = React.useState<DeckGlLayerChoice>(initialChoice);
  const preset = presetForChoice(choice);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="jgis-deckgl-layer-type"
          style={{ display: 'block', marginBottom: 4 }}
        >
          DeckGL layer type
        </label>
        <select
          id="jgis-deckgl-layer-type"
          value={choice}
          onChange={event => setChoice(event.target.value as DeckGlLayerChoice)}
          style={{ minWidth: 200 }}
        >
          {DECK_GL_LAYER_PRESETS.map(item => (
            <option key={item.label} value={item.label}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <CreationForm
        key={preset.layerType}
        model={model}
        formSchemaRegistry={formSchemaRegistry}
        createLayer={true}
        createSource={true}
        layerType={preset.layerType}
        sourceType={preset.sourceType}
        layerData={{ name: preset.layerName }}
        cancel={cancel}
        formErrorSignal={formErrorSignal}
        dialogOptions={dialogOptions}
        registerConfirmHandler={registerConfirmHandler}
      />
    </div>
  );
}

export interface IDeckGlLayerCreationDialogOptions {
  model: IJupyterGISModel;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  title?: string;
  followMirror?: boolean;
  initialChoice?: DeckGlLayerChoice;
}

export class DeckGlLayerCreationFormDialog extends Dialog<IDict> {
  constructor(options: IDeckGlLayerCreationDialogOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    let confirmHandler: (() => void) | null = null;
    const registerConfirmHandler = (fn: () => void) => {
      confirmHandler = fn;
    };

    const formErrorSignalPromise = new PromiseDelegate<
      Signal<Dialog<any>, boolean>
    >();

    const body = (
      <FollowMirrorContext.Provider value={!!options.followMirror}>
        <div style={{ overflow: 'auto' }}>
          <DeckGlCreationFormBody
            model={options.model}
            formSchemaRegistry={options.formSchemaRegistry}
            cancel={cancelCallback}
            formErrorSignalPromise={formErrorSignalPromise}
            dialogOptions={options}
            registerConfirmHandler={registerConfirmHandler}
            initialChoice={options.initialChoice}
          />
        </div>
      </FollowMirrorContext.Provider>
    );

    super({
      title: options.title ?? 'Create DeckGL Layer',
      body,
      buttons: [Dialog.cancelButton(), Dialog.okButton()],
    });

    this._getConfirmHandler = () => confirmHandler;
    const formErrorSignal = new Signal<Dialog<any>, boolean>(this);

    formErrorSignal.connect((_, extraErrors) => {
      const invalid = extraErrors || !!this.node.querySelector(':invalid');
      const accept = this.node.getElementsByClassName('jp-mod-accept')[0];
      if (!accept) {
        return;
      }
      if (invalid) {
        accept.setAttribute('disabled', '');
      } else {
        accept.removeAttribute('disabled');
      }
    });

    formErrorSignalPromise.resolve(formErrorSignal);
    this.addClass('jGIS-layer-CreationFormDialog');
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this._getConfirmHandler()?.();
      super.resolve(index);
    }
  }

  private _getConfirmHandler: () => (() => void) | null;
}

interface IDeckGlCreationFormBodyProps extends IDeckGlCreationFormProps {
  formErrorSignalPromise: PromiseDelegate<Signal<Dialog<any>, boolean>>;
}

function DeckGlCreationFormBody(
  props: IDeckGlCreationFormBodyProps,
): React.ReactElement | null {
  const [ready, setReady] = React.useState(false);
  const formErrorSignal = React.useRef<Signal<Dialog<any>, boolean>>();

  React.useEffect(() => {
    void props.formErrorSignalPromise.promise.then(signal => {
      formErrorSignal.current = signal;
      setReady(true);
    });
  }, [props.formErrorSignalPromise]);

  if (!ready) {
    return null;
  }

  return (
    <DeckGlCreationForm
      model={props.model}
      formSchemaRegistry={props.formSchemaRegistry}
      cancel={props.cancel}
      formErrorSignal={formErrorSignal.current}
      registerConfirmHandler={props.registerConfirmHandler}
      dialogOptions={props.dialogOptions}
      initialChoice={props.initialChoice}
    />
  );
}
