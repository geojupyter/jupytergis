import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import { getLayerMetadata } from '../registry';
import { ILayerMetadata } from '../types';

interface IUseLayerMetadataResult {
  metadata?: ILayerMetadata;
  loading: boolean;
  error?: string;
}

/**
 * Load the metadata for a layer or source.
 *
 * Reading metadata can mean touching the network (a remote COG, a Zarr store),
 * so this only runs when the Metadata tab is actually mounted rather than
 * every time the selection changes.
 */
export function useLayerMetadata(
  model: IJupyterGISModel,
  selectedId?: string,
): IUseLayerMetadataResult {
  const [metadata, setMetadata] = useState<ILayerMetadata | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedId) {
      setMetadata(undefined);
      setLoading(false);
      setError('Select a layer or source to see its information.');
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(undefined);

    getLayerMetadata(model, selectedId)
      .then(result => {
        if (!cancelled) {
          setMetadata(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setMetadata(undefined);
          setError(err?.message ?? String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [model, selectedId]);

  return { metadata, loading, error };
}
