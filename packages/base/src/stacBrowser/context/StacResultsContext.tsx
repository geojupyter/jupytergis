import { IJupyterGISModel } from '@jupytergis/schema';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';

import { IStacItem, IStacLink } from '../types/types';

interface IStacResultsContext {
  results: IStacItem[];
  isLoading: boolean;
  totalResults: number;
  handlePaginationClick: (dir: 'next' | 'previous') => Promise<void>;
  handleResultClick: (id: string) => Promise<void>;
  formatResult: (item: IStacItem) => string;
  paginationLinks: Array<
    IStacLink & { method?: string; body?: Record<string, any> }
  >;
  selectedUrl: string;
  setSelectedUrl: (url: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  currentPageRef: React.MutableRefObject<number>;
  setResults: (
    results: IStacItem[],
    isLoading: boolean,
    totalResults: number,
  ) => void;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
  // Register hook-specific functions that handlers need (for generic filter)
  registerFetchUsingLink: (
    fetchFn: (
      link: IStacLink & { method?: string; body?: Record<string, any> },
    ) => Promise<void>,
  ) => void;
  registerAddToMap: (addFn: (stacData: IStacItem) => void) => void;
  registerHandlePaginationClick: (
    handleFn: (dir: 'next' | 'previous') => Promise<void>,
  ) => void;
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
  const [paginationLinks, setPaginationLinksState] = useState<
    Array<IStacLink & { method?: string; body?: Record<string, any> }>
  >([]);
  const [selectedUrl, setSelectedUrlState] = useState<string>(
    'https://stac.dataspace.copernicus.eu/v1/',
  );
  const [currentPage, setCurrentPageState] = useState<number>(1);
  const currentPageRef = useRef<number>(1);

  // Store hook-specific functions in refs (these are set by the hooks)
  const fetchUsingLinkRef =
    useRef<
      (
        link: IStacLink & { method?: string; body?: Record<string, any> },
      ) => Promise<void>
    >();
  const addToMapRef = useRef<(stacData: IStacItem) => void>();
  const handlePaginationClickRef = useRef<
    (dir: 'next' | 'previous') => Promise<void>
  >();

  // Keep ref in sync with state
  useEffect(() => {
    console.log('update curr page ref in context', currentPage)
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const setResults = useCallback(
    (
      newResults: IStacItem[],
      newIsLoading: boolean,
      newTotalResults: number,
    ) => {
      setResultsState(newResults);
      setIsLoading(newIsLoading);
      setTotalResults(newTotalResults);
    },
    [],
  );

  const setPaginationLinks = useCallback(
    (
      links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
    ) => {
      setPaginationLinksState(links);
    },
    [],
  );

  const setSelectedUrl = useCallback((url: string) => {
    setSelectedUrlState(url);
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
  }, []);

  // ! this has got to go
  // Register functions from hooks
  const registerFetchUsingLink = useCallback(
    (
      fetchFn: (
        link: IStacLink & { method?: string; body?: Record<string, any> },
      ) => Promise<void>,
    ) => {
      fetchUsingLinkRef.current = fetchFn;
    },
    [],
  );

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

      // Find the pagination link by rel
      const link = currentLinks.find(l => l.rel === dir);

      if (link && link.body && fetchUsingLinkRef.current) {
        // Use the registered fetch function
        await fetchUsingLinkRef.current(link);
      }
    },
    [model, paginationLinks],
  );

  const handleResultClick = useCallback(
    async (id: string): Promise<void> => {
      if (!model) {
        return;
      }

      // Read directly from state - no closure issues!
      const currentResults = results;
      const result = currentResults.find((r: IStacItem) => r.id === id);

      console.log('handler ersult click context')
      if (result && addToMapRef.current) {
        addToMapRef.current(result);
      }
    },
    [model, results],
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
        registerFetchUsingLink,
        registerAddToMap,
        registerHandlePaginationClick,
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
