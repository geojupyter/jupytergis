import React from 'react';
import { Button } from '@/src/shared/components/Button';
import { LoadingIcon } from '@/src/shared/components/loading';
import { IStacItem } from '@/src/stacBrowser/types/types';

interface IStacPanelResultsProps {
  results: IStacItem[];
  currentPage: number;
  totalPages: number;
  totalResults: number;
  handlePaginationClick: (page: number) => void;
  handleResultClick: (id: string) => void;
  formatResult: (item: IStacItem) => string;
  isLoading: boolean;
}

const StacPanelResults = ({
  results,
  currentPage,
  totalPages,
  totalResults,
  handlePaginationClick,
  handleResultClick,
  formatResult,
  isLoading,
}: IStacPanelResultsProps) => {
  return (
    <div className="flex flex-col h-full">
      {/* Results Header */}
      <div className="flex-none px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold">
          Results {totalResults > 0 && `(${totalResults.toLocaleString()})`}
        </h3>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingIcon size="lg" />
            <p className="mt-3 text-sm text-gray-500">Loading results...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm text-gray-500">No results found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map(result => {
              const formattedName = formatResult(result);
              const displayName =
                formattedName.length > 50
                  ? `${formattedName.slice(0, 47)}...`
                  : formattedName;

              return (
                <div
                  key={result.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="flex-1 text-gray-700 text-xs font-mono truncate">
                    • {displayName}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleResultClick(result.id)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-7 px-3 shrink-0"
                  >
                    Add to map
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 0 && !isLoading && (
        <div className="flex-none px-3 py-2 border-t border-gray-200 flex justify-center">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() =>
                handlePaginationClick(Math.max(1, currentPage - 1))
              }
              disabled={currentPage === 1}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              &lt; Prev
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={() =>
                handlePaginationClick(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StacPanelResults;
