import { IJupyterGISModel, IMapAdapterType } from '@jupytergis/schema';
import { Dialog, ReactWidget, showDialog } from '@jupyterlab/apputils';
import * as React from 'react';

import { DEFAULT_MAP_ADAPTER } from '@/src/mainview/mapAdapter';
import {
  MAP_ADAPTER_FEATURES,
  getLayersUnsupportedBy,
  getSupportTable,
} from '@/src/mainview/mapAdapterFeatures';

const RENDERERS = Object.keys(MAP_ADAPTER_FEATURES) as IMapAdapterType[];

interface IMapRendererProps {
  model: IJupyterGISModel;
  current: IMapAdapterType;
  selected: IMapAdapterType;
  onSelect: (type: IMapAdapterType) => void;
}

function MapRendererDialog(props: IMapRendererProps): JSX.Element {
  const { model, current, selected, onSelect } = props;
  const table = React.useMemo(() => getSupportTable(), []);
  const skipped = React.useMemo(
    () => getLayersUnsupportedBy(model, selected),
    [model, selected],
  );
  const name = (type: IMapAdapterType) => MAP_ADAPTER_FEATURES[type].name;
  return (
    <div
      style={{
        width: 'min(680px, 80vw)',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}
    >
      <div
        role="radiogroup"
        aria-label="Map renderer"
        style={{ marginBottom: 12 }}
      >
        {RENDERERS.map(type => (
          <label key={type} style={{ display: 'block', margin: '4px 0' }}>
            <input
              type="radio"
              name="jgis-map-renderer"
              checked={selected === type}
              onChange={() => onSelect(type)}
            />{' '}
            {name(type)}
            {type === current ? ' (current)' : ''}
          </label>
        ))}
      </div>

      {selected !== current && skipped.length > 0 && (
        <p style={{ color: 'var(--jp-warn-color1)' }}>
          Switching to {name(selected)} will skip {skipped.length} layer
          {skipped.length > 1 ? 's' : ''}: {skipped.map(s => s.name).join(', ')}
          .
        </p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Feature</th>
            {RENDERERS.map(type => (
              <th key={type}>{name(type)}</th>
            ))}
          </tr>
        </thead>
        {table.map(group => (
          <tbody key={group.title}>
            <tr>
              <th
                colSpan={RENDERERS.length + 1}
                style={{ textAlign: 'left', paddingTop: 24, paddingBottom: 8 }}
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                {RENDERERS.map(type => (
                  <td key={type} style={{ textAlign: 'center' }}>
                    <span
                      aria-label={
                        r.support[type] ? 'Supported' : 'Not supported'
                      }
                      title={r.support[type] ? 'Supported' : 'Not supported'}
                    >
                      {r.support[type] ? '🗸' : '🗶'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

class MapRendrerBody
  extends ReactWidget
  implements Dialog.IBodyWidget<IMapAdapterType>
{
  private _model: IJupyterGISModel;
  private _current: IMapAdapterType;
  private _selected: IMapAdapterType;

  constructor(model: IJupyterGISModel, current: IMapAdapterType) {
    super();
    this._model = model;
    this._current = current;
    this._selected = current;
  }

  getValue(): IMapAdapterType {
    return this._selected;
  }

  protected render(): JSX.Element {
    return (
      <MapRendererDialog
        model={this._model}
        current={this._current}
        selected={this._selected}
        onSelect={type => {
          this._selected = type;
          this.update();
        }}
      />
    );
  }
}

export async function showMapRendererDialog(
  model: IJupyterGISModel,
): Promise<void> {
  const current = model.getOptions().mapAdapter ?? DEFAULT_MAP_ADAPTER;
  const body = new MapRendrerBody(model, current);
  const result = await showDialog({
    title: 'Select map renderer',
    body,
    buttons: [
      Dialog.cancelButton({ label: 'NeverMind' }),
      Dialog.okButton({ label: 'Apply' }),
    ],
  });

  if (!result.button.accept || !result.value || result.value === current) {
    return;
  }

  model.setOptions({
    ...model.getOptions(),
    mapAdapter: result.value,
    pitch: 0,
  });
}
