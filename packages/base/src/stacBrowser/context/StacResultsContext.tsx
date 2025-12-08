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
  // Set handlers from outside (for GEODES search)
  setPaginationHandlers: (
    handlePaginationClick: (dir: 'next' | 'previous') => Promise<void>,
    handleResultClick: (id: string) => Promise<void>,
    formatResult: (item: IStacItem) => string,
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
  const [externalHandlers, setExternalHandlers] = useState<{
    handlePaginationClick: (dir: 'next' | 'previous') => Promise<void>;
    handleResultClick: (id: string) => Promise<void>;
    formatResult: (item: IStacItem) => string;
  } | null>(null);

  // Store hook-specific functions in refs (these are set by the hooks)
  const fetchUsingLinkRef =
    useRef<
      (
        link: IStacLink & { method?: string; body?: Record<string, any> },
      ) => Promise<void>
    >();
  const addToMapRef = useRef<(stacData: IStacItem) => void>();

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

  // ! pagination should always be the same
  const setPaginationHandlers = useCallback(
    (
      newHandlePaginationClick: (dir: 'next' | 'previous') => Promise<void>,
      newHandleResultClick: (id: string) => Promise<void>,
      newFormatResult: (item: IStacItem) => string,
    ) => {
      setExternalHandlers({
        handlePaginationClick: newHandlePaginationClick,
        handleResultClick: newHandleResultClick,
        formatResult: newFormatResult,
      });
    },
    [],
  );

  // Handlers created in context - always read latest state directly
  // Use external handlers if provided, otherwise use context-created ones
  const handlePaginationClick = useCallback(
    async (dir: 'next' | 'previous'): Promise<void> => {
      console.log('context pgination click')
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

      if (result && addToMapRef.current) {
        addToMapRef.current(result);
      }
    },
    [model, results],
  );

  const formatResult = useCallback((item: IStacItem): string => {
    return item.properties?.title ?? item.id;
  }, []);

  // Use external handlers if provided, otherwise use context-created ones
  const finalHandlePaginationClick = externalHandlers
    ? externalHandlers.handlePaginationClick
    : handlePaginationClick;
  const finalHandleResultClick = externalHandlers
    ? externalHandlers.handleResultClick
    : handleResultClick;
  const finalFormatResult = externalHandlers
    ? externalHandlers.formatResult
    : formatResult;

  return (
    <StacResultsContext.Provider
      value={{
        results,
        isLoading,
        totalResults,
        handlePaginationClick: finalHandlePaginationClick,
        handleResultClick: finalHandleResultClick,
        formatResult: finalFormatResult,
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
        setPaginationHandlers,
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
