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
            if ext == "fcstd":
                self._format = "base64"
                self._contentType = "FCStd"
            elif ext == "jcad":
                self._format = "text"
                self._contentType = "jcad"
            else:
                raise Exception("File extension is not supported!")
        comm_data = {
            "path": self.path,
            "format": self._format,
            "contentType": self._contentType,
        }
        super().__init__(name="@jupytercad:widget", open_comm=True, comm_data=comm_data)
