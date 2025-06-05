import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { format, startOfYesterday } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import Calendar from '../../shared/components/Calendar';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '../../shared/components/Pagination';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../shared/components/Popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../shared/components/Tabs';
import { cn } from '../../shared/components/utils';
import { IStacViewProps } from '../StacBrowser';
import { IStacItem, IStacQueryBody, IStacSearchResult } from '../types/types';
import ProductSection from './ProductSection';
import StacFilterSection from './StacFilterSection';

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
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [results, setResults] = useState<IStacItem[]>([]);
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([0, 0, 0, 0]);
  const [startTime, setStartTime] = useState<Date>();
  const [endTime, setEndTime] = useState<Date>();
  const [isFirstRender, setIsFirstRender] = useState(false);
  // const [resultLinks, setResultLinks] = useState<IResultsLinks>();
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [queryBody, setQueryBody] = useState<IStacQueryBody>();

  useEffect(() => {
    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number]
    ) => {
      setCurrentBBox(bBoxIn4326);
    };
    model?.updateResolutionSignal.connect(listenToModel);

    return () => {
      model?.updateResolutionSignal.disconnect(listenToModel);
    };
  }, [model]);

  useEffect(() => {
    // Geodes behavior => query on every selection
    const selectedDatasets = Object.entries(datasets)
      .filter(([key]) => selectedCollections.includes(key))
      .flatMap(([_, values]) => values);

    const processingLevel: string[] = [];
    const productType: string[] = [];

    selectedProducts.forEach(productCode => {
      productType.push(...products[productCode]['product:type']);

      // No processing:level for some collections
      if (products[productCode]['processing:level']) {
        processingLevel.push(...products[productCode]['processing:level']);
      }
    });

    // Build query
    // TODO: Move out of effect
    const fetchInEffect = async () => {
      const body: IStacQueryBody = {
        bbox: currentBBox,
        limit: 12,
        page: currentPage,
        query: {
          latest: {
            eq: true
          },
          dataset: {
            in: selectedDatasets
          },
          end_datetime: {
            gte: endTime
              ? endTime.toISOString()
              : startOfYesterday().toISOString()
          },
          // Only include following attrs in query if there's a selection
          ...(startTime && {
            start_datetime: { lte: startTime.toISOString() }
          }),
          ...(selectedPlatforms.length > 0 && {
            platform: { in: selectedPlatforms }
          }),
          ...(processingLevel.length > 0 && {
            'processing:level': { in: processingLevel }
          }),
          ...(productType.length > 0 && {
            'product:type': { in: productType }
          })
        },
        sortBy: [
          {
            direction: 'desc',
            field: 'start_datetime'
          }
        ]
      };

      setQueryBody(body);
      console.log('body', body);

      // TODO: Don't call this on render.
      const result = await fetchWithProxy(body); // this result is ItemCollection
      if (!result) {
        console.log('no result');
        return;
      }

      // determine number of pages needed to display results
      const pages = result.context.matched / result.context.limit;
      console.log('[pag] pages', pages);
      setTotalPages(Math.ceil(pages));

      console.log('result', result);
    };

    // TODO: Do this better. Really don't use an effect
    if (!isFirstRender) {
      fetchInEffect();
    }

    if (isFirstRender) {
      setIsFirstRender(false);
    }
  }, [selectedCollections, selectedPlatforms, selectedProducts]);

  useEffect(() => {
    console.log('currentPage', currentPage);
  }, [currentPage]);

  async function fetchWithProxy(options: IStacQueryBody) {
    // Needed for POST
    const xsrfToken = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

    const proxyUrl = `/jupytergis_core/proxy?url=${encodeURIComponent(apiUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        //@ts-expect-error Jupyter requires X-XSRFToken header
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': xsrfToken,
          credentials: 'include'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as IStacSearchResult;

      setResults(data.features);
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleResultClick = async (id: string) => {
    if (!results) {
      return;
    }

    const layerId = UUID.uuid4();

    const stacData = results.find(item => item.id === id);

    console.log('stacData', stacData);
    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: {
        data: stacData
      },
      visible: true,
      name: 'STAC Layer'
    };

    model ? model.addLayer(layerId, layerModel) : console.log('no model');
  };

  // TODO: ??? idk this won't work for most (?) things
  const formatResult = (item: IStacItem): string => {
    // Find the first asset with a 'data' role
    const dataAsset = Object.values(item.assets).find(val =>
      val.roles?.includes('data')
    );

    // Return title without extension if found, otherwise item.id
    return dataAsset ? dataAsset.title.split('.')[0] : item.id;
  };

  // need to fetch the saved link and update results and update link

  // ! What we boutta do: take page number as param and redfo query wioth it
  const handlePaginationClick = async (page: number) => {
    if (!queryBody) {
      // This should never be the first query
      return;
    }
    //fetch new link - want to redo query with new page number

    const body = { ...queryBody, page };

    console.log('new body', body);

    // results gets set in fetchWithProxy
    const result = await fetchWithProxy(body); // this result is ItemCollection
    if (!result) {
      console.log('no result');
      return;
    }

    // determine number of pages needed to display results
    const pages = result.context.matched / result.context.limit;
    setTotalPages(pages);

    console.log('result', result);
  };

  // Show 2 pages on either side of the active page
  const getVisiblePageNumbers = () => {
    if (totalPages <= 5) {
      // Show all pages if there are 5 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Start with current page in the middle (ideally)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    // Adjust if we're near the start
    if (currentPage <= 3) {
      startPage = 1;
      endPage = 5;
    }

    // Adjust if we're near the end
    if (currentPage >= totalPages - 2) {
      startPage = totalPages - 4;
      endPage = totalPages;
    }

    // Generate the page numbers
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  if (!model) {
    return;
  }

  return (
    <Tabs defaultValue="filters" className="jgis-stac-browser-main">
      <TabsList>
        <TabsTrigger value="filters">Filters</TabsTrigger>
        <TabsTrigger value="results">{`Results (${results.length})`}</TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <div>save/load filter</div>
        {/* Date Picker */}
        <div className="jgis-stac-browser-date-picker">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !startTime && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startTime ? format(startTime, 'PPP') : <span>Start Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startTime}
                onSelect={setStartTime}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !endTime && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endTime ? format(endTime, 'PPP') : <span>End Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endTime}
                onSelect={setEndTime}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>where</div>
        <StacFilterSection
          header="Collection"
          data={datasets}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('collections', val);
            setSelectedCollections(val);
          }}
          selectedPlatforms={selectedPlatforms}
          model={model}
        />
        <StacFilterSection
          header="Platform"
          data={platforms}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('plaforms', val);
            setSelectedPlatforms(val);
          }}
          selectedPlatforms={selectedPlatforms}
          model={model}
        />
        <ProductSection
          header="Data / Product"
          data={products}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('products', val);
            setSelectedProducts(val);
          }}
          selectedProducts={selectedProducts}
          model={model}
        />
        <div>cloud cover</div>
      </TabsContent>
      <TabsContent value="results">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                // should be hgandle pageinat click
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              />
            </PaginationItem>
            {getVisiblePageNumbers().map(page => (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <div>Results</div>
        <div className="jgis-stac-browser-results-list">
          {results.map(result => (
            <Button
              className="jgis-stac-browser-results-item"
              onClick={() => handleResultClick(result.id)}
            >
              {formatResult(result)}
            </Button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default StacPanelView;
