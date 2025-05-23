declare module 'geoparquet' {
  export function asyncBufferFromUrl(url: any): any;
  export function asyncBufferFromFile(file: any): any;

  export function toGeoJson(buffer: any): any;
}