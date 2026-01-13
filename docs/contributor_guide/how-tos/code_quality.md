---
title: 'How to: check code quality'
---

# Check code quality

```{seealso}
Complete [dev install](/contributor_guide/development_setup) instructions before continuing.
```

We have several tools configured for checking code quality:

- **Pre-commit checks run automatically at commit time.**
  Install checks with `pre-commit install`.
  Run them manually with `pre-commit run --all-files`.
  **Will exit non-zero when finding errors or changing files.**
  Alternative: Comment `pre-commit.ci autofix` in a PR.
  This may not fix all errors, as not all errors are autofixable.
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

  To run locally:

  ```bash
  cd ui-tests
  jlpm install             # If you haven't already
  jlpm playwright install  # If you haven't already
  jlpm run test:local      # Or, to test in jupyterlite, run `test:locallite`
  ```

  For more, see :doc:`/contributor-guide/explanation/ui-testing.md`.
