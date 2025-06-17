// Datasets as array of objects with collections array
export const datasets = [
  { collection: 'Sentinel 1', datasets: ['PEPS_S1_L1', 'PEPS_S1_L2'] },
  {
    collection: 'Sentinel 2',
    datasets: [
      'PEPS_S2_L1C',
      'MUSCATE_SENTINEL2_SENTINEL2_L2A',
      'MUSCATE_Snow_SENTINEL2_L2B-SNOW',
      'MUSCATE_WaterQual_SENTINEL2_L2B-WATER',
      'MUSCATE_SENTINEL2_SENTINEL2_L3A',
    ],
  },
  {
    collection: 'Venus',
    datasets: [
      'MUSCATE_VENUS_VM1_L1C',
      'MUSCATE_VENUSVM05_VM5_L1C',
      'MUSCATE_VENUS_VM1_L2A',
      'MUSCATE_VENUSVM05_VM5_L2A',
      'MUSCATE_VENUS_VM1_L3A',
      'MUSCATE_VENUSVM05_VM5_L3A',
    ],
  },
  {
    collection: 'Spot',
    datasets: [
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
  },
  {
    collection: 'Landsat',
    datasets: [
      'MUSCATE_Landsat57_LANDSAT5_N2A',
      'MUSCATE_Landsat57_LANDSAT7_N2A',
      'MUSCATE_LANDSAT_LANDSAT8_L2A',
      'MUSCATE_Snow_LANDSAT8_L2B-SNOW',
    ],
  },
  {
    collection: 'OSO',
    datasets: ['MUSCATE_OSO_RASTER_L3B-OSO', 'MUSCATE_OSO_VECTOR_L3B-OSO'],
  },
  {
    collection: 'Postel',
    datasets: [
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
  },
  {
    collection: 'GEOV2 AVHRR',
    datasets: [
      'POSTEL_VEGETATION_LAI',
      'POSTEL_VEGETATION_FCOVER',
      'POSTEL_VEGETATION_FAPAR',
      'POSTEL_VEGETATION_NDVI',
    ],
  },
];

// map collection names to available platforms
export const platforms = [
  { collection: 'Sentinel 1', platforms: ['S1A', 'S1B'] },
  { collection: 'Sentinel 2', platforms: ['S2A', 'S2B', 'S2X'] },
  { collection: 'Venus', platforms: ['VM1', 'VM5'] },
  {
    collection: 'Spot',
    platforms: [
      'SPOT1',
      'SPOT2',
      'SPOT3',
      'SPOT4',
      'SPOT5',
      'SPOT4_TAKE5',
      'SPOT5_TAKE5',
    ],
  },
  { collection: 'Landsat', platforms: ['LANDSAT5', 'LANDSAT7', 'LANDSAT8'] },
  // OSO, Postel, and GEOV2 don't have platforms
];

// map collection names to available product codes
export const productsByCollection = {
  'Sentinel 1': [
    { productCode: 'SLC', productType: ['SLC'], processingLevel: 'L1' },
    { productCode: 'GRD', productType: ['GRD'], processingLevel: 'L1' },
    { productCode: 'OCN', productType: ['OCN'], processingLevel: 'L2' },
  ],
  'Sentinel 2': [
    {
      productCode: 'L1C',
      productType: ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C'],
      processingLevel: 'L1C',
    },
    {
      productCode: 'L2A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L2A',
    },
    {
      productCode: 'L2B SNOW',
      productType: ['SNOW_MASK'],
      processingLevel: 'L2B-SNOW',
    },
    {
      productCode: 'L2B WATER',
      productType: ['REFLECTANCE'],
      processingLevel: 'L2B-WATER',
    },
    {
      productCode: 'L3A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L3A',
    },
  ],
  Venus: [
    {
      productCode: 'L1C',
      productType: ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C'],
      processingLevel: 'L1C',
    },
    {
      productCode: 'L2A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L2A',
    },
    {
      productCode: 'L3A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L3A',
    },
  ],
  Spot: [
    {
      productCode: 'L1C',
      productType: ['REFLECTANCE', 'REFLECTANCETOA', 'S2MSI1C'],
      processingLevel: 'L1C',
    },
    {
      productCode: 'L1A',
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
      processingLevel: 'L1A',
    },
    {
      productCode: 'L2A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L2A',
    },
  ],
  Landsat: [
    {
      productCode: 'L2A',
      productType: ['REFLECTANCE'],
      processingLevel: 'L2A',
    },
    {
      productCode: 'L2B SNOW',
      productType: ['SNOW_MASK'],
      processingLevel: 'L2B-SNOW',
    },
    {
      productCode: 'N2A',
      productType: ['REFLECTANCE'],
      processingLevel: 'N2A',
    },
  ],
  OSO: [
    {
      productCode: 'L3B-OSO',
      productType: ['REFLECTANCE'],
      processingLevel: 'L3B-OSO',
    },
  ],
  Postel: [
    { productCode: 'Vegetation', productType: ['Vegetation'] },
    { productCode: 'Radiation', productType: ['Radiation'] },
    { productCode: 'Water', productType: ['Water'] },
    { productCode: 'LandCover', productType: ['LandCover'] },
  ],
  'GEOV2 AVHRR': [{ productCode: 'Vegetation', productType: ['Vegetation'] }],
};

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
