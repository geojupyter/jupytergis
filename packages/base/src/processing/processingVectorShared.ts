import {
  ProcessingMerge,
  ProcessingLogicType,
} from '@jupytergis/schema';

/**
 * Iterate only vector processing definitions.
 */
export function forEachVectorProcessing(
  cb: (proc: any) => void,
): void {
  for (const proc of ProcessingMerge) {
    if (proc.type === ProcessingLogicType.vector) {
      cb(proc);
    }
  }
}

/**
 * Shared GDAL options builder.
 */
export function buildGeoJsonSqlOptions(sql: string): string[] {
  return [
    '-f',
    'GeoJSON',
    '-dialect',
    'SQLITE',
    '-sql',
    sql,
    'output.geojson',
  ];
}
