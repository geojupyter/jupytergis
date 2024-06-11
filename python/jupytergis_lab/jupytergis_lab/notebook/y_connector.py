import logging
from typing import Optional

from ypywidgets import Widget

logger = logging.getLogger(__file__)


class YDocConnector(Widget):
    def __init__(self, path: Optional[str], **kwargs) -> None:
        self.path = None
        self._format = None
        self._contentType = None

        if path is not None:
            self.path = path
            try:
                ext = path.split(".")[1].lower()
            except Exception:
                raise Exception("Can not detect file extension!")
            if ext == "jgis":
                self._format = "text"
                self._contentType = "jgis"
            else:
                raise Exception("File extension is not supported!")
        comm_data = {
            "path": self.path,
            "format": self._format,
            "contentType": self._contentType,
        }
        super().__init__(name="@jupytergis:widget", open_comm=True, comm_data=comm_data)
