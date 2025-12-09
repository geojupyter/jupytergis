import { IJupyterGISModel } from '@jupytergis/schema';
import { startOfYesterday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import useIsFirstRender from '@/src/shared/hooks/useIsFirstRender';
import { products } from '@/src/stacBrowser/constants';
import {
  IStacItem,
  IStacLink,
  IStacQueryBody,
  SetResultsFunction,
  StacFilterState,
  StacFilterSetters,
  StacFilterStateStateDb,
} from '@/src/stacBrowser/types/types';
import { GlobalStateDbManager } from '@/src/store';
import { useStacSearch } from './useStacSearch';
import { useStacResultsContext } from '../context/StacResultsContext';

interface IUseGeodesSearchProps {
  model: IJupyterGISModel | undefined;
  apiUrl: string;
  setResults: SetResultsFunction;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
}

interface IUseGeodesSearchReturn {
  filterState: StacFilterState;
  filterSetters: StacFilterSetters;
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
  useWorldBBox: boolean;
  setUseWorldBBox: (val: boolean) => void;
  handleSubmit: () => Promise<void>;
}

const STAC_FILTERS_KEY = 'jupytergis:stac-filters';
const GEODES_URL = 'https://geodes-portal.cnes.fr/api/stac/search';

/**
 * Custom hook for managing GEODES-specific STAC search functionality
 * Focuses on query building with GEODES-specific filters
 * @param props - Configuration object containing model and context setters
 * @returns Object containing filter state and temporal/spatial filters
 */
function useGeodesSearch({
  model,
  apiUrl,
  setResults,
  setPaginationLinks,
}: IUseGeodesSearchProps): IUseGeodesSearchReturn {
  const isFirstRender = useIsFirstRender();
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();
  const {
    currentPage,
    currentPageRef,
    setCurrentPage,
    registerHandlePaginationClick,
    registerBuildQuery,
    executeQuery,
    selectedUrl,
  } = useStacResultsContext();

  useEffect(() => {
    console.log('current page', currentPage);
    console.log('current page ref i think this one ', currentPageRef.current);

  }, [currentPage]);

  useEffect(() => {
    console.log('current page ref', currentPageRef.current);
  }, [currentPageRef.current]);

  // Get temporal/spatial filters and fetch functions from useStacSearch
  const {
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    currentBBox,
    useWorldBBox,
    setUseWorldBBox,
  } = useStacSearch({
    model,
    setResults,
    setPaginationLinks,
  });

  const [filterState, setFilterState] = useState<StacFilterState>({
    collections: new Set(),
    datasets: new Set(),
    platforms: new Set(),
    products: new Set(),
  });

  

  const filterSetters: StacFilterSetters = {
    collections: val =>
      setFilterState(s => ({ ...s, collections: new Set(val) })),
    datasets: val => setFilterState(s => ({ ...s, datasets: new Set(val) })),
    platforms: val => setFilterState(s => ({ ...s, platforms: new Set(val) })),
    products: val => setFilterState(s => ({ ...s, products: new Set(val) })),
  };

  // On mount, fetch filterState and times from StateDB (if present)
  useEffect(() => {
    async function loadStacStateFromDb() {
      const savedFilterState = (await stateDb?.fetch(
        STAC_FILTERS_KEY,
      )) as StacFilterStateStateDb;

      setFilterState({
        collections: new Set((savedFilterState?.collections as string[]) ?? []),
        datasets: new Set((savedFilterState?.datasets as string[]) ?? []),
        platforms: new Set((savedFilterState?.platforms as string[]) ?? []),
        products: new Set((savedFilterState?.products as string[]) ?? []),
      });
    }

    loadStacStateFromDb();
  }, [stateDb]);

  // Save filterState to StateDB on change
  useEffect(() => {
    async function saveStacFilterStateToDb() {
      await stateDb?.save(STAC_FILTERS_KEY, {
        collections: Array.from(filterState.collections),
        datasets: Array.from(filterState.datasets),
        platforms: Array.from(filterState.platforms),
        products: Array.from(filterState.products),
      });
    }

    saveStacFilterStateToDb();
  }, [filterState, stateDb]);

  /**
   * Builds GEODES-specific query
   * @param page - Page number for pagination (defaults to currentPageRef.current)
   */
  const buildGeodesQuery = useCallback((page?: number): IStacQueryBody => {
    const pageToUse = page ?? currentPageRef.current;
    const processingLevel = new Set<string>();
    const productType = new Set<string>();

    filterState.products.forEach(productCode => {
      products
        .filter(product => product.productCode === productCode)
        .forEach(product => {
          if (product.processingLevel) {
            processingLevel.add(product.processingLevel);
          }
          if (product.productType) {
            product.productType.forEach(type => productType.add(type));
          }
        });
    });

    return {
      bbox: currentBBox,
      limit: 12,
      page: pageToUse,
      query: {
        latest: { eq: true },
        dataset: { in: Array.from(filterState.datasets) },
        end_datetime: {
          gte: startTime
            ? startTime.toISOString()
            : startOfYesterday().toISOString(),
        },
        ...(endTime && {
          start_datetime: { lte: endTime.toISOString() },
        }),
        ...(filterState.platforms.size > 0 && {
          platform: { in: Array.from(filterState.platforms) },
        }),
        ...(processingLevel.size > 0 && {
          'processing:level': { in: Array.from(processingLevel) },
        }),
        ...(productType.size > 0 && {
          'product:type': { in: Array.from(productType) },
        }),
      },
      sortBy: [{ direction: 'desc', field: 'start_datetime' }],
    };
  }, [filterState, currentBBox, startTime, endTime, currentPageRef]);

  // Register buildQuery with context - always use currentPageRef for latest page
  useEffect(() => {
    registerBuildQuery(() => buildGeodesQuery(currentPageRef.current));
  }, [registerBuildQuery, buildGeodesQuery, currentPageRef]);

  /**
   * Handles form submission - builds query and fetches results
   */
  const handleSubmit = useCallback(async () => {
    if (!model) {
      return;
    }

    // ! someosmeosmesse urlTOUse
    const urlToUse = selectedUrl.endsWith('/') ? `${selectedUrl}search` : `${selectedUrl}/search`;
    // Build query body and execute query
    const queryBody = buildGeodesQuery();
    await executeQuery(queryBody, urlToUse);
  }, [model, executeQuery, buildGeodesQuery, selectedUrl]);

  // Handle search when filters change
  useEffect(() => {
    if (model && !isFirstRender && filterState.datasets.size > 0) {
      handleSubmit();
    }
  }, [
    model,
    isFirstRender,
    filterState,
    startTime,
    endTime,
    currentBBox,
    handleSubmit,
  ]);


  /**
   * Handles pagination clicks for GEODES
   * Updates currentPage and executes query with new page number
   * @param dir - Direction ('next' | 'previous')
   */
  const handlePaginationClick = useCallback(
    async (dir: 'next' | 'previous'): Promise<void> => {
      if (!model) {
        return;
      }

      console.log('geodes page click', dir, 'currentPage:', currentPage, 'currentPageRef.current:', currentPageRef.current);

      // Calculate new page number
      const newPage = dir === 'next' ? currentPageRef.current + 1 : currentPageRef.current - 1;

      // Update currentPage in context
      setCurrentPage(newPage);
      const urlToUse = selectedUrl.endsWith('/') ? `${selectedUrl}search` : `${selectedUrl}/search`;

      // Build query body with new page and execute query
      const queryBody = buildGeodesQuery(newPage);
      await executeQuery(queryBody, urlToUse);
    },
    [model, executeQuery, setCurrentPage, currentPage, currentPageRef, buildGeodesQuery, selectedUrl],
  );


  // Register handlePaginationClick with context
  useEffect(() => {
    registerHandlePaginationClick(handlePaginationClick);
  }, [handlePaginationClick, registerHandlePaginationClick]);

  return {
    filterState,
    filterSetters,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
    handleSubmit,
  };
}

export default useGeodesSearch;
