from pydantic import BaseModel
from typing import Literal, List, Union


class BaseSymbology(BaseModel):
    type: str


class GraduatedSymbology(BaseSymbology):
    type: Literal["graduated"] = "graduated"

    value: str
    data: List[float]

    method: str = "color"
    color_ramp: str | None = None
    n_classes: int = 10
    mode: str = "equal interval"
    reverse: bool = False


Symbology = Union[GraduatedSymbology]
