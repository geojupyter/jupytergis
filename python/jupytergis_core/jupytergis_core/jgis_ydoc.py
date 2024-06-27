import json
from typing import Any, Callable
from functools import partial

from pycrdt import Array, Map, Text
from jupyter_ydoc.ybasedoc import YBaseDoc


class YJGIS(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ydoc["source"] = self._ysource = Text()
        self._ydoc["layers"] = self._ylayers = Map()
        self._ydoc["sources"] = self._ysources = Map()
        self._ydoc["options"] = self._yoptions = Map()
        self._ydoc["layersTree"] = self._ylayersTree = Array()

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
        layers_tree = self._ylayersTree.to_py()
        return json.dumps(
            dict(layers=layers, sources=sources, options=options, layersTree=layers_tree),
            indent=2,
        )

    def set(self, value: str) -> None:
        """
        Sets the content of the document.
        :param value: The content of the document.
        :type value: Any
        """
        valueDict = json.loads(value)

        self._ylayers.clear()
        self._ylayers.update(valueDict.get("layers", {}))

        self._ysources.clear()
        self._ysources.update(valueDict.get("sources", {}))

        self._yoptions.clear()
        self._yoptions.update(valueDict.get("options", {}))

        self._ylayersTree.clear()
        self._ylayersTree.extend(valueDict.get("layersTree", []))

    def observe(self, callback: Callable[[str, Any], None]):
        self.unobserve()
        self._subscriptions[self._ystate] = self._ystate.observe(
            partial(callback, "state")
        )
        self._subscriptions[self._ysource] = self._ysource.observe(
            partial(callback, "source")
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
        self._subscriptions[self._ylayersTree] = self._yoptions.observe(
            partial(callback, "layersTree")
        )
