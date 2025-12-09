import { IJupyterGISModel } from '@jupytergis/schema';
import { useCallback, useEffect, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import {
  IStacItem,
  IStacLink,
  IStacQueryBody,
  IStacSearchResult,
  SetResultsFunction,
} from '../types/types';

interface IUseStacSearchProps {
  model: IJupyterGISModel | undefined;
  setResults: SetResultsFunction;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
}

interface IUseStacSearchReturn {
  // Temporal and spatial filters
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
  currentBBox: [number, number, number, number];
  setCurrentBBox: (bbox: [number, number, number, number]) => void;
  useWorldBBox: boolean;
  setUseWorldBBox: (val: boolean) => void;
  // Core fetch functions
  executeQuery: (
    body: IStacQueryBody,
    apiUrl: string,
  ) => Promise<void>;
  fetchUsingLink: (
    link: IStacLink & { method?: string; body?: Record<string, any> },
  ) => Promise<void>;
}

/**
 * Central hook for managing STAC search - handles temporal/spatial filters,
 * core fetching, pagination, and context management
 * @param props - Configuration object containing model and context setters
 * @returns Object containing filter state and core fetch functions
 */
export function useStacSearch({
  model,
  setResults,
  setPaginationLinks,
}: IUseStacSearchProps): IUseStacSearchReturn {
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState<Date | undefined>(undefined);
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);
  const [useWorldBBox, setUseWorldBBox] = useState(false);

  // Listen for model updates to get current bounding box
  useEffect(() => {
    const listenToModel = (
      _sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number],
    ) => {
      if (useWorldBBox) {
        setCurrentBBox([-180, -90, 180, 90]);
      } else {
        setCurrentBBox(bBoxIn4326);
      }
    };

    model?.updateBboxSignal.connect(listenToModel);

    return () => {
      model?.updateBboxSignal.disconnect(listenToModel);
    };
  }, [model, useWorldBBox]);

  // Core submit function - accepts a query body and initiates the query
  const executeQuery = useCallback(
    async (body: IStacQueryBody, apiUrl: string) => {
      if (!model) {
        return;
      }

      const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];
      const queryBody = body;

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': XSRF_TOKEN,
          credentials: 'include',
        },
        body: JSON.stringify(queryBody),
      };

      try {
        // Update context with loading state
        setResults([], true, 0, 0);

        const data = (await fetchWithProxies(
          apiUrl,
          model,
          async response => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 0, 0);
          return;
        }

        // Filter assets to only include items with 'overview' or 'thumbnail' roles
        if (data.features && data.features.length > 0) {
          data.features.forEach(feature => {
            if (feature.assets) {
              const originalAssets = feature.assets;
              const filteredAssets: Record<string, any> = {};

              for (const [key, asset] of Object.entries(originalAssets)) {
                if (
                  asset &&
                  typeof asset === 'object' &&
                  'roles' in asset &&
                  Array.isArray(asset.roles)
                ) {
                  const roles = asset.roles;

                  if (
                    roles.includes('thumbnail') ||
                    roles.includes('overview')
                  ) {
                    filteredAssets[key] = asset;
                  }
                }
              }

              feature.assets = filteredAssets;
            }
          });
        }

        // Sort features by id before setting results
        const sortedFeatures = [...data.features].sort((a, b) =>
          a.id.localeCompare(b.id),
        );

        // Calculate total results from context if available
        let totalResults = data.features.length;
        let totalPages = 0;
        if (data.context) {
          totalResults = data.context.matched;
          totalPages = Math.ceil(data.context.matched / data.context.limit);
        } else if (sortedFeatures.length > 0) {
          // If results found but no context, assume 1 page
          totalPages = 1;
        }

        // Update context with results
        setResults(sortedFeatures, false, totalResults, totalPages);

        // Store pagination links
        if (data.links) {
          const typedLinks = data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >;
          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 0, 0);
      }
    },
    [model, setResults, setPaginationLinks],
  );

  // Fetch using pagination link
  const fetchUsingLink = useCallback(
    async (
      link: IStacLink & { method?: string; body?: Record<string, any> },
    ) => {
      if (!model) {
        return;
      }

      const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

      const options = {
        method: (link.method || 'POST').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': XSRF_TOKEN,
          credentials: 'include',
        },
        body: link.body ? JSON.stringify(link.body) : undefined,
      };

      try {
        // Update context with loading state
        setResults([], true, 0, 0);

        const data = (await fetchWithProxies(
          link.href,
          model,
          async response => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 0, 0);
          return;
        }

        // Filter assets to only include items with 'overview' or 'thumbnail' roles
        if (data.features && data.features.length > 0) {
          data.features.forEach(feature => {
            if (feature.assets) {
              const originalAssets = feature.assets;
              const filteredAssets: Record<string, any> = {};

              for (const [key, asset] of Object.entries(originalAssets)) {
                if (
                  asset &&
                  typeof asset === 'object' &&
                  'roles' in asset &&
                  Array.isArray(asset.roles)
                ) {
                  const roles = asset.roles;

                  if (
                    roles.includes('thumbnail') ||
                    roles.includes('overview')
                  ) {
                    filteredAssets[key] = asset;
                  }
                }
              }

              feature.assets = filteredAssets;
            }
          });
        }

        // Sort features by id before setting results
        const sortedFeatures = [...data.features].sort((a, b) =>
          a.id.localeCompare(b.id),
        );

        // Calculate total results from context if available
        let totalResults = data.features.length;
        let totalPages = 0;
        if (data.context) {
          totalResults = data.context.matched;
          totalPages = Math.ceil(data.context.matched / data.context.limit);
        } else if (sortedFeatures.length > 0) {
          // If results found but no context, assume 1 page
          totalPages = 1;
        }

        // Update context with results
        setResults(sortedFeatures, false, totalResults, totalPages);

        // Store pagination links
        if (data.links) {
          const typedLinks = data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >;
          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 0, 0);
      }
    },
    [model, setResults, setPaginationLinks],
  );


  return {
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    currentBBox,
    setCurrentBBox,
    useWorldBBox,
    setUseWorldBBox,
    executeQuery,
    fetchUsingLink,
  };
}
