import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { endOfToday, startOfToday } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import useStacSearch from './useStacSearch';
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
}

export function useStacGenericFilter({
  model,
  limit = 12,
  setResults,
  results,
}: IUseStacGenericFilterProps) {
  const {
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    paginationLinks,
    setPaginationLinks,
  } = useStacSearch({ model });

  // Use a ref to always access the latest paginationLinks value
  const paginationLinksRef = useRef(paginationLinks);
  useEffect(() => {
    paginationLinksRef.current = paginationLinks;
  }, [paginationLinks]);

  const [queryableProps, setQueryableProps] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  // ! temp
  const [selectedCollection, setSelectedCollection] =
    useState('sentinel-2-l2a');
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
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

      console.log('collections', collections);
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
    if (!model) {
      return;
    }

    const layerId = UUID.uuid4();

    if (!stacData) {
      console.error('Result not found:');
      return;
    }

    console.log('adding', layerId);

    // const layerModel: IJGISLayer = {
    //   type: 'StacLayer',
    //   parameters: { data: stacData },
    //   visible: true,
    //   name: stacData.properties.title ?? stacData.id,
    // };

    // model.addLayer(layerId, layerModel);
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

    setCurrentPage(1);

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

    console.log('body', body);

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
      setIsLoading(true);
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
        console.debug('STAC search failed -- no results found');
        setResults([], false, 1, currentPage, 0);
        setTotalPages(1);
        setTotalResults(0);
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

      console.log('hook data', data);
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

      setTotalPages(calculatedTotalPages);
      setTotalResults(calculatedTotalResults);

      // Update context with results
      setResults(
        sortedFeatures,
        false,
        calculatedTotalPages,
        currentPage,
        calculatedTotalResults,
      );

      // Store pagination links for use in handlePaginationClick
      if (data.links) {
        setPaginationLinks(
          data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >,
        );
      }

      // Add first result to map
      if (data.features.length > 0) {
        addToMap(data.features[0]);
      }
    } catch (error) {
      console.error('STAC search failed -- error fetching data:', error);
      setResults([], false, 1, currentPage, 0);
      setTotalPages(1);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles clicking on a result item
   * @param id - ID of the clicked result
   */
  const handleResultClick = useCallback(
    async (id: string): Promise<void> => {
      if (!model) {
        return;
      }

      const result = results.find((r: IStacItem) => r.id === id);
      if (result) {
        addToMap(result);
      }
    },
    [results, model],
  );

  /**
   * Fetches results using a STAC link (for pagination)
   * @param link - STAC link object with href and optional body
   */
  const fetchUsingLink = async (
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
      setIsLoading(true);
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
        console.debug('STAC search failed -- no results found');
        setResults([], false, 1, currentPage, 0);
        setTotalPages(1);
        setTotalResults(0);
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

                if (roles.includes('thumbnail') || roles.includes('overview')) {
                  filteredAssets[key] = asset;
                }
              }
            }

            feature.assets = filteredAssets;
          }
        });
      }

      console.log('hook data link', data);
      // Sort features by id before setting results
      const sortedFeatures = [...data.features].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      console.log('[useStacGenericFilter] Setting results from pagination:', {
        featuresCount: sortedFeatures.length,
        featureIds: sortedFeatures.map(f => f.id),
      });

      // Handle context if available (STAC API extension)
      let calculatedTotalPages = 1;
      let calculatedTotalResults = data.features.length;
      if (data.context) {
        const pages = data.context.matched / data.context.limit;
        calculatedTotalPages = Math.ceil(pages);
        calculatedTotalResults = data.context.matched;
      }

      setTotalPages(calculatedTotalPages);
      setTotalResults(calculatedTotalResults);

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
        setPaginationLinks(
          data.links as Array<
            IStacLink & { method?: string; body?: Record<string, any> }
          >,
        );
      }
    } catch (error) {
      console.error('STAC search failed -- error fetching data:', error);
      setResults([], false, 1, currentPage, 0);
      setTotalPages(1);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles pagination clicks
   * @param dir - Direction ('next' | 'previous') or page number (for backward compatibility)
   */
  const handlePaginationClick = async (
    dir: 'next' | 'previous' | number,
  ): Promise<void> => {
    console.log('[useStacGenericFilter] Pagination click:', {
      dir,
      currentPage,
      availableLinks: paginationLinksRef.current.map(l => l.rel),
    });
    if (!model) {
      return;
    }

    // If dir is a number, convert it to 'next' or 'previous' based on current page
    let rel: 'next' | 'previous';
    if (typeof dir === 'number') {
      rel = dir > currentPage ? 'next' : 'previous';
    } else {
      rel = dir;
    }

    // Use ref to get the latest paginationLinks value
    const link = paginationLinksRef.current.find(l => l.rel === rel);

    if (link && link.body) {
      console.log('[useStacGenericFilter] Found pagination link:', {
        rel: link.rel,
        href: link.href,
        hasBody: !!link.body,
      });
      // Use the link with its body (contains token) to fetch the page
      await fetchUsingLink(link);
      // Update current page after successful fetch if dir was a number
      if (typeof dir === 'number') {
        setCurrentPage(dir);
      }
    } else {
      // If no link found, we can't paginate
      console.warn(
        `[useStacGenericFilter] No ${rel} link available for pagination`,
      );
    }
  };

  /**
   * Formats a result item for display
   * @param item - STAC item to format
   * @returns Formatted string representation of the item
   */
  const formatResult = useCallback((item: IStacItem): string => {
    return item.properties?.title ?? item.id;
  }, []);

  return {
    queryableProps,
    collections,
    selectedCollection,
    setSelectedCollection,
    handleSubmit,
    isLoading,
    totalPages,
    currentPage,
    totalResults,
    handlePaginationClick,
    handleResultClick,
    formatResult,
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
    paginationLinks,
  };
}
