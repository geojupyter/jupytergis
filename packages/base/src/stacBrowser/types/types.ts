export interface IStacCollectionsReturn {
  collections: IStacCollection[];
  links: IStacLink[];
}

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
}

export interface IStacRange {
  minimum: number | string;
  maximum: number | string;
}

export interface IStacExtent {
  spatial: IStacSpatialExtent;
  temporal: IStacTemporalExtent;
}

export interface IStacTemporalExtent {
  interval: Array<[string | null, string | null]>; // Time intervals (start/end)
}

export interface IStacSpatialExtent {
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

/**
 * Extended STAC link with optional method and body for pagination.
 * Used for pagination links that may include HTTP method and request body.
 */
export interface IStacPaginationLink extends IStacLink {
  method?: string;
  body?: IStacQueryBodyUnion;
}

export interface IStacAsset {
  href: string;
  title?: string;
  description?: string;
  type?: string; // Media type
  roles?: string[];
}

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
  links: IStacLink[];
  assets: Record<string, IStacAsset>;
  collection: string;
}

export interface IStacSearchResult {
  context: { returned: number; limit: number; matched: number };
  features: IStacItem[];
  links: IStacLink[];
  stac_extensions: string[];
  stac_version: string;
  type: 'FeatureCollection';
}

/**
 * CQL2-JSON filter condition structure for STAC Filter Extension queries.
 * For datetime values, the second argument is wrapped in a timestamp object.
 */
export interface IStacFilterCondition {
  op: '=' | '!=' | '<' | '<=' | '>' | '>=';
  args: [
    { property: string },
    string | number | { timestamp: string },
  ];
}

/**
 * CQL2-JSON filter structure for STAC Filter Extension queries.
 */
export interface IStacCql2Filter {
  op: 'and' | 'or';
  args: IStacFilterCondition[];
}

/**
 * Query body for STAC catalogs that support the Filter Extension (CQL2-JSON).
 * Used for generic STAC searches with filter extension support.
 */
export interface IStacFilterExtensionQueryBody {
  bbox: [number, number, number, number];
  collections: string[];
  datetime: string; // ISO 8601 datetime range (e.g., "2023-01-01T00:00:00Z/2023-12-31T23:59:59Z")
  limit: number;
  'filter-lang': 'cql2-json';
  filter?: IStacCql2Filter;
  page?: number;
}

// ! this is just for geodes -- move to hook
export interface IStacQueryBody {
  bbox: [number, number, number, number];
  limit?: number;
  page?: number;
  query: {
    dataset: {
      in: string[];
    };
    end_datetime: {
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
    },
  ];
}

/**
 * Union type for all STAC query body formats.
 * Used in contexts that need to accept multiple query formats.
 */
export type IStacQueryBodyUnion =
  | IStacQueryBody
  | IStacFilterExtensionQueryBody;

export type StacFilterKey =
  | 'collections'
  | 'datasets'
  | 'platforms'
  | 'products';

// Generic filter state object
export type StacFilterState = Record<StacFilterKey, Set<string>>;

// Filter state with string[] for saving in StateDB
export type StacFilterStateStateDb = { [K in keyof StacFilterState]: string[] };

// Generic filter setter object
export type StacFilterSetters = Record<
  StacFilterKey,
  (val: Set<string>) => void
>;

// Shared type for setResults function signature
export type SetResultsFunction = (
  results: IStacItem[],
  isLoading: boolean,
  totalResults: number,
  totalPages: number,
) => void;
