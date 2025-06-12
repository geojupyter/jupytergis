import {
  IDict,
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidget,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { IControlPanelModel } from '../types';
import StacPanelView from './components/StacPanelView';
import { CollectionName, ProductCode, ProductRegistry } from './types/types';

// Map display names to query strings
export const datasets: IDict<string[]> = {
  'Sentinel 1': ['PEPS_S1_L1', 'PEPS_S1_L2'],
  'Sentinel 2': [
    'PEPS_S2_L1C',
    'MUSCATE_SENTINEL2_SENTINEL2_L2A',
    'MUSCATE_Snow_SENTINEL2_L2B-SNOW',
    'MUSCATE_WaterQual_SENTINEL2_L2B-WATER',
    'MUSCATE_SENTINEL2_SENTINEL2_L3A',
  ],
  Venus: [
    'MUSCATE_VENUS_VM1_L1C',
    'MUSCATE_VENUSVM05_VM5_L1C',
    'MUSCATE_VENUS_VM1_L2A',
    'MUSCATE_VENUSVM05_VM5_L2A',
    'MUSCATE_VENUS_VM1_L3A',
    'MUSCATE_VENUSVM05_VM5_L3A',
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
    'SWH_SPOT5_L1',
  ],
  Landsat: [
    'MUSCATE_Landsat57_LANDSAT5_N2A',
    'MUSCATE_Landsat57_LANDSAT7_N2A',
    'MUSCATE_LANDSAT_LANDSAT8_L2A',
    'MUSCATE_Snow_LANDSAT8_L2B-SNOW',
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
    'POSTEL_LANDCOVER_GLOBCOVER',
  ],
  'GEOV2 AVHRR': [
    'POSTEL_VEGETATION_LAI',
    'POSTEL_VEGETATION_FCOVER',
    'POSTEL_VEGETATION_FAPAR',
    'POSTEL_VEGETATION_NDVI',
  ],
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
    'SPOT5_TAKE5',
  ],
  Landsat: ['LANDSAT5', 'LANDSAT7', 'LANDSAT8'],
  // OSO, Postel, and GEOV2 don't have platforms
};

// map collection names to available product codes
export const productsByCollection: Record<CollectionName, ProductCode[]> = {
  'Sentinel 1': ['SLC', 'GRD', 'OCN'],
  'Sentinel 2': ['L1C', 'L2A', 'L2B SNOW', 'L2B WATER', 'L3A'],
  Venus: ['L1C', 'L2A', 'L3A'],
  Spot: ['L1C', 'L1A', 'L2A'],
  Landsat: ['L2A', 'L2B SNOW', 'N2A'],
  OSO: ['L3B-OSO'],
  Postel: ['Vegetation', 'Radiation', 'Water', 'LandCover'],
  'GEOV2 AVHRR': ['Vegetation'],
};

// Map processing:level to product:type for queries and the datasets they apply to
export const products: ProductRegistry = {
  SLC: {
    collections: ['Sentinel 1'],
    'processing:level': ['L1'],
    'product:type': ['SLC'],
  },
  GRD: {
    collections: ['Sentinel 1'],
    'processing:level': ['L1'],
    'product:type': ['GRD'],
  },
  OCN: {
    collections: ['Sentinel 1'],
    'processing:level': ['L2'],
    'product:type': ['OCN'],
  },
  L1C: {
    collections: ['Sentinel 2', 'Venus', 'Spot'],
    'processing:level': ['L1C'],
    'product:type': ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C'],
  },
  L1A: {
    collections: ['Spot'],
    'processing:level': ['L1A'],
    'product:type': [
      'DEM',
      'REFLECTANCETOA',
      'DEM9V20',
      'DEMS9V20',
      'DEMS09V20',
      'DEMSV20',
      'DEPS9V20',
      'SPOTDEM',
    ],
  },
  L2A: {
    collections: ['Sentinel 2', 'Venus', 'Spot', 'Landsat'],
    'processing:level': ['L2A'],
    'product:type': ['REFLECTANCE'],
  },
  'L2B SNOW': {
    collections: ['Sentinel 2', 'Landsat'],
    'processing:level': ['L2B-SNOW'],
    'product:type': ['SNOW_MASK'],
  },
  'L2B WATER': {
    collections: ['Sentinel 2'],
    'processing:level': ['L2B-WATER'],
    'product:type': ['REFLECTANCE'],
  },
  L3A: {
    collections: ['Sentinel 2', 'Venus'],
    'processing:level': ['L3A'],
    'product:type': ['REFLECTANCE'],
  },
  N2A: {
    collections: ['Landsat'],
    'processing:level': ['N2A'],
    'product:type': ['REFLECTANCE'],
  },
  'L3B-OSO': {
    collections: ['OSO'],
    'processing:level': ['L3B-OSO'],
    'product:type': ['REFLECTANCE'],
  },
  // TODO: GEOV2 AVHRR has extra attribute
  Vegetation: {
    collections: ['Postel', 'GEOV2 AVHRR'],
    'product:type': ['Vegetation'],
  },
  Radiation: {
    collections: ['Postel'],
    'product:type': ['Radiation'],
  },
  Water: {
    collections: ['Postel'],
    'product:type': ['Water'],
  },
  LandCover: {
    collections: ['Postel'],
    'product:type': ['LandCover'],
  },
};

interface IStacBrowserDialogProps {
  controlPanelModel: IControlPanelModel;
  tracker: IJupyterGISTracker;
}

export function getProductCodesForCollection(
  collection: CollectionName,
): ProductCode[] {
  return [...productsByCollection[collection]]; // Return copy
}

const StacBrowser = ({ controlPanelModel }: IStacBrowserDialogProps) => {
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel,
  );

  useEffect(() => {
    const handleCurrentChanged = (
      _: IJupyterGISTracker,
      widget: IJupyterGISWidget | null,
    ) => {
      setJgisModel(widget?.model);
    };

    controlPanelModel.documentChanged.connect(handleCurrentChanged);

    return () => {
      controlPanelModel.documentChanged.disconnect(handleCurrentChanged);
    };
  }, [controlPanelModel]);

  return (
    <StacPanelView
      datasets={datasets}
      platforms={platforms}
      products={products}
      model={jgisModel}
    />
  );
};
export default StacBrowser;
