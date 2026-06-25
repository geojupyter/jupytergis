import pytest

from jupytergis_core.colors import coerce_rgba, rgb_to_hex


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


@pytest.mark.parametrize(
    "input,output",
    [
        pytest.param("255,0,0", "#ff0000", id="red"),
        pytest.param("0,255,0,255", "#00ff00", id="green_with_alpha"),
        pytest.param("0,0,255,128", "#0000ff", id="blue_with_alpha"),
    ],
)
def test_rgb_to_hex(input, output):
    assert rgb_to_hex(input) == output
