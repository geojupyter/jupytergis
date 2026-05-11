poc: Add external resource checking CI

Proof of concept for automated external resource checking to validate URLs in .jGIS files and layer gallery.

## Changes

- `.github/workflows/check-external-resources.yml`: New CI workflow
- `scripts/test_external_resources.py`: Enhanced resource checking

## Behavior

- Runs on PRs, pushes, and weekly schedule
- Tests all examples and layer gallery URLs
- Extracts urlParameters and maxZoom from source configurations
- Uses appropriate headers for services requiring browser-like requests
- Reports 404, 403, timeout, SSL, and CORS issues

## Current Status

- NASA GIBS URLs now working correctly
- Some legitimate failures remain and need investigation
- CORS warnings identified for JupyterLite compatibility
