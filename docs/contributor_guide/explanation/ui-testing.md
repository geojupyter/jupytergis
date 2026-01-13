---
title: 'Explanation: UI testing'
---

# UI testing

JupyterGIS includes automated **user interface testing**, powered by
[Playwright](https://playwright.dev/).

This includes two types of tests:

- DOM testing:
  Interact with the application programmatically and verify the resulting DOM looks as
  expected.

- Snapshot (screenshot) testing:
  Interact with the application programmatically and verify the resulting rendered
  content ("actual"/"golden" snapshots) match the expected snapshots in this repository.
  When snapshot tests fail, new snapshots can be generated programmatically.
  See: {doc}`How to: update UI test snapshots </contributor_guide/how-tos/ui-tests-update-snapshots>`.

  ```{warning}
  Snapshot (screenshot) comparison depends strongly on
  the system used to generate the snapshots.
  Variables like GPU, operating system, display scaling, and more can affect the outcome
  of snapshot testing.
  Please **do not** run snapshot tests locally and instead rely on CI (GitHub Actions).
  ```

For more, see:

- {doc}`How to: debug UI test failures </contributor_guide/how-tos/ui-tests-debug-failures>`
- {doc}`How to: update UI test snapshots </contributor_guide/how-tos/ui-tests-update-snapshots>`
