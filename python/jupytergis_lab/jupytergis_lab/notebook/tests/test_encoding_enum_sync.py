from jupytergis_lab.notebook.symbology import (
    _SCHEMA_ENCODING_VALUES,
    ENCODING_SHORTCUTS,
    VisualEncoding,
)


def test_VisualEncoding_matches_sources() -> None:
    """Check that the VisualEncoding Enum represents every expected key.

    Currently this Enum is managed manually to combine all possible values for encoding
    targets, including convenience shortcuts (e.g. "fill" for "fill-color" or
    "circle-fill-color").

    The reason we manage this Enum manually is that, while we could generate it at
    runtime from `ENCODING_SHORTCUTS` and `_SCHEMA_ENCODING_VALUES` (the latter is
    constructed from types generated from the schema), then we need to use the
    functional style of Enum, and Mypy can't statically analyze the Enum in that case.
    This test is the key to making the manually-managed approach work; if the
    manually-managed class-style Enum gets out of sync, this test will fail.
    """
    expected = {*ENCODING_SHORTCUTS.keys(), *_SCHEMA_ENCODING_VALUES}
    actual = {member.value for member in VisualEncoding}
    assert actual == expected, (
        "If this unit test fails, VisualEncoding is out of sync with the schema."
        " You need to update it manually!"
        " See the docstring of this test for more details."
    )


def test_VisualEncoding_names_match_values() -> None:
    """Check the member names of VisualEncoding match the values.

    Account for dashes vs underscores.
    """
    mismatches = {
        member.name: member.value
        for member in VisualEncoding
        if member.name != member.value.replace("-", "_")
    }

    assert not mismatches, f"Member names out of sync with values: {mismatches}"
