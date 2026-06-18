import pytest

from jupytergis_core.colors import coerce_rgba


@pytest.mark.parametrize(
    "input,output",
    [
        pytest.param("white", [255, 255, 255, 1], id="1"),
        pytest.param([255, 255, 255, 1], [255, 255, 255, 1], id="2"),
        pytest.param("#ffffff", [255, 255, 255, 1], id="3"),
    ],
)
def test_colors(input, output):
    assert coerce_rgba(input) == output


def test_invalid_color():
    with pytest.raises(ValueError, match="Invalid color"):
        coerce_rgba("blabla")
