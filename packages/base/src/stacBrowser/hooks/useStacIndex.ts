import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';

export interface IStacIndexCatalog {
  id: number;
  url: string;
  slug: string;
  title: string;
  summary: string;
  access: string;
  created: string;
  updated: string;
  isPrivate: boolean;
  isApi: boolean;
  accessInfo: string | null;
}

export type IStacIndexCatalogs = IStacIndexCatalog[];

interface IUseStacIndexReturn {
  catalogs: IStacIndexCatalogs;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for fetching STAC catalogs from stacindex.org API
 * @param model - JupyterGIS model for proxy configuration
 * @returns Object containing catalogs list, loading state, and error
 */
const useStacIndex = (
  model: IJupyterGISModel | undefined,
): IUseStacIndexReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [catalogs, setCatalogs] = useState<IStacIndexCatalogs>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!model) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetchWithProxies('https://stacindex.org/api/catalogs', model, async r => r.json())
      .then(data => {
        setCatalogs(data);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load catalogs.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [model]);

  return { catalogs, isLoading, error };
};

export default useStacIndex;
