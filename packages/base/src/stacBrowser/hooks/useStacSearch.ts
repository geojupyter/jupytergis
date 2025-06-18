import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { startOfYesterday } from 'date-fns';
import { useEffect, useState } from 'react';

import { products } from '@/src/stacBrowser/constants';
import {
  IStacItem,
  IStacQueryBody,
  IStacSearchResult,
  StacFilterState,
  StacFilterSetters,
} from '@/src/stacBrowser/types/types';
import { fetchWithProxies } from '@/src/tools';

const API_URL = 'https://geodes-portal.cnes.fr/api/stac/search';
const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

// Storage keys for persisting state
const STORAGE_KEYS = {
  collections: 'jgis-stac-selected-collections',
  platforms: 'jgis-stac-selected-platforms',
  products: 'jgis-stac-selected-products',
  startTime: 'jgis-stac-start-time',
  endTime: 'jgis-stac-end-time',
};

interface IUseStacSearchProps {
  model: IJupyterGISModel | undefined;
}

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
  handlePaginationClick: (page: number) => Promise<void>;
  handleResultClick: (id: string) => Promise<void>;
  formatResult: (item: IStacItem) => string;
  isLoading: boolean;
}

/**
 * Custom hook for managing STAC search functionality
 * @param props - Configuration object containing datasets, platforms, products, and model
 * @returns Object containing state and handlers for STAC search
 */
function useStacSearch({ model }: IUseStacSearchProps): IUseStacSearchReturn {
  // Generic filter state
  const [filterState, setFilterState] = useState<StacFilterState>({
    collections: new Set(),
    datasets: new Set(),
    platforms: new Set(),
    products: new Set(),
  });

  // Generic filter setters
  const filterSetters: StacFilterSetters = {
    collections: val =>
      setFilterState(s => ({ ...s, collections: new Set(val) })),
    datasets: val => setFilterState(s => ({ ...s, datasets: new Set(val) })),
    platforms: val => setFilterState(s => ({ ...s, platforms: new Set(val) })),
    products: val => setFilterState(s => ({ ...s, products: new Set(val) })),
  };

  const [startTime, setStartTime] = useState<Date | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.startTime);
    return stored ? new Date(stored) : undefined;
  });
  const [endTime, setEndTime] = useState<Date | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.endTime);
    return stored ? new Date(stored) : undefined;
  });
  const [results, setResults] = useState<IStacItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([-180, -90, 180, 90]);
  const [isLoading, setIsLoading] = useState(false);

  // Persist state changes to localStorage
  // TODO: Switch to StateDB
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.collections,
      JSON.stringify(Array.from(filterState.collections)),
    );
  }, [filterState.collections]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.platforms,
      JSON.stringify(Array.from(filterState.platforms)),
    );
  }, [filterState.platforms]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.products,
      JSON.stringify(Array.from(filterState.products)),
    );
  }, [filterState.products]);

  useEffect(() => {
    if (startTime) {
      localStorage.setItem(STORAGE_KEYS.startTime, startTime.toISOString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.startTime);
    }
  }, [startTime]);

  useEffect(() => {
    if (endTime) {
      localStorage.setItem(STORAGE_KEYS.endTime, endTime.toISOString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.endTime);
    }
  }, [endTime]);

  // Listen for model updates to get current bounding box
  useEffect(() => {
    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number],
    ) => {
      setCurrentBBox(bBoxIn4326);
    };

    model?.updateResolutionSignal.connect(listenToModel);

    return () => {
      model?.updateResolutionSignal.disconnect(listenToModel);
    };
  }, [model]);

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

    console.log('body', body);

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
      )) as IStacSearchResult;

      if (!data) {
        console.log('No Results found');
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
      console.error('Error fetching data:', error);
      setResults([]);
      setTotalPages(1);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search when filters change
  // ? Should we hit the api on a map move? That seems like too much
  useEffect(() => {
    setCurrentPage(1);
    model && fetchResults(1);
  }, [
    filterState.collections,
    filterState.platforms,
    filterState.products,
    startTime,
    endTime,
    model,
  ]);

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
      name: 'STAC Layer',
    };

    model && model.addLayer(layerId, layerModel);
  };

  /**
   * Handles pagination clicks
   * @param page - Page number to navigate to
   */
  const handlePaginationClick = async (page: number): Promise<void> => {
    setCurrentPage(page);
    model && fetchResults(page);
  };

  /**
   * Formats a result item for display
   * @param item - STAC item to format
   * @returns Formatted string representation of the item
   */
  const formatResult = (item: IStacItem): string => {
    const dataAsset = Object.values(item.assets).find(val =>
      val.roles?.includes('data'),
    );

    return dataAsset?.title ? dataAsset.title.split('.')[0] : item.id;
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
  };
}

export default useStacSearch;
