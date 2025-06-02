import {
  IDict,
  IJupyterGISModel,
  IJupyterGISTracker
} from '@jupytergis/schema';
import React, { ChangeEvent, useEffect, useState } from 'react';
import { IControlPanelModel } from '../types';
import StacGridView from './components/StacGridView';
import StacPanelView from './components/StacPanelView';
import { IStacItem, ProductData } from './types/types';

// Map display names to query strings
export const datasets: IDict<string[]> = {
  'Sentinel 1': ['PEPS_S1_L1', 'PEPS_S1_L2'],
  'Sentinel 2': [
    'PEPS_S2_L1C',
    'MUSCATE_SENTINEL2_SENTINEL2_L2A',
    'MUSCATE_Snow_SENTINEL2_L2B-SNOW',
    'MUSCATE_WaterQual_SENTINEL2_L2B-WATER',
    'MUSCATE_SENTINEL2_SENTINEL2_L3A'
  ],
  Venus: [
    'MUSCATE_VENUS_VM1_L1C',
    'MUSCATE_VENUSVM05_VM5_L1C',
    'MUSCATE_VENUS_VM1_L2A',
    'MUSCATE_VENUSVM05_VM5_L2A',
    'MUSCATE_VENUS_VM1_L3A',
    'MUSCATE_VENUSVM05_VM5_L3A'
  ],
  Spot: [
    'MUSCATE_SPOTWORLDHERITAGE_SPOT1_L1C',
    'MUSCATE_SPOTWORLDHERITAGE_SPOT2_L1C',
    'MUSCATE_SPOTWORLDHERITAGE_SPOT3_L1C',
    'TAKE5_SPOT4_L1C',
    'MUSCATE_SPOTWORLDHERITAGE_SPOT4_L1C',
    'TAKE5_SPOT4_L2A',
    'TAKE5_SPOT5_L2A',
    'TAKE5_SPOT5_L1C',
    'MUSCATE_SPOTWORLDHERITAGE_SPOT5_L1C',
    'MUSCATE_Spirit_SPOT5_L1A',
    'SWH_SPOT123_L1',
    'SWH_SPOT4_L1',
    'SWH_SPOT5_L1'
  ],
  Landsat: [
    'MUSCATE_Landsat57_LANDSAT5_N2A',
    'MUSCATE_Landsat57_LANDSAT7_N2A',
    'MUSCATE_LANDSAT_LANDSAT8_L2A',
    'MUSCATE_Snow_LANDSAT8_L2B-SNOW'
  ],
  OSO: ['MUSCATE_OSO_RASTER_L3B-OSO', 'MUSCATE_OSO_VECTOR_L3B-OSO'],
  Postel: [
    'POSTEL_VEGETATION_LAI',
    'POSTEL_VEGETATION_FCOVER',
    'POSTEL_VEGETATION_FAPAR',
    'POSTEL_VEGETATION_NDVI',
    'POSTEL_VEGETATION_SURFACEREFLECTANCE',
    'POSTEL_RADIATION_BRDF',
    'POSTEL_RADIATION_DLR',
    'POSTEL_RADIATION_SURFACEREFLECTANCE',
    'POSTEL_RADIATION_SURFACEALBEDO',
    'POSTEL_WATER_SOILMOISTURE',
    'POSTEL_WATER_SWI',
    'POSTEL_WATER_SURFWET',
    'POSTEL_WATER_PRECIP',
    'POSTEL_LANDCOVER_GLOBCOVER'
  ],
  'GEOV2 AVHRR': [
    'POSTEL_VEGETATION_LAI',
    'POSTEL_VEGETATION_FCOVER',
    'POSTEL_VEGETATION_FAPAR',
    'POSTEL_VEGETATION_NDVI'
  ]
};

// map collection names to available platforms
const platforms: IDict<string[]> = {
  'Sentinel 1': ['S1A', 'S1B'],
  'Sentinel 2': ['S2A', 'S2B', 'S2X'],
  Venus: ['VM1', 'VM5'],
  Spot: [
    'SPOT1',
    'SPOT2',
    'SPOT3',
    'SPOT4',
    'SPOT5',
    'SPOT4_TAKE5',
    'SPOT5_TAKE5'
  ],
  Landsat: ['LANDSAT5', 'LANDSAT7', 'LANDSAT8']
};

// Map processing:level to product:type for queries and the datasets they apply to
// so the keys here are what gets displayed in the UI - start there
const products: IDict<ProductData> = {
  // ! Sent 1
  SLC: {
    collections: ['Sentinel 1'],
    'processing:level': ['L1'],
    'product:type': ['SLC']
  },
  GRD: {
    collections: ['Sentinel 1'],
    'processing:level': ['L1'],
    'product:type': ['GRD']
  },
  OCN: {
    collections: ['Sentinel 1'],
    'processing:level': ['L2'],
    'product:type': ['OCN']
  },
  // ! Sent 2
  S2A: {
    collections: ['Sentinel 2'],
    'processing:level': ['L1C'],
    'product:type': ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C']
  },
  L1C: {
    collections: ['Sentinel 2'],
    'processing:level': ['L1C'],
    'product:type': ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C']
  },
  L2A: {
    collections: ['Sentinel 2'],
    'processing:level': ['L2A'],
    'product:type': ['REFLECTANCE']
  },
  'L2B SNOW': {
    collections: ['Sentinel 2'],
    'processing:level': ['L2B-SNOW'],
    'product:type': ['SNOW_MASK']
  },
  'L2B WATER': {
    collections: ['Sentinel 2'],
    'processing:level': ['L2B-WATER'],
    'product:type': ['REFLECTANCE']
  },
  L3A: {
    collections: ['Sentinel 2'],
    'processing:level': ['L3A'],
    'product:type': ['REFLECTANCE']
  }
};

interface IStacBrowserDialogProps {
  controlPanelModel: IControlPanelModel;
  display: 'side' | 'grid';
  tracker: IJupyterGISTracker;

  // registry: IRasterLayerGalleryEntry[];
  // formSchemaRegistry: IJGISFormSchemaRegistry;
  // okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  // cancel: () => void;
}

// ? Does this make more sense here or in types?
export interface IStacViewProps {
  searchTerm: string;
  handleSearchInput: (event: ChangeEvent<HTMLInputElement>) => void;
  datasets: IDict<string[]>;
  platforms: IDict<string[]>;
  products: IDict<ProductData>;
  selectedCategory: string | null;
  handleCategoryClick: (category: string) => void;
  // handleTileClick: (id: string) => void;
  displayInfo?: IStacItem[];
  model?: IJupyterGISModel;
}

const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

const StacBrowser = ({
  controlPanelModel,
  display,
  tracker
}: IStacBrowserDialogProps) => {
  const [widgetId, setWidgetId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [displayInfo, setDisplayInfo] = useState<IStacItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel
  );

  controlPanelModel?.documentChanged.connect((_, widget) => {
    setJgisModel(widget?.model);
  });

  // Reset state values when current widget changes
  useEffect(() => {
    const handleCurrentChanged = () => {
      if (tracker.currentWidget?.id === widgetId) {
        return;
      }

      if (tracker.currentWidget) {
        setWidgetId(tracker.currentWidget.id);
      }
      setSearchTerm('');
      setDisplayInfo([]);
      setSelectedCategory('');
    };
    tracker.currentChanged.connect(handleCurrentChanged);

    return () => {
      tracker.currentChanged.disconnect(handleCurrentChanged);
    };
  }, []);

  const handleSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const handleCategoryClick = (category: string) => {
    setSearchTerm('');
    setSelectedCategory(prev => (prev === category ? '' : category));
  };

  const displayComponents = {
    grid: (props: IStacViewProps) => <StacGridView {...props} />,
    side: (props: IStacViewProps) => <StacPanelView {...props} />
  };

  const DisplayComponent = displayComponents[display];

  return (
    <DisplayComponent
      datasets={datasets}
      platforms={platforms}
      products={products}
      displayInfo={displayInfo}
      handleCategoryClick={handleCategoryClick}
      handleSearchInput={handleSearchInput}
      searchTerm={searchTerm}
      selectedCategory={selectedCategory}
      model={jgisModel}
    />
  );
};
export default StacBrowser;
