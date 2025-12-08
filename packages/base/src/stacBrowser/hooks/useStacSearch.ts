import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { useCallback, useEffect, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import {
  IStacItem,
  IStacLink,
  IStacQueryBody,
  IStacSearchResult,
} from '../types/types';

interface IUseStacSearchProps {
  model: IJupyterGISModel | undefined;
  setResults: (
    results: IStacItem[],
    isLoading: boolean,
    totalResults: number,
  ) => void;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
  registerAddToMap: (addFn: (stacData: IStacItem) => void) => void;
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
    buildQuery: () => IStacQueryBody,
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
  registerAddToMap,
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

  // Core submit function - accepts a query builder function and initiates the query
  const executeQuery = useCallback(
    async (buildQuery: () => IStacQueryBody, apiUrl: string) => {
      if (!model) {
        return;
      }

      const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];
      const queryBody = buildQuery();

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
        setResults([], true, 0);

        const data = (await fetchWithProxies(
          apiUrl,
          model,
          async response => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 0);
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
        if (data.context) {
          totalResults = data.context.matched;
        }

        // Update context with results (using 0 for totalPages/currentPage as placeholders)
        setResults(sortedFeatures, false, totalResults);

        // Store pagination links
        if (data.links) {
          const typedLinks = data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >;
          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 0);
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
        setResults([], true, 0);

        const data = (await fetchWithProxies(
          link.href,
          model,
          async response => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 0);
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
        if (data.context) {
          totalResults = data.context.matched;
        }

        // Update context with results (using 0 for totalPages/currentPage as placeholders)
        setResults(sortedFeatures, false, totalResults);

        // Store pagination links
        if (data.links) {
          const typedLinks = data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >;
          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 0);
      }
    },
    [model, setResults, setPaginationLinks],
  );

  /**
   * Adds a STAC item to the map
   * @param stacData - STAC item to add
   */
  const addToMap = useCallback(
    (stacData: IStacItem): void => {
      if (!model) {
        return;
      }

      const layerId = UUID.uuid4();
      const layerModel: IJGISLayer = {
        type: 'StacLayer',
        parameters: { data: stacData },
        visible: true,
        name: stacData.properties?.title ?? stacData.id,
      };

      model.addLayer(layerId, layerModel);
    },
    [model],
  );

  // Register addToMap with context
  useEffect(() => {
    registerAddToMap(addToMap);
  }, [addToMap, registerAddToMap]);

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
