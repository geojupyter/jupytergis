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
    (async () => {
      if (!model) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const data = (await fetchWithProxies(
          'https://stacindex.org/api/catalogs',
          model,
          async response => await response.json(),
          undefined,
          'internal',
        )) as IStacIndexCatalogs;

        setCatalogs(data || []);
      } catch (error) {
        console.error('Error fetching STAC catalogs:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to fetch catalogs',
        );
        setCatalogs([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [model]);

  return { catalogs, isLoading, error };
};

export default useStacIndex;
