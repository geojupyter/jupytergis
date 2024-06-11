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
    IBox,
    ICone,
    ICut,
    ICylinder,
    IExtrusion,
    IFuse,
    IIntersection,
    ISphere,
    IChamfer,
    IFillet,
    ITorus,
    Parts,
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
            comm_metadata=dict(ymodel_name="@jupytercad:widget", **comm_metadata),
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
            if ext == "fcstd":
                format = "base64"
                contentType = "FCStd"
            elif ext == "jcad":
                format = "text"
                contentType = "jcad"
            else:
                raise ValueError("File extension is not supported!")
        return dict(
            path=path, format=format, contentType=contentType, createydoc=path is None
        )

    def get_object(self, name: str) -> Optional["PythonJcadObject"]:
        if self.check_exist(name):
            data = json.loads(self._get_yobject_by_name(name).to_py())
            return OBJECT_FACTORY.create_object(data, self)

    def remove(self, name: str) -> CadDocument:
        index = self._get_yobject_index_by_name(name)
        if self._objects_array and index != -1:
            self._objects_array.pop(index)
        return self

    def add_object(self, new_object: "PythonJcadObject") -> CadDocument:
        if self._objects_array is not None and not self.check_exist(new_object.name):
            obj_dict = json.loads(new_object.json())
            obj_dict["visible"] = True
            new_map = Map(obj_dict)
            self._objects_array.append(new_map)
        else:
            logger.error(f"Object {new_object.name} already exists")
        return self

    def add_annotation(
        self,
        parent: str,
        message: str,
        *,
        position: Optional[List[float]] = None,
        user: Optional[Dict] = None,
    ) -> Optional[str]:
        """
        Add an annotation to the document.

        :param parent: The object which holds the annotation.
        :param message: The first messages in the annotation.
        :param position: The position of the annotation.
        :param user: The user who create this annotation.
        :return: The id of the annotation if it is created.
        """
        new_id = f"annotation_${uuid4()}"
        parent_obj = self.get_object(parent)
        if parent_obj is None:
            raise ValueError("Parent object not found")

        if position is None:
            position = (
                parent_obj.metadata.centerOfMass
                if parent_obj.metadata is not None
                else [0, 0, 0]
            )
        contents = [{"user": user, "value": message}]
        if self._metadata is not None:
            with self.ydoc.transaction() as t:
                self._metadata.set(
                    t,
                    new_id,
                    json.dumps(
                        {
                            "position": position,
                            "contents": contents,
                            "parent": parent,
                        }
                    ),
                )
            return new_id

    def remove_annotation(self, annotation_id: str) -> None:
        """
        Remove an annotation from the document.

        :param annotation_id: The id of the annotation
        """
        if self._metadata is not None:
            with self.ydoc.transaction() as t:
                self._metadata.pop(t, annotation_id, None)

    def set_color(self, object_name: str, color: Optional[List]) -> None:
        """
        Set object color.

        :param object_name: Object name.
        :param color: Color value, set it to `None` to remove color.
        """
        if self._options and self.check_exist(object_name):
            current_gui = self._options.get("guidata")
            new_gui = None
            if current_gui is not None:
                new_gui = deepcopy(current_gui)
                current_data: Dict = new_gui.get(object_name, {})
                if color is not None:
                    current_data["color"] = color
                else:
                    current_data.pop("color", None)

                new_gui[object_name] = current_data
            else:
                if color is not None:
                    new_gui = {object_name: {"color": color}}
            if new_gui is not None:
                with self.ydoc.transaction() as t:
                    self._options.set(t, "guidata", new_gui)

    def add_step_file(
        self,
        path: str,
        name: str = "",
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        shape_name = name if name else Path(path).stem
        if self.check_exist(shape_name):
            logger.error(f"Object {shape_name} already exists")
            return

        with open(path, "r") as fobj:
            data = fobj.read()

        data = {
            "shape": "Part::Any",
            "name": shape_name,
            "parameters": {
                "Content": data,
                "Type": "STEP",
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
            "visible": True,
        }

        self._objects_array.append(Map(data))

        return self

    def add_occ_shape(
        self,
        shape,
        name: str = "",
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add an OpenCascade TopoDS shape to the document.
        You need `pythonocc-core` installed in order to use this method.

        :param shape: The Open Cascade shape to add.
        :param name: The name that will be used for the object in the document.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """
        try:
            from OCC.Core.BRepTools import breptools_Write
        except ImportError:
            raise RuntimeError("Cannot add an OpenCascade shape if it's not installed.")

        shape_name = name if name else self._new_name("OCCShape")
        if self.check_exist(shape_name):
            logger.error(f"Object {shape_name} already exists")
            return

        with tempfile.NamedTemporaryFile() as tmp:
            breptools_Write(shape, tmp.name, True, False, 1)
            brepdata = tmp.read().decode("ascii")

        data = {
            "shape": "Part::Any",
            "name": shape_name,
            "parameters": {
                "Content": brepdata,
                "Type": "brep",
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
            "visible": True,
        }

        self._objects_array.append(Map(data))

        return self

    def add_box(
        self,
        name: str = "",
        length: float = 1,
        width: float = 1,
        height: float = 1,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add a box to the document.

        :param name: The name that will be used for the object in the document.
        :param length: The length of the box.
        :param width: The width of the box.
        :param height: The height of the box.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """
        data = {
            "shape": Parts.Part__Box.value,
            "name": name if name else self._new_name("Box"),
            "parameters": {
                "Length": length,
                "Width": width,
                "Height": height,
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
        }
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def add_cone(
        self,
        name: str = "",
        radius1: float = 1,
        radius2: float = 0.5,
        height: float = 1,
        angle: float = 360,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add a cone to the document.

        :param name: The name that will be used for the object in the document.
        :param radius1: The bottom radius of the cone.
        :param radius2: The top radius of the cone.
        :param height: The height of the cone.
        :param angle: The revolution angle of the cone (0: no cone, 180: half cone, 360: full cone).
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa 501
        data = {
            "shape": Parts.Part__Cone.value,
            "name": name if name else self._new_name("Cone"),
            "parameters": {
                "Radius1": radius1,
                "Radius2": radius2,
                "Height": height,
                "Angle": angle,
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
        }
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def add_cylinder(
        self,
        name: str = "",
        radius: float = 1,
        height: float = 1,
        angle: float = 360,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add a cylinder to the document.

        :param name: The name that will be used for the object in the document.
        :param radius: The radius of the cylinder.
        :param height: The height of the cylinder.
        :param angle: The revolution angle of the cylinder (0: no cylinder, 180: half cylinder, 360: full cylinder).
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        data = {
            "shape": Parts.Part__Cylinder.value,
            "name": name if name else self._new_name("Cylinder"),
            "parameters": {
                "Radius": radius,
                "Height": height,
                "Angle": angle,
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
        }
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def add_sphere(
        self,
        name: str = "",
        radius: float = 5,
        angle1: float = -90,
        angle2: float = 90,
        angle3: float = 360,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add a sphere to the document.

        :param name: The name that will be used for the object in the document.
        :param radius: The radius of the sphere.
        :param angle1: The revolution angle of the sphere on the X axis (0: no sphere, 180: half sphere, 360: full sphere).
        :param angle2: The revolution angle of the sphere on the Y axis (0: no sphere, 180: half sphere, 360: full sphere).
        :param angle3: The revolution angle of the sphere on the Z axis (0: no sphere, 180: half sphere, 360: full sphere).
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        data = {
            "shape": Parts.Part__Sphere.value,
            "name": name if name else self._new_name("Sphere"),
            "parameters": {
                "Radius": radius,
                "Angle1": angle1,
                "Angle2": angle2,
                "Angle3": angle3,
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
        }
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def add_torus(
        self,
        name: str = "",
        radius1: float = 10,
        radius2: float = 2,
        angle1: float = -180,
        angle2: float = 180,
        angle3: float = 360,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Add a torus to the document.

        :param name: The name that will be used for the object in the document.
        :param radius1: The outer radius of the torus.
        :param radius2: The inner radius of the torus.
        :param angle1: The revolution angle of the torus on the X axis (0: no torus, 180: half torus, 360: full torus).
        :param angle2: The revolution angle of the torus on the Y axis (0: no torus, 180: half torus, 360: full torus).
        :param angle3: The revolution angle of the torus on the Z axis (0: no torus, 180: half torus, 360: full torus).
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        data = {
            "shape": Parts.Part__Torus.value,
            "name": name if name else self._new_name("Torus"),
            "parameters": {
                "Radius1": radius1,
                "Radius2": radius2,
                "Angle1": angle1,
                "Angle2": angle2,
                "Angle3": angle3,
                "Placement": {
                    "Position": position,
                    "Axis": rotation_axis,
                    "Angle": rotation_angle,
                },
            },
        }
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def cut(
        self,
        name: str = "",
        base: str | int = None,
        tool: str | int = None,
        refine: bool = False,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Apply a cut boolean operation between two objects. If no objects are provided as input, the last two created objects will be used as operands.

        :param name: The name that will be used for the object in the document.
        :param base: The base object that will be used for the cut. Can be the name of the object or its index in the objects list.
        :param tool: The tool object that will be used for the cut. Can be the name of the object or its index in the objects list.
        :param refine: Whether or not to refine the mesh during the cut computation.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        base, tool = self._get_boolean_operands(base, tool)

        data = {
            "shape": Parts.Part__Cut.value,
            "name": name if name else self._new_name("Cut"),
            "parameters": {
                "Base": base,
                "Tool": tool,
                "Refine": refine,
                "Placement": {"Position": [0, 0, 0], "Axis": [0, 0, 1], "Angle": 0},
            },
        }
        self.set_visible(base, False)
        self.set_visible(tool, False)
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def fuse(
        self,
        name: str = "",
        shape1: str | int = None,
        shape2: str | int = None,
        refine: bool = False,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Apply a union boolean operation between two objects. If no objects are provided as input, the last two created objects will be used as operands.

        :param name: The name that will be used for the object in the document.
        :param shape1: The first object used for the union. Can be the name of the object or its index in the objects list.
        :param shape2: The first object used for the union. Can be the name of the object or its index in the objects list.
        :param refine: Whether or not to refine the mesh during the union computation.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        shape1, shape2 = self._get_boolean_operands(shape1, shape2)

        data = {
            "shape": Parts.Part__MultiFuse.value,
            "name": name if name else self._new_name("Fuse"),
            "parameters": {
                "Shapes": [shape1, shape2],
                "Refine": refine,
                "Placement": {"Position": [0, 0, 0], "Axis": [0, 0, 1], "Angle": 0},
            },
        }
        self.set_visible(shape1, False)
        self.set_visible(shape2, False)
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def intersect(
        self,
        name: str = "",
        shape1: str | int = None,
        shape2: str | int = None,
        refine: bool = False,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Apply an intersection boolean operation between two objects.
        If no objects are provided as input, the last two created objects will be used as operands.

        :param name: The name that will be used for the object in the document.
        :param shape1: The first object used for the intersection. Can be the name of the object or its index in the objects list.
        :param shape2: The first object used for the intersection. Can be the name of the object or its index in the objects list.
        :param refine: Whether or not to refine the mesh during the intersection computation.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        shape1, shape2 = self._get_boolean_operands(shape1, shape2)

        data = {
            "shape": Parts.Part__MultiCommon.value,
            "name": name if name else self._new_name("Intersection"),
            "parameters": {
                "Shapes": [shape1, shape2],
                "Refine": refine,
                "Placement": {"Position": [0, 0, 0], "Axis": [0, 0, 1], "Angle": 0},
            },
        }
        self.set_visible(shape1, False)
        self.set_visible(shape2, False)
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def chamfer(
        self,
        name: str = "",
        shape: str | int = None,
        edge: int = 0,
        dist: float = 0.1,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Apply a chamfer operation on an object.
        If no objects are provided as input, the last created object will be used as operand.

        :param name: The name that will be used for the object in the document.
        :param shape: The input object used for the chamfer. Can be the name of the object or its index in the objects list.
        :param edge: The edge index where to apply chamfer.
        :param dist: The distance of the chamfer.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        shape = self._get_operand(shape)

        data = {
            "shape": Parts.Part__Chamfer.value,
            "name": name if name else self._new_name("Chamfer"),
            "parameters": {
                "Base": shape,
                "Edge": edge,
                "Dist": dist,
                "Placement": {"Position": [0, 0, 0], "Axis": [0, 0, 1], "Angle": 0},
            },
        }
        self.set_visible(shape, False)
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def fillet(
        self,
        name: str = "",
        shape: str | int = None,
        edge: int = 0,
        radius: float = 0.1,
        position: List[float] = [0, 0, 0],
        rotation_axis: List[float] = [0, 0, 1],
        rotation_angle: float = 0,
    ) -> CadDocument:
        """
        Apply a fillet operation on an object.
        If no objects are provided as input, the last created object will be used as operand.

        :param name: The name that will be used for the object in the document.
        :param shape: The input object used for the fillet. Can be the name of the object or its index in the objects list.
        :param edge: The edge index where to apply fillet.
        :param radius: The radius of the fillet.
        :param position: The shape 3D position.
        :param rotation_axis: The 3D axis used for the rotation.
        :param rotation_angle: The shape rotation angle, in degrees.
        :return: The document itself.
        """  # noqa E501
        shape = self._get_operand(shape)

        data = {
            "shape": Parts.Part__Fillet.value,
            "name": name if name else self._new_name("Fillet"),
            "parameters": {
                "Base": shape,
                "Edge": edge,
                "Radius": radius,
                "Placement": {"Position": [0, 0, 0], "Axis": [0, 0, 1], "Angle": 0},
            },
        }
        self.set_visible(shape, False)
        return self.add_object(OBJECT_FACTORY.create_object(data, self))

    def _get_operand(self, shape: str | int | None, default_idx: int = -1):
        if isinstance(shape, str):
            if shape not in self.objects:
                raise ValueError(f"Unknown object {shape}")
        elif isinstance(shape, int):
            shape = self.objects[shape]
        else:
            shape = self.objects[default_idx]

        return shape

    def _get_boolean_operands(self, shape1: str | int | None, shape2: str | int | None):
        if len(self.objects) < 2:
            raise ValueError(
                "Cannot apply boolean operator if there are less than two objects in the document."  # noqa E501
            )

        shape1 = self._get_operand(shape1, -2)
        shape2 = self._get_operand(shape2, -1)

        return shape1, shape2

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


class PythonJcadObject(BaseModel):
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
    _caddoc = Optional[CadDocument]
    _parent = Optional[CadDocument]

    def __init__(__pydantic_self__, parent, **data: Any) -> None:  # noqa
        super().__init__(**data)
        __pydantic_self__._caddoc = CadDocument()
        __pydantic_self__._caddoc.add_object(__pydantic_self__)
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
    ) -> Optional[PythonJcadObject]:
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
            return PythonJcadObject(
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
