import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import Badge from '@/src/shared/components/Badge';
import { Button } from '@/src/shared/components/Button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';
import {
  DatasetsType,
  PlatformsType,
  ProductsType,
} from '@/src/stacBrowser/constants';

// Discriminated union for props
type StacFilterSectionProps =
  | {
      section: 'Collection';
      data: DatasetsType;
      selectedCollections: string[];
      selectedData: string[]; // dataset names
      handleCheckedChange: (dataset: string, collection: string) => void;
    }
  | {
      section: 'Platform';
      data: PlatformsType;
      selectedCollections: string[];
      selectedData: string[]; // platform names
      handleCheckedChange: (platform: string, _collection: string) => void;
    }
  | {
      section: 'Data / Product';
      data: ProductsType;
      selectedCollections: string[];
      selectedData: string[]; // product codes
      handleCheckedChange: (product: string, collection: string) => void;
    };

const StacFilterSection = ({
  section,
  data,
  selectedCollections,
  selectedData,
  handleCheckedChange,
}: StacFilterSectionProps) => {
  const items = useMemo(() => {
    if (section === 'Collection') {
      return (
        <DropdownMenuGroup>
          {data.map(entry => (
            <DropdownMenuSub key={entry.collection}>
              <DropdownMenuSubTrigger>
                {entry.collection}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {entry.datasets.map(dataset => (
                    <DropdownMenuCheckboxItem
                      key={dataset}
                      checked={selectedData.includes(dataset)}
                      onCheckedChange={() => {
                        handleCheckedChange(dataset, entry.collection);
                      }}
                      onSelect={e => {
                        e.preventDefault();
                      }}
                    >
                      {dataset}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          ))}
        </DropdownMenuGroup>
      );
    }

    if (section === 'Platform') {
      return (
        <>
          {selectedCollections.map(collection => (
            <DropdownMenuGroup key={collection}>
              <DropdownMenuLabel>{collection}</DropdownMenuLabel>
              {data[collection as keyof typeof data]?.map(platform => (
                <DropdownMenuCheckboxItem
                  key={platform}
                  checked={selectedData.includes(platform)}
                  onCheckedChange={() => {
                    handleCheckedChange(platform, '');
                  }}
                  onSelect={e => {
                    e.preventDefault();
                  }}
                >
                  {platform}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </>
      );
    }

    if (section === 'Data / Product') {
      return (
        <>
          {selectedCollections.map(collection => (
            <DropdownMenuGroup key={collection}>
              <DropdownMenuLabel>{collection}</DropdownMenuLabel>
              {data
                .filter(product => product.collections.includes(collection))
                .map(product => (
                  <DropdownMenuCheckboxItem
                    key={product.productCode}
                    checked={selectedData.includes(product.productCode)}
                    onCheckedChange={() => {
                      handleCheckedChange(product.productCode, collection);
                    }}
                    onSelect={e => {
                      e.preventDefault();
                    }}
                  >
                    {product.productCode}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          ))}
        </>
      );
    }
  }, [section, data, selectedCollections, selectedData, handleCheckedChange]);

  const isTriggerDisabled =
    (section === 'Platform' || section === 'Data / Product') &&
    selectedCollections.length === 0;

  return (
    <div className="jgis-stac-filter-section-container">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className="jgis-stac-filter-trigger"
          disabled={isTriggerDisabled}
        >
          {section}
          <ChevronRight className="DropdownMenuIcon" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right">{items}</DropdownMenuContent>
      </DropdownMenu>
      <div className="jgis-stac-filter-section-badges">
        {selectedData.map(data => (
          <Badge key={data} className="jgis-stac-badge">
            <span>{data}</span>
            <Button
              variant="icon"
              size="icon-sm"
              className="jgis-stac-badge-icon"
              onClick={() => {
                handleCheckedChange(data, '');
              }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default StacFilterSection;
