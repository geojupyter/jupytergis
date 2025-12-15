import { IJupyterGISModel } from '@jupytergis/schema';
import { endOfToday, startOfToday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { useStacResultsContext } from '@/src/stacBrowser/context/StacResultsContext';
import { useStacSearch } from '@/src/stacBrowser/hooks/useStacSearch';
import {
  FilterOperator,
  IQueryableFilter,
  IStacCollection,
  IStacCollectionsReturn,
  IStacFilterCondition,
  IStacFilterExtensionQueryBody,
  Operator,
} from '@/src/stacBrowser/types/types';
import { GlobalStateDbManager } from '@/src/store';
import { fetchWithProxies } from '@/src/tools';

type FilteredCollection = Pick<IStacCollection, 'id' | 'title'>;


interface IStacFilterExtensionStateDb {
  selectedCollection?: string;
  queryableFilters?: Record<
    string,
    { operator: Operator; inputValue: string | number | null }
  >;
  filterOperator?: FilterOperator;
}

const STAC_FILTER_EXTENSION_STATE_KEY =
  'jupytergis:stac-filter-extension-state';

interface IUseStacFilterExtensionProps {
  model?: IJupyterGISModel;
  baseUrl: string;
  limit?: number;
}

/**
 * Hook for searching STAC catalogs that support the Filter Extension (CQL2-JSON).
 * Fetches collections and queryables, and builds filter queries using the STAC Filter Extension.
 */
export function useStacFilterExtension({
  model,
  baseUrl,
  limit = 12,
}: IUseStacFilterExtensionProps) {
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
    async function loadFilterExtensionStateFromDb() {
      const savedFilterState = (await stateDb?.fetch(
        STAC_FILTER_EXTENSION_STATE_KEY,
      )) as IStacFilterExtensionStateDb | undefined;

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
      }
    }

    loadFilterExtensionStateFromDb();
  }, [stateDb]);

  // Save filter state to StateDB on change
  useEffect(() => {
    async function saveFilterExtensionStateToDb() {
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

      await stateDb?.save(STAC_FILTER_EXTENSION_STATE_KEY, {
        selectedCollection: selectedCollection || undefined,
        queryableFilters:
          Object.keys(cleanedQueryableFilters).length > 0
            ? cleanedQueryableFilters
            : undefined,
        filterOperator,
      });
    }

    saveFilterExtensionStateToDb();
  }, [selectedCollection, selectedQueryables, filterOperator, stateDb]);

  // Reset all state when URL changes
  useEffect(() => {
    setQueryableFields(undefined);
    setCollections([]);
    setSelectedCollection('');
    setSelectedQueryables({});
    setFilterOperator('and');
  }, [baseUrl]);

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
        .map((collection: IStacCollection) => ({
          title: collection.title ?? collection.id,
          id: collection.id,
        }))
        .sort((a: FilteredCollection, b: FilteredCollection) => {
          const titleA = a.title?.toLowerCase() ?? '';
          const titleB = b.title?.toLowerCase() ?? '';
          return titleA.localeCompare(titleB);
        });

      setCollections(collections);
      // Set first collection as default if one isn't loaded
      if (collections.length > 0 && !(selectedCollection === '')) {
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
    (qKey: string, filter: IQueryableFilter | null) => {
      setSelectedQueryables(prev => {
        // If filter is null, remove the key entirely
        if (filter === null) {
          const { [qKey]: _, ...rest } = prev;
          return rest;
        }
        // If inputValue is undefined but filter exists, keep it (user might be entering value)
        // Only remove if explicitly set to null
        return {
          ...prev,
          [qKey]: filter,
        };
      });
    },
    [],
  );

  const buildQuery = useCallback((): IStacFilterExtensionQueryBody => {
    const st = startTime
      ? startTime.toISOString()
      : startOfToday().toISOString();

    const et = endTime ? endTime.toISOString() : endOfToday().toISOString();

    // Build filter object from selectedQueryables
    const filterConditions: IStacFilterCondition[] = Object.entries(
      selectedQueryables,
    )
      .filter(([, filter]) => filter.inputValue !== undefined)
      .map(([property, filter]): IStacFilterCondition => {
        // Check if this property is a datetime type
        const queryableField = queryableFields?.find(
          ([key]) => key === property,
        );
        const isDateTime =
          queryableField &&
          queryableField[1]?.type === 'string' &&
          queryableField[1]?.format === 'date-time';

        // For datetime values, wrap in timestamp object; otherwise use value directly
        const value = isDateTime
          ? { timestamp: filter.inputValue as string }
          : filter.inputValue;

        const condition: IStacFilterCondition = {
          op: filter.operator,
          args: [{ property }, value] as [
            { property: string },
            string | number | { timestamp: string },
          ],
        };

        return condition;
      });

    const body: IStacFilterExtensionQueryBody = {
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

    return body;
  }, [
    startTime,
    endTime,
    currentBBox,
    selectedCollection,
    limit,
    selectedQueryables,
    filterOperator,
    queryableFields,
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
