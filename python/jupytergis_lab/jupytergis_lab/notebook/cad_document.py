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

from .objects._schema.any import IAny
from uuid import uuid4

from .objects import (
    ShapeMetadata,
)
from .utils import normalize_path

logger = logging.getLogger(__file__)


class CadDocument(CommWidget):
    """
    Create a new CadDocument object.

    :param path: the path to the file that you would like to open.
    If not provided, a new empty document will be created.
    """

    def __init__(self, path: Optional[str] = None):
        comm_metadata = CadDocument._path_to_comm(path)

        ydoc = Doc()

        super().__init__(
            comm_metadata=dict(ymodel_name="@jupytergis:widget", **comm_metadata),
            ydoc=ydoc,
        )

        self.ydoc["objects"] = self._objects_array = Array()
        self.ydoc["metadata"] = self._metadata = Map()
        self.ydoc["outputs"] = self._outputs = Map()
        self.ydoc["options"] = self._options = Map()

    @property
    def objects(self) -> List[str]:
        """
        Get the list of objects that the document contains as a list of strings.
        """
        if self._objects_array:
            return [x["name"] for x in self._objects_array]
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

    def get_object(self, name: str) -> Optional["PythonJGISObject"]:
        if self.check_exist(name):
            data = json.loads(self._get_yobject_by_name(name).to_py())
            return OBJECT_FACTORY.create_object(data, self)

    def remove(self, name: str) -> CadDocument:
        index = self._get_yobject_index_by_name(name)
        if self._objects_array and index != -1:
            self._objects_array.pop(index)
        return self

    def add_object(self, new_object: "PythonJGISObject") -> CadDocument:
        if self._objects_array is not None and not self.check_exist(new_object.name):
            obj_dict = json.loads(new_object.json())
            obj_dict["visible"] = True
            new_map = Map(obj_dict)
            self._objects_array.append(new_map)
        else:
            logger.error(f"Object {new_object.name} already exists")
        return self

    def set_visible(self, name: str, value):
        obj: Optional[Map] = self._get_yobject_by_name(name)

        if obj is None:
            raise RuntimeError(f"No object named {name}")

        obj["visible"] = False

    def check_exist(self, name: str) -> bool:
        if self.objects:
            return name in self.objects
        return False

    def _get_yobject_by_name(self, name: str) -> Optional[Map]:
        if self._objects_array:
            for index, item in enumerate(self._objects_array):
                if item["name"] == name:
                    return self._objects_array[index]
        return None

    def _get_yobject_index_by_name(self, name: str) -> int:
        if self._objects_array:
            for index, item in enumerate(self._objects_array):
                if item["name"] == name:
                    return index
        return -1

    def _new_name(self, obj_type: str) -> str:
        n = 1
        name = f"{obj_type} 1"
        objects = self.objects

        while name in objects:
            name = f"{obj_type} {n}"
            n += 1

        return name


class PythonJGISObject(BaseModel):
    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    name: str
    shape: Parts
    parameters: Union[
        IAny,
        IBox,
        ICone,
        ICut,
        ICylinder,
        IExtrusion,
        IIntersection,
        IFuse,
        ISphere,
        ITorus,
        IFillet,
        IChamfer,
    ]
    metadata: Optional[ShapeMetadata]
    _gisdoc = Optional[CadDocument]
    _parent = Optional[CadDocument]

    def __init__(__pydantic_self__, parent, **data: Any) -> None:  # noqa
        super().__init__(**data)
        __pydantic_self__._gisdoc = CadDocument()
        __pydantic_self__._gisdoc.add_object(__pydantic_self__)
        __pydantic_self__._parent = parent


class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]


class ObjectFactoryManager(metaclass=SingletonMeta):
    def __init__(self):
        self._factories: Dict[str, type[BaseModel]] = {}

    def register_factory(self, shape_type: str, cls: type[BaseModel]) -> None:
        if shape_type not in self._factories:
            self._factories[shape_type] = cls

    def create_object(
        self, data: Dict, parent: Optional[CadDocument] = None
    ) -> Optional[PythonJGISObject]:
        object_type = data.get("shape", None)
        name: str = data.get("name", None)
        meta = data.get("shapeMetadata", None)
        if object_type and object_type in self._factories:
            Model = self._factories[object_type]
            args = {}
            params = data["parameters"]
            for field in Model.__fields__:
                args[field] = params.get(field, None)
            obj_params = Model(**args)
            return PythonJGISObject(
                parent=parent,
                name=name,
                shape=object_type,
                parameters=obj_params,
                metadata=meta,
            )

        return None


OBJECT_FACTORY = ObjectFactoryManager()

OBJECT_FACTORY.register_factory(Parts.Part__Any.value, IAny)
OBJECT_FACTORY.register_factory(Parts.Part__Box.value, IBox)
OBJECT_FACTORY.register_factory(Parts.Part__Cone.value, ICone)
OBJECT_FACTORY.register_factory(Parts.Part__Cut.value, ICut)
OBJECT_FACTORY.register_factory(Parts.Part__Cylinder.value, ICylinder)
OBJECT_FACTORY.register_factory(Parts.Part__Extrusion.value, IExtrusion)
OBJECT_FACTORY.register_factory(Parts.Part__MultiCommon.value, IIntersection)
OBJECT_FACTORY.register_factory(Parts.Part__MultiFuse.value, IFuse)
OBJECT_FACTORY.register_factory(Parts.Part__Sphere.value, ISphere)
OBJECT_FACTORY.register_factory(Parts.Part__Torus.value, ITorus)
OBJECT_FACTORY.register_factory(Parts.Part__Chamfer.value, IChamfer)
OBJECT_FACTORY.register_factory(Parts.Part__Fillet.value, IFillet)
