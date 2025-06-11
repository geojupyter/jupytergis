import { IJupyterGISModel } from '@jupytergis/schema';

export interface IStacCollection {
  // Core fields
  type: 'Collection';
  stac_version: string;
  stac_extensions?: string[];
  id: string;
  title?: string;
  description: string;
  keywords?: string[];
  license: string;
  providers?: IStacProvider[];
  extent: IStacExtent;
  summaries?: {
    [key: string]: IStacRange | JSON;
  };
  links: IStacLink[];
  assets?: {
    [key: string]: IStacAsset;
  };

  // Allow extension fields
  //   [key: string]: any;
}

export interface IStacRange {
  minimum: number | string;
  maximum: number | string;
}

export interface IStacExtent {
  spatial: IStacSpacialExtent;
  temporal: IStacTemporalExtent;
}

export interface IStacTemporalExtent {
  interval: Array<[string | null, string | null]>; // Time intervals (start/end)
}

export interface IStacSpacialExtent {
  bbox: number[][]; // Array of bounding boxes ([west, south, east, north] or 3D)
}

export interface IStacProvider {
  name: string;
  description?: string;
  roles?: ['licensor' | 'producer' | 'processor' | 'host'];
  url?: string;
}

export interface IStacLink {
  rel: string; // Relationship type
  href: string;
  type?: string; // Media type
  title?: string;
}

export interface IStacAsset {
  href: string;
  title?: string;
  description?: string;
  type?: string; // Media type
  roles?: string[];
}

// TODO: Remove stuff not in base stac item?
// TODO: Type stac extensions??? (seems like a future thing)
export interface IStacItem {
  type: 'Feature';
  stac_version: string;
  stac_extensions?: string[];
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[];
  } | null;
  // required if geometry is not null
  bbox: [number, number, number, number] | null;
  properties: {
    title: string;
    description: string;
    datetime: null | string;
    start_datetime: string;
    end_datetime: string;
    created: string;
    updated: string;
    platform: string;
    instruments: string[];
    constellation: string;
    mission: string;
    gsd: number;
    // Allow additional optional properties
    [key: string]: any;
  };
  links: {
    rel: string;
    href: string;
    type: string;
    title: string;
  }[];
  assets: Record<
    string,
    {
      href: string;
      title: string;
      type?: string;
      roles?: string[];
      // Allow additional optional properties
      [key: string]: any;
    }
  >;
  collection: string;
}

// ? IStacItemCollection with context extension
// TODO: add conext spec fields https://github.com/stac-api-extensions/context?tab=readme-ov-file
export interface IStacSearchResult {
  context: { returned: number; limit: number; matched: number };
  features: IStacItem[];
  links: IStacLink[];
  stac_extensions: string[];
  stac_version: string;
  type: 'FeatureCollection';
}

// export type ProductData = {
//   collections: string[];
//   'processing:level': string[];
//   'product:type': string[];
// };

export type ProductCode = string;
export type CollectionName =
  | 'Sentinel 1'
  | 'Sentinel 2'
  | 'Venus'
  | 'Spot'
  | 'Landsat'
  | 'OSO'
  | 'Postel'
  | 'GEOV2 AVHRR'; // Add other collections as needed

export interface IProductData {
  collections: string[];
  'product:type': string[];
  'processing:level'?: string[];
  instrument?: string;
}

export type ProductRegistry = Record<ProductCode, IProductData>;

export interface IStacQueryBody {
  bbox: [number, number, number, number];
  limit?: number;
  page?: number;
  query: {
    dataset: {
      in: string[];
    };
    end_datetime: {
      //TODO: Better typing for date string here?
      gte: string;
    };
    latest: {
      eq: true;
    };
    platform?: {
      in: string[];
    };
  };
  sortBy: [
    {
      direction: 'desc';
      field: 'start_datetime';
    }
  ];
}

export interface IStacViewProps {
  datasets: Record<string, string[]>;
  platforms: Record<string, string[]>;
  products: Record<string, IProductData>;
  model?: IJupyterGISModel;
}
