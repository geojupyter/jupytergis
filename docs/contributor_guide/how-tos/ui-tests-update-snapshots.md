# UI tests: Update snapshots

We use "snapshot" (screenshot) testing to verify that the UI appears as expected when
certain actions are performed.

When we intentionally change the UI, often our "expected" snapshots need to be updated
to prevent tests from failing!
This doc will help you do that.

If you're dealing with a case where the snapshots differ **unintentionally**, see
{doc}`How to: Debug failures in UI tests <./ui-tests-debug-failures>`.

See {doc}`Explanation: UI testing </contributor_guide/explanation/ui-testing>` for more background.

```{warning}
Snapshot (screenshot) comparison depends strongly on the system used to generate the
snapshots.
Variables like GPU, operating system, display scaling, and more can affect the outcome
of snapshot testing.
Please **do not run snapshot tests locally** and instead rely on CI (GitHub Actions).
```

## Automatic method (recommended)

In a PR which requires snapshot updates, add a comment containing the text:

```
please update snapshots
```

The bot will react with a thumbs-up 👍 to indicate that it's started the task.
If the user requesting the snapshot updates doesn't have the correct permissions, the
bot will react with a thumbs-down 👎.

This workflow is powered by a
[currently-unreleased reusable workflow from the `jupyterlab/maintainer-tools` repository](https://github.com/jupyterlab/maintainer-tools/pull/268).

## Manual method (for emergencies)

### 1) Download the test report

First, complete the "Download the test report" steps from
{doc}`How to: Debug failures in UI tests <./ui-tests-debug-failures>`.

For each failing test, this test reports includes the actual and expected snapshots and
an interface for comparing them.

### 2) Copy the desired "actual" snapshots to replace the "expected" snapshots in the repo

First, **find the "actual" snapshots from the failing tests that you wish to update**.
You may wish to use the Playwright report viewer as desribed in
{doc}`How to: Debug failures in UI tests <./ui-tests-debug-failures>`.

**Ensure the changes in the snapshot are as you expect them**.

**Locate the "actual" snapshot file in the `test-results/` directory**.
Within that directory, each test will have its own directory, which is named based on
the filepath and name of the failed test.
E.g.: `test-results/tests-geojson-layers--geoJSONLayer-Add-a-GeoJSON-layer-chromium/`
corresponds with a test in the JupyterGIS repository in the
`ui-tests/tests/geojson-layers.spec.ts` file named `Add a GeoJSON layer`.
The slashes and spaces have been replaced with hyphens to create the directory structure
in the `test-results/` directory.
Finally, the snapshot you want, within the above directory, will have `-actual` appended
to its filename.
E.g.: `test-results/tests-geojson-layers--geoJSONLayer-Add-a-GeoJSON-layer-chromium/geoJSON-layer-actual.png`

**Copy the "actual" snapshot from the `test-results/` directory structure into the
correct repository location**.
The target file that you need to replace will be located in the repository's
`ui-tests/tests/` directory, in the subdirectory which corresponds to the "actual"
snapshot file you found in the previous step.
E.g.: `ui-tests/tests/geojson-layers.spec.ts-snapshots/geoJSON-layer-chromium-linux.png`.

To replace it, you might run a command like:

```bash
cp /tmp/my-playwright-report/test-results/tests-geojson-layers--geoJSONLayer-Add-a-GeoJSON-layer-chromium/geoJSON-layer-actual.png ui-tests/tests/geojson-layers.spec.ts-snapshots/geoJSON-layer-chromium-linux.png
```

### 3) Verify

Please carefully verify in the GitHub Pull Request interface that the snapshot changes
are as expected before merging!

### Alternative: Claude Code plugin

Try
[Jeremy Tuloup's Claude Code plugin for maintaining repos in the Jupyter ecosystem](https://github.com/jtpio/jp-claude-plugin/).
It includes
[a command to update playwright snapshots from CI failures](https://github.com/jtpio/jp-claude-plugin/blob/main/plugins/jupyter-maintainer/commands/update-playwright-snapshots.md).
