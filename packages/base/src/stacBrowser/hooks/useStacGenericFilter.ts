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

export type UpdateSelectedQueryables = (
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
  const { registerBuildQuery, executeQuery } = useStacResultsContext();

  // Get temporal/spatial filters from useStacSearch
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

  const [queryableFields, setQueryableFields] = useState<[string, any][]>();
  const [collections, setCollections] = useState<FilteredCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedQueryables, setSelectedQueryables] = useState<
    Record<string, IQueryableFilter>
  >({});
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('and');

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

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
          setSelectedQueryables(restoredFilters);
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
      Object.entries(selectedQueryables).forEach(([key, filter]) => {
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
    selectedQueryables,
    filterOperator,
    startTime,
    endTime,
    useWorldBBox,
    stateDb,
  ]);

  // Reset all state when URL changes
  useEffect(() => {
    setQueryableFields(undefined);
    setCollections([]);
    setSelectedCollection('');
    setSelectedQueryables({});
    setFilterOperator('and');
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
        return;
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
  // ! TODO - support multiple collection selections
  useEffect(() => {
    if (!model) {
      return;
    }

    const fetchQueryables = async () => {
      if (!baseUrl) {
        return;
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

      setQueryableFields(Object.entries(data.properties));
    };

    fetchQueryables();
  }, [model, baseUrl]);

  const updateSelectedQueryables = useCallback(
    (qKey: string, filter: IQueryableFilter) => {
      setSelectedQueryables(prev => ({
        ...prev,
        [qKey]: filter,
      }));
    },
    [],
  );

  
  const buildQuery = useCallback((): IStacQueryBody => {
    const st = startTime
      ? startTime.toISOString()
      : startOfToday().toISOString();

    const et = endTime ? endTime.toISOString() : endOfToday().toISOString();

    // Build filter object from selectedQueryables
    const filterConditions = Object.entries(selectedQueryables)
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
    selectedQueryables,
    filterOperator,
  ]);

  // Register buildQuery with context
  useEffect(() => {
    registerBuildQuery(() => buildQuery());
  }, [registerBuildQuery, buildQuery, baseUrl]);

  const handleSubmit = useCallback(async () => {
    if (!model) {
      return;
    }

    // Build query body and execute query
    const queryBody = buildQuery();
    const searchUrl = baseUrl.endsWith('/')
      ? `${baseUrl}search`
      : `${baseUrl}/search`;
    await executeQuery(queryBody, searchUrl);
  }, [model, executeQuery, buildQuery, baseUrl]);

  return {
    queryableFields,
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
    selectedQueryables,
    updateSelectedQueryables,
    filterOperator,
    setFilterOperator,
  };
}
