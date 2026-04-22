# Add a schema migration step

When the `.jGIS` file format changes (field renames, restructured data, new
required fields), a migration step must be added so that older files are
automatically upgraded on load. Migration runs in both load paths:

- **JupyterLab (with server):** `YJGIS.set()` in
  `python/jupytergis_core/jupytergis_core/jgis_ydoc.py`
- **JupyterLite (browser-only):** `fromString()` in
  `packages/schema/src/model.ts`

Both runners apply the same linear chain of version-to-version steps. A file
at any older version is brought up to the current schema version automatically.

## Steps to add a migration

### 1. Bump the schema version

Edit `packages/schema/src/schema/project/jgis.json` and increment the
`schemaVersion` default (e.g. `"0.6.0"` → `"0.7.0"`). The build script
regenerates `src/_interface/version.d.ts` and `version.js` automatically.

### 2. Write the Python step

Create `python/jupytergis_core/jupytergis_core/migrations/v0_6_to_v0_7.py`
with a `migrate(doc: dict) -> dict` function that takes the parsed document
and returns a transformed copy:

```python
def migrate(doc: dict) -> dict:
    layers = dict(doc.get("layers", {}))
    for layer_id, layer in layers.items():
        # ... transform layer ...
        layers[layer_id] = layer
    return {**doc, "layers": layers}
```

### 3. Register the Python step

Add the step to `STEPS` in
`python/jupytergis_core/jupytergis_core/migrations/__init__.py`:

```python
from . import v0_6_to_v0_7

STEPS = [
    ("0.5.0", "0.6.0", v0_5_to_v0_6.migrate),
    ("0.6.0", "0.7.0", v0_6_to_v0_7.migrate),  # new
]
```

### 4. Write the JS step

Create `packages/schema/src/migrations/v0_6_to_v0_7.ts` with a `migrate`
function that operates on a plain JSON object:

```typescript
export function migrate(doc: Record<string, any>): Record<string, any> {
  const layers = { ...doc.layers };
  for (const [id, layer] of Object.entries(layers) as [string, any][]) {
    // ... transform layer ...
    layers[id] = { ...layer };
  }
  return { ...doc, layers };
}
```

### 5. Register the JS step

Add the step to `STEPS` in `packages/schema/src/migrations/index.ts`:

```typescript
import { migrate as migrateV0_6ToV0_7 } from './v0_6_to_v0_7';

const STEPS: IMigrationStep[] = [
  { from: '0.5.0', to: '0.6.0', migrate: migrateV0_5ToV0_6 },
  { from: '0.6.0', to: '0.7.0', migrate: migrateV0_6ToV0_7 }, // new
];
```

### 6. Add fixtures and tests

Fixtures live in `packages/schema/test-fixtures/migrations/`. Each version
directory holds `.jGIS` files; a migration step is tested for every file
that exists in both the `from` and `to` directories.

1. Create `packages/schema/test-fixtures/migrations/v0.6.0/<fixture>.jGIS`
   with a document in the old format (the input).
2. Run the Python migration to generate the expected output:
   ```bash
   python3 -c "
   import json
   from jupytergis_core.migrations import migrate
   doc = json.load(open('packages/schema/test-fixtures/migrations/v0.6.0/<fixture>.jGIS'))
   print(json.dumps(migrate(doc), indent=2, sort_keys=True))
   "
   ```
3. Save the output as
   `packages/schema/test-fixtures/migrations/v0.7.0/<fixture>.jGIS`.
4. Verify both test suites pass:
   ```bash
   pytest python/jupytergis_core/jupytergis_core/tests/test_migrations.py -v
   jlpm lerna run test --scope @jupytergis/base
   ```

## Rules

- **Steps must form a contiguous chain.** Each step's `to` version must equal
  the next step's `from` version.
- **Step functions must be pure.** Return a new dict/object; do not mutate
  the input.
- **Both Python and JS steps must produce identical output** for the same
  input. The committed fixture files are the shared source of truth — if the
  two implementations diverge, one of the test suites will fail.
- **A fixture file has an independent lifecycle.** Add it to a version
  directory when a new case appears; omit it from a later directory when it
  is no longer relevant. A step is only tested for files present in both the
  `from` and `to` directories.
