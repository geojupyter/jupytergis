import React from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../shared/components/Tabs';
import useStacSearch from '../hooks/useStacSearch';
import { IStacViewProps } from '../StacBrowser';
import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';

const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  const {
    selectedCollections,
    setSelectedCollections,
    selectedPlatforms,
    setSelectedPlatforms,
    selectedProducts,
    setSelectedProducts,
    results,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    totalPages,
    currentPage,
    totalResults,
    handlePaginationClick,
    handleResultClick,
    formatResult
  } = useStacSearch({ datasets, platforms, products, model });

  if (!model) {
    return null;
  }

  return (
    <Tabs defaultValue="filters" className="jgis-stac-browser-main">
      <TabsList>
        <TabsTrigger value="filters">Filters</TabsTrigger>
        <TabsTrigger value="results">{`Results (${totalResults})`}</TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <StacPanelFilters
          datasets={datasets}
          platforms={platforms}
          products={products}
          selectedCollections={selectedCollections}
          setSelectedCollections={setSelectedCollections}
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
          selectedProducts={selectedProducts}
          setSelectedProducts={setSelectedProducts}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          model={model}
        />
      </TabsContent>
      <TabsContent value="results">
        <StacPanelResults
          results={results}
          currentPage={currentPage}
          totalPages={totalPages}
          handlePaginationClick={handlePaginationClick}
          handleResultClick={handleResultClick}
          formatResult={formatResult}
        />
      </TabsContent>
    </Tabs>
  );
};

export default StacPanelView;
