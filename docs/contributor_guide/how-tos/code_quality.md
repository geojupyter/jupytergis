# Check code quality

```{seealso}
Complete [dev install](../development_setup) instructions before continuing.
```

We have several tools configured for checking code quality:

- **Pre-commit checks run automatically at commit time.**
  Install checks with `pre-commit install`.
  Run them manually with `pre-commit run --all-files`.
  **Will exit non-zero when finding errors or changing files.**
  - Ruff formats and lints (sometimes autofixes) Python code.

  - Generic pre-commit checks help avoid common mistakes like committing large
    files or trailing whitespace.

- **Formatting and lint checks and autofixers for Typescript, Javascript, CSS, JSON, Markdown, and YAML.**
  Defined as package scripts (in `package.json`).
  Run manually with `jlpm run lint`.
  **Will exit 0 when applying fixes.**
  **Check the logs and/or `git status` after every run.**
  - Prettier formats the file types listed above.

  - Eslint lints (sometimes autofixes) JS/TS code.

- **UI tests using [Galata](https://github.com/jupyterlab/galata)**, defined in the
  `ui-tests/` directory.

  ```{warning}
  Some UI tests depend on snapshot (screenshot) comparison, which depends strongly on
  the system used to generate the snapshots. Variables like GPU, operating system,
  display scaling, and more can affect the outcome of snapshot testing. The instructions
  below will skip snapshot tests for this reason. Please **do not** run snapshot tests
  locally and instead rely on CI (GitHub Actions).
  ```

  To run locally:

  ```bash
  cd ui-tests
  jlpm install             # If you haven't already
  jlpm playwright install  # If you haven't already
  jlpm run test:local      # Or, to test in jupyterlite, run `test:locallite`
  ```

  - DOM testing: Interact with the application programmatically and verify
    resulting DOM looks correct.

  - Snapshot testing: Interact with the application programmatically and verify
    the resulting rendered content exactly matches snapshots in this
    repository.
    When snapshot tests fail, new snapshots can be generated by
    commenting `please update snapshots` in a PR or locally running
    `jlpm run test:update` from the `ui-tests/` directory.
    Please carefully verify the snapshot changes are as expected before merging.
