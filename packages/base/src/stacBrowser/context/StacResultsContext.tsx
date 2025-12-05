import { IJupyterGISModel } from '@jupytergis/schema';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react';

import { IStacItem, IStacLink } from '../types/types';

interface IStacResultsContext {
  results: IStacItem[];
  isLoading: boolean;
  totalPages: number;
  currentPage: number;
  totalResults: number;
  handlePaginationClick: (dir: 'next' | 'previous' | number) => Promise<void>;
  handleResultClick: (id: string) => Promise<void>;
  formatResult: (item: IStacItem) => string;
  paginationLinks: Array<
    IStacLink & { method?: string; body?: Record<string, any> }
  >;
  setResults: (
    results: IStacItem[],
    isLoading: boolean,
    totalPages: number,
    currentPage: number,
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
    handlePaginationClick: (dir: 'next' | 'previous' | number) => Promise<void>,
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
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationLinks, setPaginationLinksState] = useState<
    Array<IStacLink & { method?: string; body?: Record<string, any> }>
  >([]);
  const [externalHandlers, setExternalHandlers] = useState<{
    handlePaginationClick: (dir: 'next' | 'previous' | number) => Promise<void>;
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

  const setResults = useCallback(
    (
      newResults: IStacItem[],
      newIsLoading: boolean,
      newTotalPages: number,
      newCurrentPage: number,
      newTotalResults: number,
    ) => {
      setResultsState(newResults);
      setIsLoading(newIsLoading);
      setTotalPages(newTotalPages);
      setCurrentPage(newCurrentPage);
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

  const setPaginationHandlers = useCallback(
    (
      newHandlePaginationClick: (
        dir: 'next' | 'previous' | number,
      ) => Promise<void>,
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
    async (dir: 'next' | 'previous' | number): Promise<void> => {
      if (!model) {
        return;
      }

      // Read directly from state - no closure issues!
      const currentLinks = paginationLinks;
      const currentPageValue = currentPage;

      // If dir is a number, convert it to 'next' or 'previous' based on current page
      let rel: 'next' | 'previous';
      if (typeof dir === 'number') {
        rel = dir > currentPageValue ? 'next' : 'previous';
      } else {
        rel = dir;
      }

      // Find the pagination link
      const link = currentLinks.find(l => l.rel === rel);

      if (link && link.body && fetchUsingLinkRef.current) {
        // Use the registered fetch function
        await fetchUsingLinkRef.current(link);
        // Update current page after successful fetch if dir was a number
        if (typeof dir === 'number') {
          setResults(results, isLoading, totalPages, dir, totalResults);
        }
      }
    },
    [
      model,
      paginationLinks, // Direct dependency - no ref needed!
      currentPage,
      results,
      isLoading,
      totalPages,
      totalResults,
      setResults,
    ],
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
    [model, results], // Direct dependency - no ref needed!
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
        totalPages,
        currentPage,
        totalResults,
        handlePaginationClick: finalHandlePaginationClick,
        handleResultClick: finalHandleResultClick,
        formatResult: finalFormatResult,
        paginationLinks,
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
