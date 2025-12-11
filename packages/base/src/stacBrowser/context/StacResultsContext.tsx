import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';

import { fetchWithProxies } from '@/src/tools';
import {
  IStacItem,
  IStacPaginationLink,
  IStacQueryBody,
  IStacSearchResult,
  SetResultsFunction,
} from '../types/types';

interface IStacResultsContext {
  results: IStacItem[];
  isLoading: boolean;
  totalResults: number;
  totalPages: number;
  handlePaginationClick: (dir: 'next' | 'previous') => Promise<void>;
  handleResultClick: (id: string) => Promise<void>;
  formatResult: (item: IStacItem) => string;
  paginationLinks: IStacPaginationLink[];
  selectedUrl: string;
  setSelectedUrl: (url: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  currentPageRef: React.MutableRefObject<number>;
  setResults: SetResultsFunction;
  setPaginationLinks: (links: IStacPaginationLink[]) => void;
  registerAddToMap: (addFn: (stacData: IStacItem) => void) => void;
  registerHandlePaginationClick: (
    handleFn: (dir: 'next' | 'previous') => Promise<void>,
  ) => void;
  registerBuildQuery: (buildQueryFn: () => IStacQueryBody) => void;
  executeQuery: (
    body: IStacQueryBody,
    apiUrl?: string,
    method?: string,
  ) => Promise<void>;
  executeQueryWithPage: (pageNumber: number) => Promise<void>;
}

const StacResultsContext = createContext<IStacResultsContext | undefined>(
  undefined,
);

interface IStacResultsProviderProps {
  children: ReactNode;
  model?: IJupyterGISModel;
}

export function StacResultsProvider({
  children,
  model,
}: IStacResultsProviderProps) {
  const [results, setResultsState] = useState<IStacItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [paginationLinks, setPaginationLinksState] = useState<
    IStacPaginationLink[]
  >([]);
  const [selectedUrl, setSelectedUrlState] = useState<string>('');
  const [currentPage, setCurrentPageState] = useState<number>(1);
  const currentPageRef = useRef<number>(1);

  // Store hook-specific functions in refs (these are set by the hooks)
  const addToMapRef = useRef<(stacData: IStacItem) => void>();
  const handlePaginationClickRef =
    useRef<(dir: 'next' | 'previous') => Promise<void>>();
  const buildQueryRef = useRef<() => IStacQueryBody>();

  // Keep ref in sync with state
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const setResults = useCallback(
    (
      newResults: IStacItem[],
      newIsLoading: boolean,
      newTotalResults: number,
      newTotalPages: number,
    ) => {
      setResultsState(newResults);
      setIsLoading(newIsLoading);
      setTotalResults(newTotalResults);
      setTotalPages(newTotalPages);
    },
    [],
  );

  const setPaginationLinks = useCallback((links: IStacPaginationLink[]) => {
    setPaginationLinksState(links);
  }, []);

  const setSelectedUrl = useCallback((url: string) => {
    setSelectedUrlState(url);
    // Clear all registered handlers when provider changes to prevent stale handlers
    handlePaginationClickRef.current = undefined;
    addToMapRef.current = undefined;
    buildQueryRef.current = undefined;

    // Reset all state
    setIsLoading(false);
    setCurrentPageState(1);
    currentPageRef.current = 1;
    setResultsState([]);
    setPaginationLinksState([]);
    setTotalResults(0);
    setTotalPages(0);
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
  }, []);

  const registerAddToMap = useCallback(
    (addFn: (stacData: IStacItem) => void) => {
      addToMapRef.current = addFn;
    },
    [],
  );

  const registerHandlePaginationClick = useCallback(
    (handleFn: (dir: 'next' | 'previous') => Promise<void>) => {
      handlePaginationClickRef.current = handleFn;
    },
    [],
  );

  const registerBuildQuery = useCallback(
    (buildQueryFn: () => IStacQueryBody) => {
      buildQueryRef.current = buildQueryFn;
    },
    [],
  );

  // Helper to get search URL from base URL
  const getSearchUrl = (baseUrl: string): string => {
    return baseUrl.endsWith('/') ? `${baseUrl}search` : `${baseUrl}/search`;
  };

  // Execute query using provided body
  const executeQuery = useCallback(
    async (
      body: IStacQueryBody,
      apiUrl?: string,
      method?: string,
    ): Promise<void> => {
      if (!model) {
        return;
      }

      const XSRF_TOKEN = document.cookie.match(/_xsrf=([^;]+)/)?.[1];
      const queryBody = body;
      const urlToUse = apiUrl || getSearchUrl(selectedUrl);
      const httpMethod = (method || 'POST').toUpperCase();

      const options = {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': XSRF_TOKEN,
          credentials: 'include',
        },
        body: JSON.stringify(queryBody),
      };

      try {
        // Update context with loading state
        setResults(results, true, totalResults, totalPages);

        const data = (await fetchWithProxies(
          urlToUse,
          model,
          async (response: Response) => await response.json(),
          //@ts-expect-error Jupyter requires X-XSRFToken header
          options,
          'internal',
        )) as IStacSearchResult;

        if (!data) {
          setResults([], false, 0, 0);
          return;
        }

        // Filter assets to only include items with 'overview' or 'thumbnail' roles
        if (data.features && data.features.length > 0) {
          data.features.forEach((feature: IStacItem) => {
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

        // Calculate total results from context if available
        let totalResultsFromQuery = data.features.length;
        let totalPagesFromQuery = 0;
        if (data.context) {
          totalResultsFromQuery = data.context.matched;
          totalPagesFromQuery = Math.ceil(
            data.context.matched / data.context.limit,
          );
        } else if (sortedFeatures.length > 0) {
          // If results found but no context, assume 1 page
          totalPagesFromQuery = 1;
        }

        // Update context with results
        setResults(
          sortedFeatures,
          false,
          totalResultsFromQuery,
          totalPagesFromQuery,
        );

        // Store pagination links
        if (data.links) {
          const typedLinks = data.links as IStacPaginationLink[];
          setPaginationLinks(typedLinks);
        }
      } catch (error) {
        setResults([], false, 0, 0);
      }
    },
    [
      model,
      selectedUrl,
      setResults,
      setPaginationLinks,
      results,
      totalResults,
      totalPages,
    ],
  );

  // Wrapper function that takes a page number, builds query, and executes it
  const executeQueryWithPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      if (!model || !buildQueryRef.current) {
        return;
      }

      // Build query body
      let queryBody = buildQueryRef.current();

      // Inject page number into the query
      queryBody = { ...queryBody, page: pageNumber };

      // Execute query with the modified body
      await executeQuery(queryBody);
    },
    [model, executeQuery],
  );

  // Handlers created in context - always read latest state directly
  // Use registered handler if provided, otherwise use context-created one
  const handlePaginationClick = useCallback(
    async (dir: 'next' | 'previous'): Promise<void> => {
      // Use registered handler if available (e.g., from GEODES)
      if (handlePaginationClickRef.current) {
        await handlePaginationClickRef.current(dir);
        return;
      }

      // Default handler for generic STAC (Copernicus)
      if (!model) {
        return;
      }

      // Read directly from state - no closure issues!
      const currentLinks = paginationLinks;

      // Find the pagination link by rel (support both 'previous' and 'prev')
      const link = currentLinks.find(l => {
        if (dir === 'next') {
          return l.rel === 'next';
        }
        // For 'previous', accept both 'previous' and 'prev'
        return ['prev', 'previous'].includes(l.rel);
      });

      // ! this is nice, if no body then link href should have search params - update eventually
      if (link && link.body) {
        // Use executeQuery with the link's body, href, and method
        await executeQuery(link.body as IStacQueryBody, link.href, link.method);
      }
    },
    [model, paginationLinks, executeQuery],
  );

  // Default addToMap implementation - always available
  const defaultAddToMap = useCallback(
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

  const handleResultClick = useCallback(
    async (id: string): Promise<void> => {
      if (!model) {
        return;
      }

      // Read directly from state - no closure issues!
      const currentResults = results;
      const result = currentResults.find((r: IStacItem) => r.id === id);

      if (result) {
        // Use registered override if available, otherwise use default
        if (addToMapRef.current) {
          addToMapRef.current(result);
        } else {
          defaultAddToMap(result);
        }
      }
    },
    [model, results, defaultAddToMap],
  );

  const formatResult = useCallback((item: IStacItem): string => {
    return item.properties?.title ?? item.id;
  }, []);

  return (
    <StacResultsContext.Provider
      value={{
        results,
        isLoading,
        totalResults,
        totalPages,
        handlePaginationClick,
        handleResultClick,
        formatResult,
        paginationLinks,
        selectedUrl,
        setSelectedUrl,
        currentPage,
        setCurrentPage,
        currentPageRef,
        setResults,
        setPaginationLinks,
        registerAddToMap,
        registerHandlePaginationClick,
        registerBuildQuery,
        executeQuery,
        executeQueryWithPage,
      }}
    >
      {children}
    </StacResultsContext.Provider>
  );
}

export function useStacResultsContext() {
  const context = useContext(StacResultsContext);
  if (context === undefined) {
    throw new Error(
      'useStacResultsContext must be used within a StacResultsProvider',
    );
  }
  return context;
}
