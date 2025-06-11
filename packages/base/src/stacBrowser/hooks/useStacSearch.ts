import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { startOfYesterday } from 'date-fns';
import { useEffect, useState } from 'react';
import { fetchWithProxies } from '../../tools';
import {
  IProductData,
  IStacItem,
  IStacQueryBody,
  IStacSearchResult
} from '../types/types';

const API_URL = 'https://geodes-portal.cnes.fr/api/stac/search';
const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];
const PROXY_URL = `/jupytergis_core/proxy?url=${encodeURIComponent(API_URL)}`;

// Storage keys for persisting state
const STORAGE_KEYS = {
  collections: 'jgis-stac-selected-collections',
  platforms: 'jgis-stac-selected-platforms',
  products: 'jgis-stac-selected-products'
};

interface IUseStacSearchProps {
  datasets: Record<string, string[]>;
  platforms: Record<string, string[]>;
  products: Record<string, IProductData>;
  model: IJupyterGISModel | undefined;
}

interface IUseStacSearchReturn {
  selectedCollections: string[];
  setSelectedCollections: (val: string[]) => void;
  selectedPlatforms: string[];
  setSelectedPlatforms: (val: string[]) => void;
  selectedProducts: string[];
  setSelectedProducts: (val: string[]) => void;
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
}

/**
 * Custom hook for managing STAC search functionality
 * @param props - Configuration object containing datasets, platforms, products, and model
 * @returns Object containing state and handlers for STAC search
 */
function useStacSearch({
  datasets,
  platforms,
  products,
  model
}: IUseStacSearchProps): IUseStacSearchReturn {
  // Initialize state from localStorage or empty arrays
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    () => {
      const stored = localStorage.getItem(STORAGE_KEYS.collections);
      return stored ? JSON.parse(stored) : [];
    }
  );

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.platforms);
    return stored ? JSON.parse(stored) : [];
  });

  const [selectedProducts, setSelectedProducts] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.products);
    return stored ? JSON.parse(stored) : [];
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.collections,
      JSON.stringify(selectedCollections)
    );
  }, [selectedCollections]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.platforms,
      JSON.stringify(selectedPlatforms)
    );
  }, [selectedPlatforms]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.products,
      JSON.stringify(selectedProducts)
    );
  }, [selectedProducts]);

  const [results, setResults] = useState<IStacItem[]>([]);
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([0, 0, 0, 0]);
  const [startTime, setStartTime] = useState<Date>();
  const [endTime, setEndTime] = useState<Date>();
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [queryBody, setQueryBody] = useState<IStacQueryBody>();
  const [totalResults, setTotalResults] = useState(0);
  const [isFirstRender, setIsFirstRender] = useState(false);

  // Listen for model updates to get current bounding box
  useEffect(() => {
    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number]
    ) => {
      setCurrentBBox(bBoxIn4326);
    };

    model?.updateResolutionSignal.connect(listenToModel);

    return () => {
      model?.updateResolutionSignal.disconnect(listenToModel);
    };
  }, [model]);

  // Handle search when filters change
  useEffect(() => {
    const selectedDatasets = Object.entries(datasets)
      .filter(([key]) => selectedCollections.includes(key))
      .flatMap(([_, values]) => values);

    const processingLevel: string[] = [];
    const productType: string[] = [];

    selectedProducts.forEach(productCode => {
      productType.push(...products[productCode]['product:type']);
      if (products[productCode]['processing:level']) {
        processingLevel.push(...products[productCode]['processing:level']);
      }
    });

    const fetchInEffect = async () => {
      const body: IStacQueryBody = {
        bbox: currentBBox,
        limit: 12,
        page: currentPage,
        query: {
          latest: { eq: true },
          dataset: { in: selectedDatasets },
          end_datetime: {
            gte: endTime
              ? endTime.toISOString()
              : startOfYesterday().toISOString()
          },
          ...(startTime && {
            start_datetime: { lte: startTime.toISOString() }
          }),
          ...(selectedPlatforms.length > 0 && {
            platform: { in: selectedPlatforms }
          }),
          ...(processingLevel.length > 0 && {
            'processing:level': { in: processingLevel }
          }),
          ...(productType.length > 0 && { 'product:type': { in: productType } })
        },
        sortBy: [{ direction: 'desc', field: 'start_datetime' }]
      };

      setQueryBody(body);
      const result = await prepareFetch(body);

      if (!result) {
        return;
      }

      const pages = result.context.matched / result.context.limit;
      setTotalPages(Math.ceil(pages));
      setTotalResults(result.context.matched);
    };

    if (!isFirstRender) {
      fetchInEffect();
    }

    if (isFirstRender) {
      setIsFirstRender(false);
    }
  }, [selectedCollections, selectedPlatforms, selectedProducts]);

  /**
   * Fetches STAC search results using a proxy
   * @param body - Query options for the STAC search
   * @returns Promise resolving to search results or undefined if error
   */
  const prepareFetch = async (
    body: IStacQueryBody
  ): Promise<IStacSearchResult | undefined> => {
    try {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': XSRF_TOKEN,
          credentials: 'include'
        },
        body: JSON.stringify(body)
      };

      const data = (await fetchWithProxies(
        PROXY_URL,
        async response => await response.json(),
        model ?? null,
        //@ts-expect-error Jupyter requires X-XSRFToken header
        options
      )) as IStacSearchResult;

      if (!data) {
        console.log('No Results found');
        return;
      }

      setResults(data.features);
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      return undefined;
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
      name: 'STAC Layer'
    };

    model && model.addLayer(layerId, layerModel);
  };

  /**
   * Handles pagination clicks
   * @param page - Page number to navigate to
   */
  const handlePaginationClick = async (page: number): Promise<void> => {
    if (!queryBody) {
      return;
    }

    setCurrentPage(page);
    const body = { ...queryBody, page };
    await prepareFetch(body);
  };

  /**
   * Formats a result item for display
   * @param item - STAC item to format
   * @returns Formatted string representation of the item
   */
  const formatResult = (item: IStacItem): string => {
    const dataAsset = Object.values(item.assets).find(val =>
      val.roles?.includes('data')
    );

    return dataAsset ? dataAsset.title.split('.')[0] : item.id;
  };

  return {
    selectedCollections,
    setSelectedCollections,
    selectedPlatforms,
    setSelectedPlatforms,
    selectedProducts,
    setSelectedProducts,
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
    formatResult
  };
}

export default useStacSearch;
