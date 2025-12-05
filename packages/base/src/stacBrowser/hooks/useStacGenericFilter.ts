import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { endOfToday, startOfToday } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import useStacSearch from './useGeodesSearch';
import {
  IStacCollection,
  IStacItem,
  IStacLink,
  IStacSearchResult,
} from '../types/types';

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;

export type Operator = '=' | '!=' | '<' | '>';

export type FilterOperator = 'and' | 'or';

export interface IQueryableFilter {
  operator: Operator;
  inputValue: string | number | undefined;
}

export type UpdateQueryableFilter = (
  qKey: string,
  filter: IQueryableFilter,
) => void;

const API_URL = 'https://stac.dataspace.copernicus.eu/v1/';

interface IUseStacGenericFilterProps {
  model?: IJupyterGISModel;
  limit?: number;
  setResults: (
    results: IStacItem[],
    isLoading: boolean,
    totalPages: number,
    currentPage: number,
    totalResults: number,
  ) => void;
  results: IStacItem[];
  isLoading: boolean;
  totalPages: number;
  currentPage: number;
  totalResults: number;
  paginationLinks: Array<
    IStacLink & { method?: string; body?: Record<string, any> }
  >;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
  registerFetchUsingLink: (
    fetchFn: (
      link: IStacLink & { method?: string; body?: Record<string, any> },
    ) => Promise<void>,
  ) => void;
  registerAddToMap: (addFn: (stacData: IStacItem) => void) => void;
}

export function useStacGenericFilter({
  model,
  limit = 12,
  setResults,
  results,
  isLoading,
  totalPages,
  currentPage,
  totalResults,
  paginationLinks,
  setPaginationLinks,
  registerFetchUsingLink,
  registerAddToMap,
}: IUseStacGenericFilterProps) {
  const {
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
  } = useStacSearch({ model });

  const [queryableProps, setQueryableProps] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  // ! temp
  const [selectedCollection, setSelectedCollection] =
    useState('sentinel-2-l2a');
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);
  const [queryableFilters, setQueryableFilters] = useState<
    Record<string, IQueryableFilter>
  >({});
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('and');

  // for collections
  useEffect(() => {
    if (!model) {
      return;
    }

    const fatch = async () => {
      const data = await fetchWithProxies(
        API_URL + 'collections',
        model,
        async response => await response.json(),
        undefined,
        'internal',
      );

      const collections: FilteredCollection[] = data.collections
        .map((collection: any) => ({
          title: collection.title ?? collection.id,
          id: collection.id,
        }))
        .sort((a: FilteredCollection, b: FilteredCollection) => {
          const titleA = a.title?.toLowerCase() ?? '';
          const titleB = b.title?.toLowerCase() ?? '';
          return titleA.localeCompare(titleB);
        });

      setCollections(collections);
    };

    fatch();
  }, [model]);

  // for queryables
  // should listen for colletion changes and requery
  // need a way to handle querying multiple collections without refetching everything
  // collection id -> queryables map as a basic cache thing??
  useEffect(() => {
    if (!model) {
      return;
    }

    const fatch = async () => {
      const data = await fetchWithProxies(
        API_URL + 'queryables',
        model,
        async response => await response.json(),
        undefined,
        'internal',
      );

      setQueryableProps(Object.entries(data.properties));
    };

    fatch();
  }, [model]);

  useEffect(() => {
    if (!model) {
      return;
    }

    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number],
    ) => {
      if (useWorldBBox) {
        setCurrentBBox([-180, -90, 180, 90]);
      } else {
        setCurrentBBox(bBoxIn4326);
      }
    };

    model.updateBboxSignal.connect(listenToModel);

    return () => {
      model.updateBboxSignal.disconnect(listenToModel);
    };
  }, [model, useWorldBBox]);

  const addToMap = (stacData: any) => {
    console.log('add to amp');
    if (!model) {
      return;
    }

    const layerId = UUID.uuid4();

    if (!stacData) {
      return;
    }

    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: { data: stacData },
      visible: true,
      name: stacData.properties.title ?? stacData.id,
    };

    model.addLayer(layerId, layerModel);
  };

  const updateQueryableFilter = useCallback(
    (qKey: string, filter: IQueryableFilter) => {
      setQueryableFilters(prev => ({
        ...prev,
        [qKey]: filter,
      }));
    },
    [],
  );

  const handleSubmit = async () => {
    if (!model) {
      return;
    }

    // Reset to page 1
    setResults(results, isLoading, totalPages, 1, totalResults);

    const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

    const st = startTime
      ? startTime.toISOString()
      : startOfToday().toISOString();

    const et = endTime ? endTime.toISOString() : endOfToday().toISOString();

    // Build filter object from queryableFilters
    const filterConditions = Object.entries(queryableFilters)
      .filter(([, filter]) => filter.inputValue !== undefined)
      .map(([property, filter]) => {
        return {
          op: filter.operator,
          args: [
            {
              property,
            },
            filter.inputValue,
          ],
        };
      });

    const body: Record<string, any> = {
      bbox: currentBBox,
      collections: [selectedCollection],
      datetime: `${st}/${et}`,
      limit,
      'filter-lang': 'cql2-json',
    };

    // Only add filter if there are any conditions
    if (filterConditions.length > 0) {
      body.filter = {
        op: filterOperator,
        args: filterConditions,
      };
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRFToken': XSRF_TOKEN,
        credentials: 'include',
      },
      body: JSON.stringify(body),
    };

    try {
      // Update context with loading state
      setResults(results, true, totalPages, currentPage, totalResults);
      const data = (await fetchWithProxies(
        'https://stac.dataspace.copernicus.eu/v1/search',
        model,
        async response => await response.json(),
        //@ts-expect-error Jupyter requires X-XSRFToken header
        options,
        'internal',
      )) as IStacSearchResult;

      if (!data) {
        setResults([], false, 1, currentPage, 0);
        return;
      }

      // Filter assets to only include items with 'overview' or 'thumbnail' roles
      // ? is this a good idea??
      if (data.features && data.features.length > 0) {
        data.features.forEach(feature => {
          if (feature.assets) {
            const originalAssets = feature.assets;
            const filteredAssets: Record<string, any> = {};

            // Iterate through each asset in the assets object
            for (const [key, asset] of Object.entries(originalAssets)) {
              if (
                asset &&
                typeof asset === 'object' &&
                'roles' in asset &&
                Array.isArray(asset.roles)
              ) {
                const roles = asset.roles;

                if (roles.includes('thumbnail') || roles.includes('overview')) {
                  filteredAssets[key] = asset;
                }
              }
            }

            // Replace assets with filtered version
            feature.assets = filteredAssets;
          }
        });
      }

      // Sort features by id before setting results
      const sortedFeatures = [...data.features].sort((a, b) =>
        a.id.localeCompare(b.id),
      );

      // Handle context if available (STAC API extension)
      let calculatedTotalPages = 1;
      let calculatedTotalResults = data.features.length;
      if (data.context) {
        const pages = data.context.matched / data.context.limit;
        calculatedTotalPages = Math.ceil(pages);
        calculatedTotalResults = data.context.matched;
      }

      // Update context with results
      setResults(
        sortedFeatures,
        false,
        calculatedTotalPages,
        currentPage,
        calculatedTotalResults,
      );

      // Store pagination links
      if (data.links) {
        const typedLinks = data.links as Array<
          IStacLink & { method?: string; body?: Record<string, any> }
        >;
        setPaginationLinks(typedLinks);
      }
    } catch (error) {
      setResults([], false, 1, currentPage, 0);
    }
  };

  /**
   * Fetches results using a STAC link (for pagination)
   * @param link - STAC link object with href and optional body
   */
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
        setResults(results, true, totalPages, currentPage, totalResults);
        const data = (await fetchWithProxies(
          link.href,
          model,
          async response => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 1, currentPage, 0);
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

        // Handle context if available (STAC API extension)
        let calculatedTotalPages = 1;
        let calculatedTotalResults = data.features.length;
        if (data.context) {
          const pages = data.context.matched / data.context.limit;
          calculatedTotalPages = Math.ceil(pages);
          calculatedTotalResults = data.context.matched;
        }

        // Update context with results
        setResults(
          sortedFeatures,
          false,
          calculatedTotalPages,
          currentPage,
          calculatedTotalResults,
        );

        // Store pagination links for next pagination
        if (data.links) {
          const typedLinks = data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >;

          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 1, currentPage, 0);
      }
    },
    [
      model,
      results,
      isLoading,
      totalPages,
      currentPage,
      totalResults,
      setResults,
      setPaginationLinks,
    ],
  );

  // Register functions with context so handlers can use them
  useEffect(() => {
    registerFetchUsingLink(fetchUsingLink);
  }, [fetchUsingLink, registerFetchUsingLink]);

  useEffect(() => {
    registerAddToMap(addToMap);
  }, [addToMap, registerAddToMap]);

  return {
    queryableProps,
    collections,
    selectedCollection,
    setSelectedCollection,
    handleSubmit,
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    queryableFilters,
    updateQueryableFilter,
    filterOperator,
    setFilterOperator,
  };
}
