from __future__ import annotations
from copy import deepcopy

import json
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pycrdt import Array, Doc, Map
from pydantic import BaseModel
from ypywidgets.comm import CommWidget

from uuid import uuid4

from .utils import normalize_path

logger = logging.getLogger(__file__)


class GISDocument(CommWidget):
    """
    Create a new GISDocument object.

    :param path: the path to the file that you would like to open.
    If not provided, a new empty document will be created.
    """

    def __init__(self, path: Optional[str] = None):
        comm_metadata = GISDocument._path_to_comm(path)

        ydoc = Doc()

        super().__init__(
            comm_metadata=dict(ymodel_name="@jupytergis:widget", **comm_metadata),
            ydoc=ydoc,
        )

        self.ydoc["layers"] = self._layers = Array()
        self.ydoc["options"] = self._options = Map()

    @property
    def objects(self) -> List[str]:
        """
        Get the list of objects that the document contains as a list of strings.
        """
        if self._layers:
            return [x["name"] for x in self._layers]
        return []

    @classmethod
    def _path_to_comm(cls, filePath: Optional[str]) -> Dict:
        path = None
        format = None
        contentType = None

        if filePath is not None:
            path = normalize_path(filePath)
            file_name = Path(path).name
            try:
                ext = file_name.split(".")[1].lower()
            except Exception:
                raise ValueError("Can not detect file extension!")
            if ext == "jgis":
                format = "text"
                contentType = "jgis"
            else:
                raise ValueError("File extension is not supported!")
        return dict(
            path=path, format=format, contentType=contentType, createydoc=path is None
        )
