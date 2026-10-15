import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { WidgetProps } from '@rjsf/utils';
import React, { useEffect, useRef, useState } from 'react';

import {
  detectVectorTileLayers,
  resolveTileUrlTemplate,
} from '@/src/shared/detectVectorTileLayers';
import { buildProxyUrl } from '@/src/shared/tileProxy';

interface ISourceLayerFieldProps extends WidgetProps {
  model: IJupyterGISModel;
  /** Latest form values (url, urlParameters, zoom range, proxy settings). */
  getSource: () => IDict;
}

export function SourceLayerField(props: ISourceLayerFieldProps): JSX.Element {
  const { id, value, onChange, disabled, readonly, model, getSource } = props;

  const [detecting, setDetecting] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController>();

  useEffect(() => () => abortRef.current?.abort(), []);

  const detect = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const source = getSource();
    setDetecting(true);
    setError(undefined);

    try {
      const { longitude, latitude, zoom } = model.getOptions();
      const names = await detectVectorTileLayers({
        url: resolveTileUrlTemplate(source),
        minZoom: source.minZoom,
        maxZoom: source.maxZoom,
        view:
          longitude !== undefined &&
          latitude !== undefined &&
          zoom !== undefined
            ? { longitude, latitude, zoom }
            : undefined,
        signal: controller.signal,
        fetchTile: source.useProxy
          ? tileUrl =>
              fetch(buildProxyUrl(model, tileUrl, source.useProxy, source.httpHeaders), {
                signal: controller.signal,
              })
          : undefined,
      });

      if (controller.signal.aborted) {
        return;
      }
      setCandidates(names);
      if (names.length === 1) {
        onChange(names[0]);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setCandidates([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (!controller.signal.aborted) {
        setDetecting(false);
      }
    }
  };

  const inactive = disabled || readonly;

  return (
    <div className="jgis-source-layer-field">
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          type="text"
          className="form-control"
          value={value ?? ''}
          disabled={inactive}
          onChange={e => onChange(e.target.value)}
        />
        <Button
          className="jp-mod-styled jp-mod-accept"
          onClick={detect}
          disabled={inactive || detecting}
        >
          {detecting ? 'Detecting…' : 'Detect'}
        </Button>
      </div>

      {candidates.length > 1 && (
        <select
          aria-label="Detected source layers"
          className="form-control"
          style={{ marginTop: 6 }}
          value={candidates.includes(value) ? value : ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="" disabled>
            {candidates.length} layers found, pick one…
          </option>
          {candidates.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}

      {error && (
        <div
          role="alert"
          style={{ color: 'var(--jp-error-color1)', marginTop: 6 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
