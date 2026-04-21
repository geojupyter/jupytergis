"""Migration tests.

Each version pair (from_v, to_v) is tested against all fixture files that
exist in both ``test-fixtures/migrations/<from_v>/`` and
``test-fixtures/migrations/<to_v>/``. The migrated output must be JSON-equal
to the committed expected file — this is the shared source of truth across
Python and JS.
"""

import json
from pathlib import Path

import pytest

from jupytergis_core.migrations import migrate

FIXTURES_ROOT = (
    Path(__file__).parents[4] / "packages" / "schema" / "test-fixtures" / "migrations"
)

VERSION_PAIRS = [
    ("v0.5.0", "v0.6.0"),
]


def _fixture_pairs(from_v: str, to_v: str) -> list[tuple[Path, Path]]:
    from_dir = FIXTURES_ROOT / from_v
    to_dir = FIXTURES_ROOT / to_v
    if not from_dir.is_dir() or not to_dir.is_dir():
        return []
    names = {p.name for p in from_dir.glob("*.jGIS")} & {
        p.name for p in to_dir.glob("*.jGIS")
    }
    return [(from_dir / n, to_dir / n) for n in sorted(names)]


@pytest.mark.parametrize(
    "from_path,to_path",
    [
        pytest.param(fp, tp, id=f"{pair[0]}->{pair[1]}/{fp.name}")
        for pair in VERSION_PAIRS
        for fp, tp in _fixture_pairs(*pair)
    ],
)
def test_migration_fixture(from_path: Path, to_path: Path) -> None:
    doc = json.loads(from_path.read_text())
    expected = json.loads(to_path.read_text())
    result = migrate(doc)
    assert result == expected
