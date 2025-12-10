import React, { useEffect, useRef } from 'react';

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
import { LoadingIcon } from '@/src/shared/components/loading';
import { useStacResultsContext } from '@/src/stacBrowser/context/StacResultsContext';
import { IStacItem } from '@/src/stacBrowser/types/types';

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

  useEffect(() => {
    console.log('current page in results', currentPage);
    console.log('totalPages', totalPages);
  }, [currentPage, totalPages]);

  const isNext = paginationLinks.some(link => link.rel === 'next');
  const isPrev = paginationLinks.some(link =>
    ['prev', 'previous'].includes(link.rel),
  );

  return (
    <div className="jgis-stac-browser-filters-panel">
      <Pagination>
        <PaginationContent style={{ marginTop: 0 }}>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => {
                setCurrentPage(Math.max(currentPage - 1, 1));
                handlePaginationClick('previous');
              }}
              disabled={!isPrev}
            />
          </PaginationItem>
          {
            totalPages === 1 ? (
              // One page, display current page number and keep active
              <PaginationItem>
                <PaginationLink isActive={true}>{currentPage}</PaginationLink>
              </PaginationItem>
            ) : results.length !== 0 || isLoading ? (
              // Multiple pages, display fancy pagination numbers
              <>
                {getPageItems(currentPage, totalPages).map(item => {
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
                        onClick={async () => {
                          setCurrentPage(item);
                          await executeQueryWithPage(item);
                        }}
                        disabled={totalPages === 1}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
              </>
            ) : (
              // No results
              <PaginationItem>
                <PaginationLink isActive={true} disabled={true}>
                  0
                </PaginationLink>
              </PaginationItem>
            )
          }
          <PaginationItem>
            <PaginationNext
              onClick={() => {
                setCurrentPage(currentPage + 1);
                handlePaginationClick('next');
              }}
              disabled={!isNext}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="jgis-stac-browser-results-list">
        {isLoading ? (
          <LoadingIcon size='3x'/>
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
