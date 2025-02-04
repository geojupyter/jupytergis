============
Code quality
============

We have several tools configured for checking code quality:

* Pre-commit checks run automatically at commit time.
  Install checks with ``pre-commit install``.
  Run them manually with ``pre-commit run --all-files``.
  **Will exit non-zero when finding errors or changing files.**

  * Ruff formats and lints (sometimes autofixes) Python code.

  * Generic pre-commit checks help avoid common mistakes like committing large
    files or trailing whitespace.

* Package scripts (defined in ``package.json``) to check (and/or fix)
  TypeScript, JavaScript, CSS, JSON, Markdown, and YAML.
  Run manually with ``jlpm run lint``.
  **Will exit 0 when applying fixes.
  Check the logs and/or ``git status`` after every run.**

  * Prettier formats the file types listed above.

  * Eslint lints (sometimes autofixes) JS/TS code.
