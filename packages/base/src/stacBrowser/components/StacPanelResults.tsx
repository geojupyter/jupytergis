import React from 'react';

import { Button } from '../../shared/components/Button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../../shared/components/Pagination';
import { IStacItem } from '../types/types';

interface IStacPanelResultsProps {
  results: IStacItem[];
  currentPage: number;
  totalPages: number;
  handlePaginationClick: (page: number) => void;
  handleResultClick: (id: string) => void;
  formatResult: (item: IStacItem) => string;
}

function getPageItems(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
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

const StacPanelResults = ({
  results,
  currentPage,
  totalPages,
  handlePaginationClick,
  handleResultClick,
  formatResult,
}: IStacPanelResultsProps) => {
  return (
    <div className="jgis-stac-browser-filters-panel">
      <Pagination>
        <PaginationContent style={{ marginTop: 0 }}>
          <PaginationItem>
            <PaginationPrevious
              onClick={() =>
                handlePaginationClick(Math.max(1, currentPage - 1))
              }
              disabled={currentPage === 1}
            />
          </PaginationItem>
          {totalPages <= 0 ? (
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
                    onClick={() => handlePaginationClick(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              );
            })
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() =>
                handlePaginationClick(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="jgis-stac-browser-results-list">
        {results.map(result => (
          <Button
            key={result.id}
            className="jgis-stac-browser-results-item"
            onClick={() => handleResultClick(result.id)}
          >
            {formatResult(result)}
          </Button>
        ))}
      </div>
    </div>
  );
};
export default StacPanelResults;
