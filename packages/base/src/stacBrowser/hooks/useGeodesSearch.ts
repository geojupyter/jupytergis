import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { startOfYesterday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import useIsFirstRender from '@/src/shared/hooks/useIsFirstRender';
import { products } from '@/src/stacBrowser/constants';
import {
  IStacItem,
  IStacLink,
  IStacQueryBody,
  IStacSearchResult,
  StacFilterState,
  StacFilterSetters,
  StacFilterStateStateDb,
} from '@/src/stacBrowser/types/types';
import { GlobalStateDbManager } from '@/src/store';
import { fetchWithProxies } from '@/src/tools';
import { useGeneric } from './useStacSearch';

interface IUseStacSearchProps {
  model: IJupyterGISModel | undefined;
}

// ! TODO factor out common bits
interface IUseStacSearchReturn {
  filterState: StacFilterState;
  filterSetters: StacFilterSetters;
  results: IStacItem[];
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
  totalPages: number;
  currentPage: number;
  totalResults: number;
  handlePaginationClick: (dir: 'next' | 'previous' | number) => Promise<void>;
  handleResultClick: (id: string) => Promise<void>;
  formatResult: (item: IStacItem) => string;
  isLoading: boolean;
  useWorldBBox: boolean;
  setUseWorldBBox: (val: boolean) => void;
  paginationLinks: Array<
    IStacLink & { method?: string; body?: Record<string, any> }
  >;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
}

const API_URL = 'https://geodes-portal.cnes.fr/api/stac/search';
const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];
const STAC_FILTERS_KEY = 'jupytergis:stac-filters';

/**
 * Custom hook for managing STAC search functionality
 * @param props - Configuration object containing datasets, platforms, products, and model
 * @returns Object containing state and handlers for STAC search
 */
function useStacSearch({ model }: IUseStacSearchProps): IUseStacSearchReturn {
  const isFirstRender = useIsFirstRender();
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  // Get generic state from useGeneric hook
  const {
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    currentBBox,
    useWorldBBox,
    setUseWorldBBox,
  } = useGeneric({ model });

  const [results, setResults] = useState<IStacItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationLinks, setPaginationLinks] = useState<
    Array<IStacLink & { method?: string; body?: Record<string, any> }>
  >([]);
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

  // Handle search when filters change
  useEffect(() => {
    if (model && !isFirstRender && filterState.datasets.size > 0) {
      setCurrentPage(1);
      fetchResults(1);
    }
  }, [filterState, startTime, endTime, currentBBox]);

  const fetchResults = async (page = 1) => {
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

    const body: IStacQueryBody = {
      bbox: currentBBox,
      limit: 12,
      page,
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

    try {
      setIsLoading(true);
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': XSRF_TOKEN,
          credentials: 'include',
        },
        body: JSON.stringify(body),
      };

      if (!model) {
        return;
      }

      const data = (await fetchWithProxies(
        API_URL,
        model,
        async response => await response.json(),
        //@ts-expect-error Jupyter requires X-XSRFToken header
        options,
        'internal',
      )) as IStacSearchResult;

      if (!data) {
        console.debug('STAC search failed -- no results found');
        setResults([]);
        setTotalPages(1);
        setTotalResults(0);
        return;
      }

      setResults(data.features);
      const pages = data.context.matched / data.context.limit;
      setTotalPages(Math.ceil(pages));
      setTotalResults(data.context.matched);
    } catch (error) {
      console.error('STAC search failed -- error fetching data:', error);
      setResults([]);
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
  const handleResultClick = async (id: string): Promise<void> => {
    if (!results) {
      return;
    }

    const layerId = UUID.uuid4();
    const stacData = results.find(item => item.id === id);

    if (!stacData) {
      console.error('Result not found:', id);
      return;
    }

    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: { data: stacData },
      visible: true,
      name: stacData.properties.title ?? stacData.id,
    };

    model && model.addLayer(layerId, layerModel);
  };

  /**
   * Handles pagination clicks
   * @param dir - Direction ('next' | 'previous') or page number to navigate to
   */
  const handlePaginationClick = async (
    dir: 'next' | 'previous' | number,
  ): Promise<void> => {
    if (typeof dir === 'number') {
      setCurrentPage(dir);
      model && fetchResults(dir);
    } else {
      // For 'next' or 'previous', calculate the page number
      const newPage = dir === 'next' ? currentPage + 1 : currentPage - 1;
      setCurrentPage(newPage);
      model && fetchResults(newPage);
    }
  };

  /**
   * Formats a result item for display
   * @param item - STAC item to format
   * @returns Formatted string representation of the item
   */
  const formatResult = (item: IStacItem): string => {
    return item.properties.title ?? item.id;
  };

  return {
    filterState,
    filterSetters,
    results,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    totalPages,
    currentPage,
    totalResults,
    handlePaginationClick,
    handleResultClick,
    formatResult,
    isLoading,
    useWorldBBox,
    setUseWorldBBox,
    paginationLinks,
    setPaginationLinks,
  };
}

export default useStacSearch;
