/**
 * Migration tests.
 *
 * Each version pair is tested against all fixture files that exist in both
 * test-fixtures/migrations/<from>/ and test-fixtures/migrations/<to>/. The
 * migrated output must be JSON-equal to the committed expected file — the same
 * source of truth as the Python migration tests.
 */

import fs from 'fs';
import path from 'path';

import { migrateDocument } from '../../../schema/src/migrations';

const FIXTURES_ROOT = path.resolve(
  __dirname,
  '../../../../packages/schema/test-fixtures/migrations',
);

const VERSION_PAIRS: [string, string][] = [['v0.5.0', 'v0.6.0']];

function sharedFixtureNames(fromV: string, toV: string): string[] {
  const fromDir = path.join(FIXTURES_ROOT, fromV);
  const toDir = path.join(FIXTURES_ROOT, toV);
  if (!fs.existsSync(fromDir) || !fs.existsSync(toDir)) {
    return [];
  }
  const fromNames = new Set(
    fs.readdirSync(fromDir).filter(n => n.endsWith('.jGIS')),
  );
  return fs
    .readdirSync(toDir)
    .filter(n => n.endsWith('.jGIS') && fromNames.has(n))
    .sort();
}

describe('document migrations', () => {
  for (const [fromV, toV] of VERSION_PAIRS) {
    const names = sharedFixtureNames(fromV, toV);

    describe(`${fromV} → ${toV}`, () => {
      if (names.length === 0) {
        it.todo('no shared fixtures found');
      } else {
        for (const name of names) {
          it(name, () => {
            const doc = JSON.parse(
              fs.readFileSync(path.join(FIXTURES_ROOT, fromV, name), 'utf8'),
            );
            const expected = JSON.parse(
              fs.readFileSync(path.join(FIXTURES_ROOT, toV, name), 'utf8'),
            );
            expect(migrateDocument(doc)).toEqual(expected);
          });
        }
      }
    });
  }
});
