# Test JupyterGIS

## Python unit tests

Requires `pytest` and `dirty-equals`:

```bash
pip install pytest dirty-equals
```

Run the tests:

```bash
pytest --color=yes -v python
```

## UI tests

We don't recommend running UI tests locally because they are browser-based tests and
differences between systems can cause test breakage.
Integration tests will run automatically in CI.

However, if you are developing a new UI test or editing an existing UI test, you may
want to run them locally.

**From the `ui-tests` directory:**

```bash
jlpm install                      # Install ui testing dependencies
jlpm playwright install chromium  # Install testing browser
jlpm run test                     # Run tests
```
