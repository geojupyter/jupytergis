# Review: PR #1268 — SymbologyState as source of truth

**PR:** https://github.com/geojupyter/jupytergis/pull/1268
**Author:** arjxn-py (Arjun Verma)
**Branch:** arjxn-py/jupytergis:compute-symbology-on-runtime

## Summary

Makes `symbologyState` the single source of truth for vector layer rendering.
Previously, computed OpenLayers `FlatStyle` expressions were stored in
`parameters.color` (causing e.g. roads.jGIS to be 7,461 lines). Now only the
configuration is persisted and the OL style is derived at runtime via the new
`styleBuilder.ts`.

Key new files:

- `styleBuilder.ts` — computes `FlatStyle` from `symbologyState` + live feature values
- `symbologyMigration.ts` — migrates legacy `.jGIS` files with `parameters.color` on load

---

## Build errors

- [ ] **[`SimpleSymbol.tsx:92-93`](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/features/layers/symbology/vector_layer/types/SimpleSymbol.tsx#L92-L93)** — `joinStyle` and `capStyle` read from `styleRef.current`
      are typed as `string` but `SymbologyState` expects the literal union types.
      Fix: cast to `SymbologyState['joinStyle']` / `SymbologyState['capStyle']`.

---

## Schema / breaking changes

- [ ] **`reverse` → `reverseRamp` rename** — breaking change for existing `.jGIS` files that
      use `symbologyState.reverse: true`. The migration code does not handle this rename.
      Old files will silently lose the reverse setting. This is exactly the kind of change that
      would be handled by the migration infrastructure proposed in #1320. Blocker: this PR must
      either add a migration for the rename, or defer the rename until #1320 is in place.

---

## Design / architecture concerns

- [ ] **[`generateColors` division by zero](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/features/layers/symbology/styleBuilder.ts#L416)** — when `nClasses === 1`, the expression `i / (nClasses - 1)` divides by zero, producing `NaN`
      for the color map index. This would cause the single-class case to return a broken color.

- [ ] **`stopsOverride` discussed in comments but no UI** — reviewers asked for it, the field
      exists in [`styleBuilder.ts`](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/features/layers/symbology/styleBuilder.ts#L136-L158), but there's no way for users to actually set it from the UI yet.
      Should be clarified whether this is in scope for this PR or a follow-up.

- [ ] **Migration never persists** — [`migrateLegacyLayerSymbology`](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/features/layers/symbology/symbologyMigration.ts#L13-L29) mutates the layer object
      directly, bypassing the CRDT/document API. The migration only applies in-memory; the `.jGIS`
      file is never updated. This means every load of an old file re-runs the migration. Needs a
      decision: either persist via the model API, or explicitly document this as intentional
      lazy migration.

- [ ] **[`featureValues` timing / no re-render on source load](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/mainview/mainView.tsx#L1607-L1614)** — `vectorLayerStyleRuleBuilder`
      calls `source.getFeatures()` to extract feature values for graduated/categorized styling.
      If the source hasn't loaded yet, `featureValues` is `[]` and the style falls back to
      `DEFAULT_FLAT_STYLE`. There is no `featuresloadend` listener to re-trigger style computation
      once the source finishes loading. This means graduated and categorized styles will not render
      correctly on initial load — they'll show the default style until something else triggers a
      style rebuild (e.g. a layer property change).

- [ ] **VectorTile layers can never get feature values** — for `VectorTileLayer`, `source` is
      not a `VectorSource` instance, so `featureValues` is always `[]`. This means graduated and
      categorized render types are silently broken for VectorTile layers — they always fall back to
      `DEFAULT_FLAT_STYLE`. This should either be documented as a known limitation or addressed.

- [ ] **[`migrateLegacyLayerSymbology` called on every style rebuild](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/mainview/mainView.tsx#L1600)** — migration runs inside
      `vectorLayerStyleRuleBuilder` which is called every time a layer's style needs updating, not
      just once on load. The `alreadyMigrated` guard prevents duplicate work, but the check still
      runs on every style computation. Migration should be a one-time operation.

---

## Dependencies

- [ ] **New runtime dependency: `branca>=0.6`** — added to `jupytergis_core` to power the new
      [`color_ramps.py`](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/python/jupytergis_core/jupytergis_core/color_ramps.py)
      module, which maps frontend color ramp names to `branca.LinearColormap` for use in the QGIS
      exporter and notebook API. `branca` is a Folium dependency and is commonly available, but
      it is not a lightweight package. Worth discussing whether this is acceptable as a hard
      dependency of `jupytergis_core` (which all users install), or whether it should be optional
      / scoped to the QGIS package.

---

## Minor

- [ ] **PR description is empty** — checklist items are all unchecked, no description of
      what changed or why.

- [ ] **Snapshot CI** — the bot was asked to update snapshots twice, suggesting UI test
      snapshots are still unstable / not final.

---

## Testing notes

To test manually:

1. Open `examples/earthquakes.jGIS` — graduated color by magnitude should render correctly
2. Open `examples/roads.jGIS` — should render correctly and the file should stay compact
3. Open `examples/world.jGIS`
4. Change symbology type (graduated, categorized, single symbol) and verify `.jGIS` file
   stays small (no large `color` blob written)
5. Test migration: open an old `.jGIS` file with a `parameters.color` blob — should
   auto-migrate and render correctly

---

## Test results

- [x] `earthquakes.jGIS` — renders correctly with graduated color by magnitude
- [x] `roads.jGIS` — renders correctly with colors
- [ ] `world.jGIS` — hangs: `geodata.ucdavis.edu` times out in dev environment (network issue,
      not a PR bug)
- [x] `earthquakes_old.jGIS` (old format with `parameters.color`) — renders correctly, but
      the file is **not updated on disk**. Migration runs in-memory only (direct object mutation,
      not through the CRDT/document layer). Old files stay in old format permanently unless the
      user edits the symbology and triggers a save.

---

## Confirmed bugs

- [ ] **Legend broken for all render types** — [`legendItem.tsx:77-80`](https://github.com/arjxn-py/jupytergis/blob/40ca323f7f69a49fee0493879b021e12505f824d/packages/base/src/workspace/panels/components/legendItem.tsx#L77-L80)
      reads fill/stroke from `symbology.color?.['fill-color']` (the old `parameters.color` blob).
      Since `parameters.color` no longer exists, `fill` and `stroke` are always `undefined`,
      causing all render types to fall through to their "No … symbology" fallback message.
      `legendItem.tsx` was not updated to use `buildVectorFlatStyle` from `styleBuilder.ts`.

---

## Notes / observations
