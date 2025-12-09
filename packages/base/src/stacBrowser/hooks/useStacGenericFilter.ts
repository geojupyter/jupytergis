import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { endOfToday, startOfToday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { fetchWithProxies } from '@/src/tools';
import { useStacSearch } from './useStacSearch';
import { useStacResultsContext } from '../context/StacResultsContext';
import {
  IStacCollection,
  IStacItem,
  IStacLink,
  IStacQueryBody,
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

interface IUseStacGenericFilterProps {
  model?: IJupyterGISModel;
  baseUrl: string;
  limit?: number;
  setResults: (
    results: IStacItem[],
    isLoading: boolean,
    totalResults: number,
    totalPages: number,
  ) => void;
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
  baseUrl,
  limit = 12,
  setResults,
  setPaginationLinks,
  registerFetchUsingLink,
  registerAddToMap,
}: IUseStacGenericFilterProps) {
  // Get temporal/spatial filters and fetch functions from useStacSearch
  const {
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    currentBBox,
    useWorldBBox,
    setUseWorldBBox,
    fetchUsingLink,
  } = useStacSearch({
    model,
    setResults,
    setPaginationLinks,
    registerAddToMap,
  });

  const { registerBuildQuery, executeQuery } = useStacResultsContext();

  const [queryableProps, setQueryableProps] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  // ! temp
  const [selectedCollection, setSelectedCollection] =
    useState('sentinel-2-l2a');
  const [queryableFilters, setQueryableFilters] = useState<
    Record<string, IQueryableFilter>
  >({});
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('and');

  // Reset all state when URL changes
  useEffect(() => {
    setQueryableProps(undefined);
    setCollections([]);
    setSelectedCollection('sentinel-2-l2a');
    setQueryableFilters({});
    setFilterOperator('and');
    // Reset temporal/spatial filters
    setStartTime(undefined);
    setEndTime(undefined);
    setUseWorldBBox(false);
  }, [baseUrl, setStartTime, setEndTime, setUseWorldBBox]);

  // for collections
  useEffect(() => {
    if (!model) {
      return;
    }

    const fatch = async () => {
      const collectionsUrl = baseUrl.endsWith('/')
        ? `${baseUrl}collections`
        : `${baseUrl}/collections`;
      const data = await fetchWithProxies(
        collectionsUrl,
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
      // Set first collection as default if available
      if (collections.length > 0) {
        setSelectedCollection(collections[0].id);
      }
    };

    fatch();
  }, [model, baseUrl]);

  // for queryables
  // should listen for colletion changes and requery
  // need a way to handle querying multiple collections without refetching everything
  // collection id -> queryables map as a basic cache thing??
  useEffect(() => {
    if (!model) {
      return;
    }

    const fatch = async () => {
      console.log('hittin dem queries boiiii')
      const queryablesUrl = baseUrl.endsWith('/')
        ? `${baseUrl}queryables`
        : `${baseUrl}/queryables`;
      const data = await fetchWithProxies(
        queryablesUrl,
        model,
        async response => await response.json(),
        undefined,
        'internal',
      );

      setQueryableProps(Object.entries(data.properties));
    };

    fatch();
  }, [model, baseUrl]);

  const updateQueryableFilter = useCallback(
    (qKey: string, filter: IQueryableFilter) => {
      setQueryableFilters(prev => ({
        ...prev,
        [qKey]: filter,
      }));
    },
    [],
  );

  /**
   * Builds Copernicus-specific query
   */
  const buildCopernicusQuery = useCallback((): IStacQueryBody => {
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

    return body as IStacQueryBody;
  }, [
    startTime,
    endTime,
    currentBBox,
    selectedCollection,
    limit,
    queryableFilters,
    filterOperator,
  ]);

  /**
   * Handles form submission - builds query and fetches results
   */
  // Register buildQuery with context
  useEffect(() => {
    registerBuildQuery(() => buildCopernicusQuery());
  }, [registerBuildQuery, buildCopernicusQuery, baseUrl]);

  const handleSubmit = useCallback(async () => {
    if (!model) {
      return;
    }

    // Use executeQuery from context to initiate the query
    await executeQuery();
  }, [model, executeQuery]);

  // Register fetchUsingLink from useStacSearch with context so handlers can use it
  useEffect(() => {
    registerFetchUsingLink(fetchUsingLink);
  }, [fetchUsingLink, registerFetchUsingLink]);

  // Register addToMap function - useStacSearch registers it, but we need to ensure
  // it's re-registered when URL changes (since addToMapRef gets cleared in setSelectedUrl)
  // We create our own addToMap here to ensure it's always registered
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
  }, [addToMap, registerAddToMap, baseUrl]);

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
