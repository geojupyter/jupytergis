# Test JupyterGIS

## Python unit tests

Install testing dependencies:

```bash
pip install --group test
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
jlpm playwright install chromium --only-shell  # Install testing browser
jlpm run test                     # Run tests
```

### Using a system-installed Chromium

The Playwright-bundled Chromium may not work on all systems (e.g. NixOS) because it
is dynamically linked against system libraries that may not be in the expected paths.
If you see errors like `error while loading shared libraries: libnspr4.so`, you can
use a system-installed Chromium instead:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium jlpm run test
```

This also works when updating snapshots:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium jlpm playwright test tests/showcase.spec.ts --update-snapshots
```
