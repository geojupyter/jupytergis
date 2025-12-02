import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
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
  setPaginationHandlers: (
    handlePaginationClick: (dir: 'next' | 'previous' | number) => Promise<void>,
    handleResultClick: (id: string) => Promise<void>,
    formatResult: (item: IStacItem) => string,
  ) => void;
  setPaginationLinks: (
    links: Array<IStacLink & { method?: string; body?: Record<string, any> }>,
  ) => void;
}

const StacResultsContext = createContext<IStacResultsContext | undefined>(
  undefined,
);

interface IStacResultsProviderProps {
  children: ReactNode;
}

export function StacResultsProvider({ children }: IStacResultsProviderProps) {
  const [results, setResultsState] = useState<IStacItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [handlePaginationClick, setHandlePaginationClick] = useState<
    (dir: 'next' | 'previous' | number) => Promise<void>
  >(async () => {});
  const [handleResultClick, setHandleResultClick] = useState<
    (id: string) => Promise<void>
  >(async () => {});
  const [formatResult, setFormatResult] = useState<(item: IStacItem) => string>(
    () => (item: IStacItem) => item.id,
  );
  const [paginationLinks, setPaginationLinksState] = useState<
    Array<IStacLink & { method?: string; body?: Record<string, any> }>
  >([]);

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

  const setPaginationHandlers = useCallback(
    (
      newHandlePaginationClick: (
        dir: 'next' | 'previous' | number,
      ) => Promise<void>,
      newHandleResultClick: (id: string) => Promise<void>,
      newFormatResult: (item: IStacItem) => string,
    ) => {
      setHandlePaginationClick(() => newHandlePaginationClick);
      setHandleResultClick(() => newHandleResultClick);
      setFormatResult(() => newFormatResult);
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

  return (
    <StacResultsContext.Provider
      value={{
        results,
        isLoading,
        totalPages,
        currentPage,
        totalResults,
        handlePaginationClick,
        handleResultClick,
        formatResult,
        paginationLinks,
        setResults,
        setPaginationHandlers,
        setPaginationLinks,
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
