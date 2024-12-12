import json
from typing import Any, Callable
from functools import partial

from pycrdt import Array, Map
from jupyter_ydoc.ybasedoc import YBaseDoc


class YJGIS(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ydoc["layers"] = self._ylayers = Map()
        self._ydoc["sources"] = self._ysources = Map()
        self._ydoc["options"] = self._yoptions = Map()
        self._ydoc["layerTree"] = self._ylayerTree = Array()
        self._ydoc["metadata"] = self._ymetadata = Map()

    def version(self) -> str:
        return "0.1.0"

    def get(self) -> str:
        """
        Returns the content of the document.
        :return: Document's content.
        :rtype: Any
        """
        layers = self._ylayers.to_py()
        sources = self._ysources.to_py()
        options = self._yoptions.to_py()
        meta = self._ymetadata.to_py()
        layers_tree = self._ylayerTree.to_py()
        return json.dumps(
            dict(
                layers=layers,
                sources=sources,
                options=options,
                layerTree=layers_tree,
                metadata=meta,
            ),
            sort_keys=True,
            indent=2,
        )

    def set(self, value: str) -> None:
        """
        Sets the content of the document.
        :param value: The content of the document.
        :type value: Any
        """
        valueDict = json.loads(value)

        with self._ydoc.transaction():
            self._ylayers.clear()
            self._ylayers.update(valueDict.get("layers", {}))

            self._ysources.clear()
            self._ysources.update(valueDict.get("sources", {}))

            self._yoptions.clear()
            self._yoptions.update(valueDict.get("options", {}))

            self._ylayerTree.clear()
            self._ylayerTree.extend(valueDict.get("layerTree", []))

            self._ymetadata.clear()
            self._ymetadata.update(valueDict.get("metadata", {}))

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
