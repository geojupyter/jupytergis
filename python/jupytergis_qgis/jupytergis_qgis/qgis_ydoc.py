import base64
import tempfile

from typing import Any, Callable
from functools import partial

from pycrdt import Array, Map
from jupyter_ydoc.ybasedoc import YBaseDoc


def reversed_tree(root):
    if isinstance(root, list):
        return reversed([reversed_tree(el) for el in root])
    return root


class YQGISBase(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ydoc["layers"] = self._ylayers = Map()
        self._ydoc["sources"] = self._ysources = Map()
        self._ydoc["options"] = self._yoptions = Map()
        self._ydoc["layerTree"] = self._ylayerTree = Array()
        self._ydoc["metadata"] = self._ymetadata = Map()
        self._source = ""
        self._file_extension = None

    @property
    def layers(self) -> Map:
        return self._ylayers

    @property
    def sources(self) -> Map:
        return self._ysources

    @property
    def options(self) -> Map:
        return self._yoptions

    @property
    def layerTree(self) -> Array:
        return self._ylayerTree

    @property
    def metadata(self) -> Map:
        return self._ymetadata

    def version(self) -> str:
        return "0.1.0"

    def get(self):
        virtual_file = {
            "layers": self._ylayers.to_py(),
            "sources": self._ysources.to_py(),
            "layerTree": reversed_tree(self._ylayerTree.to_py()),
            "options": self._yoptions.to_py(),
            "metadata": self._ymetadata.to_py(),
        }
        source = self._save(virtual_file)

        if source is not None and source:
            self._source = source

        return self._source

    def set(self, value):
        virtual_file = self._load(value)

        self._source = value

        self._ylayers.clear()
        self._ylayers.update(virtual_file["layers"])

        self._ysources.clear()
        self._ysources.update(virtual_file["sources"])

        self._ylayerTree.clear()
        for obj in reversed_tree(virtual_file["layerTree"]):
            self._ylayerTree.append(obj)

        self._yoptions.clear()
        self._yoptions.update(virtual_file["options"])

        self._ymetadata.clear()
        self._ymetadata.update(virtual_file["metadata"])

    def observe(self, callback: Callable[[str, Any], None]):
        self.unobserve()
        self._subscriptions[self._ystate] = self._ystate.observe(
            partial(callback, "state")
        )
        self._subscriptions[self._ylayers] = self._ylayers.observe_deep(
            partial(callback, "layers")
        )
        self._subscriptions[self._ysources] = self._ysources.observe_deep(
            partial(callback, "sources")
        )
        self._subscriptions[self._yoptions] = self._yoptions.observe_deep(
            partial(callback, "options")
        )
        self._subscriptions[self._ylayerTree] = self._ylayerTree.observe(
            partial(callback, "layerTree")
        )
        self._subscriptions[self._ymetadata] = self._ymetadata.observe_deep(
            partial(callback, "meta")
        )

    def _load(self, source: str):
        # Lazy import because qgis may not be installed
        from .qgis_loader import import_project_from_qgis

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=self._file_extension
        ) as tmp:
            file_content = base64.b64decode(source)
            tmp.write(file_content)

        return import_project_from_qgis(tmp.name)

    def _save(self, virtual_file: dict[str, Any]):
        # Lazy export because qgis may not be installed
        from .qgis_loader import export_project_to_qgis

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=self._file_extension
        ) as tmp:
            if export_project_to_qgis(tmp.name, virtual_file):
                with open(tmp.name, "rb") as fd:
                    source = base64.encodebytes(fd.read()).decode("ascii")
                return source


class YQGS(YQGISBase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._file_extension = ".qgs"


class YQGZ(YQGISBase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._file_extension = ".qgz"
