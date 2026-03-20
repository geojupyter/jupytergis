import { WidgetProps } from '@rjsf/utils';
import React, { ChangeEvent, useState } from 'react';

import { WMS_AVAILABLE_LAYERS_CACHE } from '@/src/formbuilder/objectform/source';
import { Button } from '@/src/shared/components/Button';
import { Input } from '@/src/shared/components/Input';
import { GlobalStateDbManager } from '@/src/store';
import { fetchWithProxies } from '@/src/tools';
import type { IJupyterGISFormContext, IWmsLayerInfo } from '@/src/types';

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
  const context = formContext as IJupyterGISFormContext | undefined;
  const model = context?.model;
  const layers = context?.wmsAvailableLayers ?? [];
  const setWmsAvailableLayers = context?.setWmsAvailableLayers;
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();
  const text = !value ? '' : String(value);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleConnect = async () => {
    if (!model || !setWmsAvailableLayers) {
      return null;
    }

    setIsLoading(true);
    setError(undefined);

    const slash = text.endsWith('/') ? '' : '/';
    const url = `${text}${slash}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;

    try {
      if (stateDb) {
        const cacheKey = `${WMS_AVAILABLE_LAYERS_CACHE}:${text}`;
        const cached = (await stateDb.fetch(cacheKey)) as
          | IWmsLayerInfo[]
          | undefined;

        if (cached && cached.length > 0) {
          setWmsAvailableLayers(cached);
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
      const layerEls = Array.from(
        rootLayer?.querySelectorAll(':scope > Layer') ?? [],
      );

      const parsed = layerEls
        .map(layerEl => {
          const name = layerEl.querySelector('Name')?.textContent?.trim() ?? '';
          const title =
            layerEl.querySelector('Title')?.textContent?.trim() ?? name;

          return { name, title };
        })
        .filter(layer => layer.name !== '' || layer.title !== '');

      setWmsAvailableLayers(parsed);

      if (stateDb) {
        const cacheKey = `${WMS_AVAILABLE_LAYERS_CACHE}:${text}`;
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
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          margin: '0 7px',
        }}
      >
        <Input
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
          style={{ flexGrow: 1 }}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? 'Connecting…' : 'Connect'}
        </Button>
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
