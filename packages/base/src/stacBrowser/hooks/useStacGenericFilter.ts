import { IJupyterGISModel } from '@jupytergis/schema';
import { endOfToday, startOfToday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { GlobalStateDbManager } from '@/src/store';
import { fetchWithProxies } from '@/src/tools';
import { useStacSearch } from './useStacSearch';
import { useStacResultsContext } from '../context/StacResultsContext';
import {
  IStacCollection,
  IStacCollectionsReturn,
  IStacItem,
  IStacPaginationLink,
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

interface IGenericFilterStateStateDb {
  selectedCollection?: string;
  queryableFilters?: Record<
    string,
    { operator: Operator; inputValue: string | number | null }
  >;
  filterOperator?: FilterOperator;
  startTime?: string;
  endTime?: string;
  useWorldBBox?: boolean;
}

const GENERIC_STAC_FILTERS_KEY = 'jupytergis:generic-stac-filters';

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
  setPaginationLinks: (links: IStacPaginationLink[]) => void;
}

export function useStacGenericFilter({
  model,
  baseUrl,
  limit = 12,
  setResults,
  setPaginationLinks,
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
  } = useStacSearch({
    model,
    setResults,
    setPaginationLinks,
  });

  const { registerBuildQuery, executeQuery } = useStacResultsContext();
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  const [queryableProps, setQueryableProps] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  // ! temp
  const [selectedCollection, setSelectedCollection] = useState('');
  const [queryableFilters, setQueryableFilters] = useState<
    Record<string, IQueryableFilter>
  >({});
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('and');

  // On mount, load saved filter state from StateDB (if present)
  useEffect(() => {
    async function loadGenericFilterStateFromDb() {
      const savedFilterState = (await stateDb?.fetch(
        GENERIC_STAC_FILTERS_KEY,
      )) as IGenericFilterStateStateDb | undefined;

      if (savedFilterState) {
        if (savedFilterState.selectedCollection) {
          setSelectedCollection(savedFilterState.selectedCollection);
        }
        if (savedFilterState.queryableFilters) {
          // Convert null back to undefined for inputValue
          const restoredFilters: Record<string, IQueryableFilter> = {};
          Object.entries(savedFilterState.queryableFilters).forEach(
            ([key, filter]) => {
              restoredFilters[key] = {
                operator: filter.operator,
                inputValue:
                  filter.inputValue === null ? undefined : filter.inputValue,
              };
            },
          );
          setQueryableFilters(restoredFilters);
        }
        if (savedFilterState.filterOperator) {
          setFilterOperator(savedFilterState.filterOperator);
        }
        if (savedFilterState.startTime) {
          setStartTime(new Date(savedFilterState.startTime));
        }
        if (savedFilterState.endTime) {
          setEndTime(new Date(savedFilterState.endTime));
        }
        if (savedFilterState.useWorldBBox !== undefined) {
          setUseWorldBBox(savedFilterState.useWorldBBox);
        }
      }
    }

    loadGenericFilterStateFromDb();
  }, [stateDb, setStartTime, setEndTime, setUseWorldBBox]);

  // Save filter state to StateDB on change
  useEffect(() => {
    async function saveGenericFilterStateToDb() {
      // Clean queryableFilters to ensure JSON serialization works
      const cleanedQueryableFilters: Record<
        string,
        { operator: Operator; inputValue: string | number | null }
      > = {};
      Object.entries(queryableFilters).forEach(([key, filter]) => {
        cleanedQueryableFilters[key] = {
          operator: filter.operator,
          inputValue: filter.inputValue ?? null,
        };
      });

      await stateDb?.save(GENERIC_STAC_FILTERS_KEY, {
        selectedCollection: selectedCollection || undefined,
        queryableFilters:
          Object.keys(cleanedQueryableFilters).length > 0
            ? cleanedQueryableFilters
            : undefined,
        filterOperator,
        startTime: startTime?.toISOString(),
        endTime: endTime?.toISOString(),
        useWorldBBox,
      });
    }

    saveGenericFilterStateToDb();
  }, [
    selectedCollection,
    queryableFilters,
    filterOperator,
    startTime,
    endTime,
    useWorldBBox,
    stateDb,
  ]);

  // Reset all state when URL changes
  useEffect(() => {
    setQueryableProps(undefined);
    setCollections([]);
    setSelectedCollection('');
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

    const fetchCollections = async () => {
      if (!baseUrl) {
        return
      }

      const collectionsUrl = baseUrl.endsWith('/')
        ? `${baseUrl}collections`
        : `${baseUrl}/collections`;
      const data: IStacCollectionsReturn = await fetchWithProxies(
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

    fetchCollections();
  }, [model, baseUrl]);

  // for queryables
  // should listen for colletion changes and requery
  // need a way to handle querying multiple collections without refetching everything
  // collection id -> queryables map as a basic cache thing??
  useEffect(() => {
    if (!model) {
      return;
    }

    const fetchQueryables = async () => {
      if (!baseUrl) {
        return
      }

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

    fetchQueryables();
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

    // Build query body and execute query
    const queryBody = buildCopernicusQuery();
    const searchUrl = baseUrl.endsWith('/')
      ? `${baseUrl}search`
      : `${baseUrl}/search`;
    await executeQuery(queryBody, searchUrl);
  }, [model, executeQuery, buildCopernicusQuery, baseUrl]);

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
