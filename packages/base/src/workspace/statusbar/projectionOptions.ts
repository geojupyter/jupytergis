import projCodes from 'proj-codes';

export interface IProjectionOption {
  code: string;
  name: string;
  proj4string: string;
}

// Temporary short list for projection-switch testing.
const TEMP_PROJECTION_CODES = new Set([
  'EPSG:3857',
  'EPSG:4326',
  'EPSG:2154', // RGF93 / Lambert-93 — projected, not web mercator
]);

export const PROJECTION_OPTIONS: IProjectionOption[] = Object.entries(projCodes)
  .filter(([code]) => TEMP_PROJECTION_CODES.has(code))
  .map(([code, info]) => ({
    code,
    name: info.name,
    proj4string: info.proj4string,
  }));

const PROJECTION_BY_CODE = new Map(
  PROJECTION_OPTIONS.map(option => [option.code, option]),
);

export function getProjectionOption(
  code: string | undefined,
): IProjectionOption | undefined {
  if (!code) {
    return undefined;
  }

  return PROJECTION_BY_CODE.get(code);
}

export function projectionMatches(
  option: IProjectionOption,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    option.code.toLowerCase().includes(needle) ||
    option.name.toLowerCase().includes(needle)
  );
}
