import React from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/src/shared/components/Pagination';
import { useStacResultsContext } from '@/src/stacBrowser/context/StacResultsContext';

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


// ! tues to do -- refactor this, total pages is based on context, which is an extension
// so everythign here needs to be based on link rels instead
const StacPanelResults = () => {
  const {
    results,
    currentPage,
    totalPages,
    handlePaginationClick,
    handleResultClick,
    formatResult,
    isLoading,
    paginationLinks,
  } = useStacResultsContext();

  const isNext = paginationLinks.some(link => link.rel === 'next');
  const isPrev = paginationLinks.some(link => link.rel === 'previous');

  return (
    <div className="jgis-stac-browser-filters-panel">
      <Pagination>
        <PaginationContent style={{ marginTop: 0 }}>
          <PaginationItem>
            <PaginationPrevious
              onClick={
                () => handlePaginationClick('previous')
                // handlePaginationClick(Math.max(1, currentPage - 1))
              }
              disabled={!isPrev}
            />
          </PaginationItem>
          {results.length === 0 ? (
            <div>No Matches Found</div>
          ) : (
            getPageItems(currentPage, totalPages).map(item => {
              if (item === 'ellipsis') {
                return (
                  <PaginationItem key="ellipsis">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    onClick={() => handlePaginationClick('next')}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              );
            })
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => handlePaginationClick('previous')}
              disabled={!isNext}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="jgis-stac-browser-results-list">
        {isLoading ? (
          // TODO: Fancy spinner
          <div>Loading results...</div>
        ) : (
          results.map(result => (
            <Button
              key={result.id}
              className="jgis-stac-browser-results-item"
              onClick={() => handleResultClick(result.id)}
            >
              {formatResult(result)}
            </Button>
          ))
        )}
      </div>
    </div>
  );
};
export default StacPanelResults;
