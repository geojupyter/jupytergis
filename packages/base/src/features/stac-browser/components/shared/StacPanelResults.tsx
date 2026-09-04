import React from 'react';

import { useStacResultsContext } from '@/src/features/stac-browser/context/StacResultsContext';
import { ButtonTw } from '@/src/shared/components/ButtonTw';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/src/shared/components/Pagination';
import { LoadingIcon } from '@/src/shared/components/loading';

function getPageItems(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    currentPage - 2,
    currentPage - 1,
    currentPage,
    'ellipsis',
    totalPages,
  ];
}

const StacPanelResults = () => {
  const {
    results,
    handlePaginationClick,
    handleResultClick,
    formatResult,
    isLoading,
    paginationLinks,
    currentPage,
    setCurrentPage,
    totalPages,
    executeQueryWithPage,
  } = useStacResultsContext();

  const isNext = paginationLinks.some(link => link.rel === 'next');
  const isPrev = paginationLinks.some(link =>
    ['prev', 'previous'].includes(link.rel),
  );

  return (
    <div className="jgis-stac-browser-filters-panel">
      <Pagination>
        <PaginationContent className="jgis-stac-panel-results-pagination gap-0">
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={!isPrev || undefined}
              tabIndex={!isPrev ? -1 : undefined}
              className={!isPrev ? 'pointer-events-none opacity-50' : undefined}
              onClick={() => {
                if (!isPrev) {
                  return;
                }
                setCurrentPage(Math.max(currentPage - 1, 1));
                handlePaginationClick('previous');
              }}
            />
          </PaginationItem>
          {totalPages === 1 ? (
            // One page, display current page number and keep active
            <PaginationItem>
              <PaginationLink size={'icon-xs'} isActive={true}>
                {currentPage}
              </PaginationLink>
            </PaginationItem>
          ) : results.length !== 0 ? (
            // Multiple pages, display fancy pagination numbers
            <>
              {getPageItems(currentPage, totalPages).map(pageNumber => {
                if (pageNumber === 'ellipsis') {
                  return (
                    <PaginationItem key="ellipsis">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      size={'icon-xs'}
                      isActive={pageNumber === currentPage}
                      onClick={async () => {
                        setCurrentPage(pageNumber);
                        await executeQueryWithPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
            </>
          ) : (
            // No results
            <PaginationItem>
              <PaginationLink
                size={'icon-xs'}
                isActive={true}
                aria-disabled={true}
                tabIndex={-1}
                className="pointer-events-none opacity-50"
              >
                0
              </PaginationLink>
            </PaginationItem>
          )}
          <PaginationItem>
            <PaginationNext
              aria-disabled={!isNext || undefined}
              tabIndex={!isNext ? -1 : undefined}
              className={!isNext ? 'pointer-events-none opacity-50' : undefined}
              onClick={() => {
                if (!isNext) {
                  return;
                }
                setCurrentPage(currentPage + 1);
                handlePaginationClick('next');
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="jgis-stac-browser-results-list">
        {isLoading ? (
          <LoadingIcon size="3x" />
        ) : (
          results.map(result => (
            <ButtonTw
              key={result.id}
              variant="outline"
              className="jgis-stac-browser-results-item"
              onClick={() => handleResultClick(result.id)}
            >
              {formatResult(result)}
            </ButtonTw>
          ))
        )}
      </div>
    </div>
  );
};

export default StacPanelResults;
