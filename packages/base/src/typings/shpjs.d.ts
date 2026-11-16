import 'shpjs';

declare module 'shpjs' {
  interface ShpJS {
    (parts: {
      shp: ArrayBuffer;
      dbf?: ArrayBuffer;
      prj?: ArrayBuffer;
      cpg?: ArrayBuffer;
    }): Promise<FeatureCollectionWithFilename>;
  }
}
