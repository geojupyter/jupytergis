import { IJupyterGISModel } from '@jupytergis/schema';
import { WidgetProps } from '@rjsf/utils';
import React, { useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import { GlobalStateDbManager } from '@/src/store';

interface ILayerSelectFormContext {
  model?: IJupyterGISModel;
  wmsAvailableLayers?: IWmsLayerInfo[];
  setWmsAvailableLayers?: (layers: IWmsLayerInfo[]) => void;
}

interface IWmsLayerInfo {
  name: string;
  title: string;
}

export function WmsTileSourceUrlInput(
  props: WidgetProps<string>,
): React.ReactElement {
  const {
    value,
    formContext,
    onChange,
    id,
    name,
    onBlur,
    onFocus,
    disabled,
    readonly,
  } = props;
  const context = formContext as ILayerSelectFormContext | undefined;
  const model = context?.model;
  const setWmsAvailableLayers = context?.setWmsAvailableLayers;
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  const text = value == null ? '' : String(value);
  const layers = context?.wmsAvailableLayers ?? [];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleConnect = async () => {
    if (!model) {
      return null;
    }
    // https://ows.terrestris.de/osm/service?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities

    setIsLoading(true);
    setError(undefined);

    const url = `${text}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

    try {
      if (stateDb) {
        const cacheKey = `jgis:wmsTileSource:availableLayers:${text}`;
        const cached = (await stateDb.fetch(cacheKey)) as
          | Array<IWmsLayerInfo>
          | undefined;

        if (Array.isArray(cached) && cached.length > 0) {
          setWmsAvailableLayers?.(cached);
          return;
        }
      }

      const xmlText = await fetchWithProxies(url, model, (response: Response) =>
        response.text(),
      );
      const xml = typeof xmlText === 'string' ? xmlText : '';
      const doc = new DOMParser().parseFromString(xml, 'text/xml');

      const hasParseError = Boolean(doc.querySelector('parsererror'));
      const serviceException = doc.querySelector('ServiceExceptionReport');
      if (hasParseError || serviceException) {
        setError(
          serviceException?.textContent?.trim() ??
            'Failed to parse WMS GetCapabilities XML.',
        );
        return;
      }

      const rootLayer = doc.querySelector('Capability > Layer');
      const layerEls = Array.from(rootLayer?.querySelectorAll(':scope > Layer') ?? []);

      const parsed = layerEls
        .map(layerEl => {
          const name = layerEl.querySelector('Name')?.textContent?.trim() ?? '';
          const title =
            layerEl.querySelector('Title')?.textContent?.trim() ?? name;

          return { name, title };
        })
        .filter(layer => layer.name !== '' || layer.title !== '');

      setWmsAvailableLayers?.(parsed);

      if (stateDb) {
        const cacheKey = `jgis:wmsTileSource:availableLayers:${text}`;
        await stateDb.save(cacheKey, parsed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          id={id}
          name={name}
          type="text"
          value={text}
          onChange={handleChange}
          onBlur={e => onBlur(id, e.target.value)}
          onFocus={e => onFocus(id, e.target.value)}
          disabled={disabled}
          readOnly={readonly}
          placeholder="Enter WMS URL"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={handleConnect} disabled={isLoading}>
          {isLoading ? 'Connecting…' : 'Connect'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: '0.5rem', color: 'var(--jp-error-color1)' }}>
          {error}
        </div>
      )}
      {layers.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {layers.length} layer(s) found. Choose one in the `params.layers`
          dropdown.
        </div>
      )}
    </>
  );
}
