declare module 'ol-load-geopackage' {
  import { Source } from 'ol/source';

  function loadGpkg(
    filepath: string,
    displayProjection: string
  ): Promise<[Record<string, Source>, Record<string, string>]>;

  export = loadGpkg;
}
