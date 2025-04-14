# Testing

## Python unit tests

Requires `pytest` and `dirty-equals`:

```bash
pip install pytest dirty-equals
```

Run the tests:

```bash
pytest --color=yes -v python
```

## Integration tests

We don't recommend running integration tests locally because they are browser-based
tests and differences between systems can cause test breakage.

Integration tests will run automatically in CI.
