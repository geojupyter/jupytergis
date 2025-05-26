declare module 'geoparquet' {
  export function asyncBufferFromUrl(options: {
    url: string;
    byteLength?: number;
    requestInit?: RequestInit;
  }): Promise<AsyncBuffer>;

  export function toGeoJson(options: {
    file: AsyncBuffer;
    compressors?: any;
  }): Promise<GeoJSON>;
};
