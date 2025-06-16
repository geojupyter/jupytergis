import { CollectionName, ProductCode } from './types/types';

// Datasets as array of objects with collections array
export const datasets = [
  { collections: ['Sentinel 1'], dataset: 'PEPS_S1_L1' },
  { collections: ['Sentinel 1'], dataset: 'PEPS_S1_L2' },
  { collections: ['Sentinel 2'], dataset: 'PEPS_S2_L1C' },
  { collections: ['Sentinel 2'], dataset: 'MUSCATE_SENTINEL2_SENTINEL2_L2A' },
  { collections: ['Sentinel 2'], dataset: 'MUSCATE_Snow_SENTINEL2_L2B-SNOW' },
  {
    collections: ['Sentinel 2'],
    dataset: 'MUSCATE_WaterQual_SENTINEL2_L2B-WATER',
  },
  { collections: ['Sentinel 2'], dataset: 'MUSCATE_SENTINEL2_SENTINEL2_L3A' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUS_VM1_L1C' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUSVM05_VM5_L1C' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUS_VM1_L2A' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUSVM05_VM5_L2A' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUS_VM1_L3A' },
  { collections: ['Venus'], dataset: 'MUSCATE_VENUSVM05_VM5_L3A' },
  { collections: ['Spot'], dataset: 'MUSCATE_SPOTWORLDHERITAGE_SPOT1_L1C' },
  { collections: ['Spot'], dataset: 'MUSCATE_SPOTWORLDHERITAGE_SPOT2_L1C' },
  { collections: ['Spot'], dataset: 'MUSCATE_SPOTWORLDHERITAGE_SPOT3_L1C' },
  { collections: ['Spot'], dataset: 'TAKE5_SPOT4_L1C' },
  { collections: ['Spot'], dataset: 'MUSCATE_SPOTWORLDHERITAGE_SPOT4_L1C' },
  { collections: ['Spot'], dataset: 'TAKE5_SPOT4_L2A' },
  { collections: ['Spot'], dataset: 'TAKE5_SPOT5_L2A' },
  { collections: ['Spot'], dataset: 'TAKE5_SPOT5_L1C' },
  { collections: ['Spot'], dataset: 'MUSCATE_SPOTWORLDHERITAGE_SPOT5_L1C' },
  { collections: ['Spot'], dataset: 'MUSCATE_Spirit_SPOT5_L1A' },
  { collections: ['Spot'], dataset: 'SWH_SPOT123_L1' },
  { collections: ['Spot'], dataset: 'SWH_SPOT4_L1' },
  { collections: ['Spot'], dataset: 'SWH_SPOT5_L1' },
  { collections: ['Landsat'], dataset: 'MUSCATE_Landsat57_LANDSAT5_N2A' },
  { collections: ['Landsat'], dataset: 'MUSCATE_Landsat57_LANDSAT7_N2A' },
  { collections: ['Landsat'], dataset: 'MUSCATE_LANDSAT_LANDSAT8_L2A' },
  { collections: ['Landsat'], dataset: 'MUSCATE_Snow_LANDSAT8_L2B-SNOW' },
  { collections: ['OSO'], dataset: 'MUSCATE_OSO_RASTER_L3B-OSO' },
  { collections: ['OSO'], dataset: 'MUSCATE_OSO_VECTOR_L3B-OSO' },
  { collections: ['Postel'], dataset: 'POSTEL_VEGETATION_LAI' },
  { collections: ['Postel'], dataset: 'POSTEL_VEGETATION_FCOVER' },
  { collections: ['Postel'], dataset: 'POSTEL_VEGETATION_FAPAR' },
  { collections: ['Postel'], dataset: 'POSTEL_VEGETATION_NDVI' },
  { collections: ['Postel'], dataset: 'POSTEL_VEGETATION_SURFACEREFLECTANCE' },
  { collections: ['Postel'], dataset: 'POSTEL_RADIATION_BRDF' },
  { collections: ['Postel'], dataset: 'POSTEL_RADIATION_DLR' },
  { collections: ['Postel'], dataset: 'POSTEL_RADIATION_SURFACEREFLECTANCE' },
  { collections: ['Postel'], dataset: 'POSTEL_RADIATION_SURFACEALBEDO' },
  { collections: ['Postel'], dataset: 'POSTEL_WATER_SOILMOISTURE' },
  { collections: ['Postel'], dataset: 'POSTEL_WATER_SWI' },
  { collections: ['Postel'], dataset: 'POSTEL_WATER_SURFWET' },
  { collections: ['Postel'], dataset: 'POSTEL_WATER_PRECIP' },
  { collections: ['Postel'], dataset: 'POSTEL_LANDCOVER_GLOBCOVER' },
  { collections: ['GEOV2 AVHRR'], dataset: 'POSTEL_VEGETATION_LAI' },
  { collections: ['GEOV2 AVHRR'], dataset: 'POSTEL_VEGETATION_FCOVER' },
  { collections: ['GEOV2 AVHRR'], dataset: 'POSTEL_VEGETATION_FAPAR' },
  { collections: ['GEOV2 AVHRR'], dataset: 'POSTEL_VEGETATION_NDVI' },
];

// map collection names to available platforms
export const platforms = [
  { collections: ['Sentinel 1'], platform: 'S1A' },
  { collections: ['Sentinel 1'], platform: 'S1B' },
  { collections: ['Sentinel 2'], platform: 'S2A' },
  { collections: ['Sentinel 2'], platform: 'S2B' },
  { collections: ['Sentinel 2'], platform: 'S2X' },
  { collections: ['Venus'], platform: 'VM1' },
  { collections: ['Venus'], platform: 'VM5' },
  { collections: ['Spot'], platform: 'SPOT1' },
  { collections: ['Spot'], platform: 'SPOT2' },
  { collections: ['Spot'], platform: 'SPOT3' },
  { collections: ['Spot'], platform: 'SPOT4' },
  { collections: ['Spot'], platform: 'SPOT5' },
  { collections: ['Spot'], platform: 'SPOT4_TAKE5' },
  { collections: ['Spot'], platform: 'SPOT5_TAKE5' },
  { collections: ['Landsat'], platform: 'LANDSAT5' },
  { collections: ['Landsat'], platform: 'LANDSAT7' },
  { collections: ['Landsat'], platform: 'LANDSAT8' },
  // OSO, Postel, and GEOV2 don't have platforms
];

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

// Products as array of objects with collections and productType arrays
export const products = [
  {
    productCode: 'SLC',
    collections: ['Sentinel 1'],
    processingLevel: 'L1',
    productType: ['SLC'],
  },
  {
    productCode: 'GRD',
    collections: ['Sentinel 1'],
    processingLevel: 'L1',
    productType: ['GRD'],
  },
  {
    productCode: 'OCN',
    collections: ['Sentinel 1'],
    processingLevel: 'L2',
    productType: ['OCN'],
  },
  {
    productCode: 'L1C',
    collections: ['Sentinel 2', 'Venus', 'Spot'],
    processingLevel: 'L1C',
    productType: ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C'],
  },
  {
    productCode: 'L1A',
    collections: ['Spot'],
    processingLevel: 'L1A',
    productType: [
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
  {
    productCode: 'L2A',
    collections: ['Sentinel 2', 'Venus', 'Spot', 'Landsat'],
    processingLevel: 'L2A',
    productType: ['REFLECTANCE'],
  },
  {
    productCode: 'L2B SNOW',
    collections: ['Sentinel 2', 'Landsat'],
    processingLevel: 'L2B-SNOW',
    productType: ['SNOW_MASK'],
  },
  {
    productCode: 'L2B WATER',
    collections: ['Sentinel 2'],
    processingLevel: 'L2B-WATER',
    productType: ['REFLECTANCE'],
  },
  {
    productCode: 'L3A',
    collections: ['Sentinel 2', 'Venus'],
    processingLevel: 'L3A',
    productType: ['REFLECTANCE'],
  },
  {
    productCode: 'N2A',
    collections: ['Landsat'],
    processingLevel: 'N2A',
    productType: ['REFLECTANCE'],
  },
  {
    productCode: 'L3B-OSO',
    collections: ['OSO'],
    processingLevel: 'L3B-OSO',
    productType: ['REFLECTANCE'],
  },
  {
    productCode: 'Vegetation',
    collections: ['Postel', 'GEOV2 AVHRR'],
    productType: ['Vegetation'],
  },
  {
    productCode: 'Radiation',
    collections: ['Postel'],
    productType: ['Radiation'],
  },
  { productCode: 'Water', collections: ['Postel'], productType: ['Water'] },
  {
    productCode: 'LandCover',
    collections: ['Postel'],
    productType: ['LandCover'],
  },
];

// P sure I won't need these

// Utility to convert products array to Record<string, IProductData>
export function groupProductsByCode(
  arr: {
    productCode: string;
    collections: string[];
    processingLevel?: string;
    productType: string[];
  }[],
): Record<string, any> {
  return arr.reduce(
    (acc, { productCode, collections, processingLevel, productType }) => {
      if (!acc[productCode]) {
        acc[productCode] = { collections: [], 'product:type': [] };
      }
      collections.forEach(collection => {
        if (!acc[productCode].collections.includes(collection)) {
          acc[productCode].collections.push(collection);
        }
      });
      if (processingLevel) {
        if (!acc[productCode]['processing:level']) {
          acc[productCode]['processing:level'] = [];
        }
        if (!acc[productCode]['processing:level'].includes(processingLevel)) {
          acc[productCode]['processing:level'].push(processingLevel);
        }
      }
      productType.forEach(pt => {
        if (!acc[productCode]['product:type'].includes(pt)) {
          acc[productCode]['product:type'].push(pt);
        }
      });
      return acc;
    },
    {} as Record<string, any>,
  );
}
export function getProductCodesForCollection(
  collection: CollectionName,
): ProductCode[] {
  return [...productsByCollection[collection]]; // Return copy
}

// Utility to convert datasets array to Record<string, string[]>
export function groupDatasetsByCollection(
  arr: { collections: string[]; dataset: string }[],
): Record<string, string[]> {
  return arr.reduce(
    (acc, { collections, dataset }) => {
      collections.forEach(collection => {
        if (!acc[collection]) {
          acc[collection] = [];
        }
        acc[collection].push(dataset);
      });
      return acc;
    },
    {} as Record<string, string[]>,
  );
}

// Utility to convert platforms array to Record<string, string[]>
export function groupPlatformsByCollection(
  arr: { collections: string[]; platform: string }[],
): Record<string, string[]> {
  return arr.reduce(
    (acc, { collections, platform }) => {
      collections.forEach(collection => {
        if (!acc[collection]) {
          acc[collection] = [];
        }
        acc[collection].push(platform);
      });
      return acc;
    },
    {} as Record<string, string[]>,
  );
}
