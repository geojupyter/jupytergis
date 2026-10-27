import projCodes from 'proj-codes';

export interface IProjectionOption {
  code: string;
  name: string;
  proj4string: string;
}

export const PROJECTION_OPTIONS: IProjectionOption[] = Object.entries(
  projCodes,
).map(([code, info]) => ({
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
