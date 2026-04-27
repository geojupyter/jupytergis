/**
 * JupyterGIS document migration runner.
 *
 * Each step in STEPS is a { from, to, migrate } record where `migrate` takes
 * a parsed document object and returns a new object. Steps must be listed in
 * order and form a contiguous chain.
 */

import { migrate as migrateV0_5ToV0_6 } from './v0_5_to_v0_6';
import { SCHEMA_VERSION } from '../_interface/version';

interface IMigrationStep {
  from: string;
  to: string;
  migrate: (doc: Record<string, any>) => Record<string, any>;
}

const STEPS: IMigrationStep[] = [
  { from: '0.5.0', to: '0.6.0', migrate: migrateV0_5ToV0_6 },
];

/**
 * Apply all necessary migration steps to bring *doc* up to *toVersion*.
 *
 * @param doc - Parsed jGIS document object.
 * @param toVersion - Target schema version. Defaults to the current
 *   SCHEMA_VERSION if omitted.
 * @throws If the document's version is newer than the current schema version.
 */
export function migrateDocument(
  doc: Record<string, any>,
  toVersion?: string,
): Record<string, any> {
  const target = toVersion ?? SCHEMA_VERSION;
  const fileVersion: string = doc.schemaVersion ?? '0.5.0';

  if (_compareVersions(fileVersion, SCHEMA_VERSION) > 0) {
    throw new Error(
      `Cannot load file with schema version ${fileVersion} (current: ${SCHEMA_VERSION})`,
    );
  }

  let current = fileVersion;
  let result = { ...doc };

  for (const step of STEPS) {
    if (
      _compareVersions(current, step.to) < 0 &&
      _compareVersions(step.to, target) <= 0
    ) {
      result = step.migrate(result);
      result.schemaVersion = step.to;
      current = step.to;
    }
  }

  return result;
}

/** Simple semver comparison: returns negative, 0, or positive. */
function _compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
