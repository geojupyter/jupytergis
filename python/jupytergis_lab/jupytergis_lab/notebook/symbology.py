from collections.abc import Sequence
from enum import Enum
from typing import Any, Literal, Self
from uuid import uuid4

from jupytergis_core.colors import RGBA, coerce_rgba
from jupytergis_core.schema.interfaces.project import symbology as schema_symbology
from jupytergis_core.schema.interfaces.project.symbology import (
    PosFloatChannel,
    RGBAChannel,
    UInt8Channel,
    UNormChannel,
    VirtualChannel,
)
from py2vega import Variable, py2vega
from pydantic import BaseModel, ConfigDict

WhenOpInput = Literal["all", "any"] | None
ScaleKind = Literal["identity", "colormap", "categorical", "scalar"]

# Extract all valid channel names from auto-generated schema enums
_SCHEMA_CHANNEL_VALUES = tuple(
    sorted(
        {
            ch.value
            for enum_class in [
                RGBAChannel,
                UInt8Channel,
                UNormChannel,
                VirtualChannel,
                PosFloatChannel,
            ]
            for ch in enum_class
        },
    ),
)

ENCODING_SHORTCUTS: dict[str, list[schema_symbology.Encoding]] = {
    "fill": ["fill-color", "circle-fill-color"],
    "stroke": ["stroke-color", "circle-stroke-color"],
    "radius": ["circle-radius"],
    "circle-fill": ["circle-fill-color"],
    "circle-stroke": ["circle-stroke-color"],
    "pixel-rgba": ["pixel-color"],
}


def _enum_member_name(value: str) -> str:
    name = value.replace("-", "_").replace(" ", "_").replace("/", "_")
    if not name:
        name = "value"
    if name[0].isdigit():
        name = f"n_{name}"
    return name.lower()


_ENCODING_VALUES = [*ENCODING_SHORTCUTS.keys(), *_SCHEMA_CHANNEL_VALUES]
_ENCODING_MEMBERS: dict[str, str] = {}
for channel_value in _ENCODING_VALUES:
    member_name = _enum_member_name(channel_value)
    base_name = member_name
    suffix = 1
    while member_name in _ENCODING_MEMBERS:
        suffix += 1
        member_name = f"{base_name}_{suffix}"
    _ENCODING_MEMBERS[member_name] = channel_value

VisualEncoding = Enum("VisualEncoding", _ENCODING_MEMBERS, type=str)
VisualEncodings = VisualEncoding | str | Sequence[VisualEncoding | str]


class ClassificationMode(Enum):
    EQUAL_INTERVAL = "equal interval"
    QUANTILE = "quantile"
    JENKS = "jenks"
    PRETTY = "pretty"
    LOGARITHMIC = "logarithmic"


class Predicate:
    """User-facing predicate value for ``when=`` guards.

    Build these via helpers such as ``field(...)`` comparisons,
    ``geometry_type(...)``, ``has_field(...)``, and ``between(...)``, then pass
    them to the ``when=`` argument of symbology functions.
    """

    __slots__ = ("_internal",)

    def __init__(self):
        """Create an empty predicate token.

        End users typically do not instantiate this directly.
        Prefer the predicate helper functions and ``field(...)`` comparisons.
        """
        self._internal: schema_symbology.IPredicate | None = None

    @classmethod
    def _from_internal(cls, predicate: schema_symbology.IPredicate) -> "Predicate":
        token = cls()
        token._internal = predicate
        return token


WhenInput = Predicate | Sequence[Predicate] | None


def _as_predicate(predicate: schema_symbology.IPredicate) -> Predicate:
    return Predicate._from_internal(predicate)


class ScalarStop:
    """User-facing scalar interpolation stop.

    Use this with ``scalar(..., scalar_stops=[...])`` to define explicit
    stop-to-output mappings.
    """

    __slots__ = ("output", "stop")

    def __init__(self, stop: float, output: float):
        self.stop = float(stop)
        self.output = float(output)


def _normalize_scalar_stops(
    scalar_stops: Sequence[ScalarStop] | Sequence[Any] | None,
) -> list[schema_symbology.ScalarStop] | None:
    if scalar_stops is None:
        return None

    normalized: list[schema_symbology.ScalarStop] = []
    for stop in scalar_stops:
        if isinstance(stop, ScalarStop):
            normalized.append(
                schema_symbology.ScalarStop(stop=stop.stop, output=stop.output),
            )
        elif isinstance(stop, schema_symbology.ScalarStop):
            # Backward compatibility for callers already using schema objects.
            normalized.append(stop)
        else:
            raise TypeError(f"Unsupported scalar stop type: {type(stop)!r}")
    return normalized


class FieldPredicate:
    """Fluent predicate builder for `when=` guards.

    Use ``field`` to construct instances. Rich comparisons return schema
    predicate objects, for example ``field("magnitude") > 3``.
    """

    def __init__(self, name: str):
        """Create a field predicate wrapper.

        :param name: Feature field name used to build predicates.
        """
        self.name = name

    def __hash__(self) -> int:
        """Return a stable hash aligned with equality semantics.

        :returns: Hash derived from the field name.
        """
        return hash(self.name)

    def __eq__(self, other: object) -> Predicate:
        """Build a field-equality predicate.

        :param other: Expected value (string or number).
        :returns: A ``fieldEquals`` predicate.
        """
        if not isinstance(other, str | int | float):
            raise TypeError(
                "field equality predicates only support strings and numbers",
            )
        return field_equals(self.name, other)

    def __ne__(self, other: object) -> Predicate:
        """Build a numeric not-equal predicate.

        :param other: Numeric threshold.
        :returns: A ``fieldCompare`` predicate with ``op='!='``.
        """
        return field_compare(self.name, "!=", _coerce_condition_number(other))

    def __gt__(self, other: object) -> Predicate:
        """Build a numeric greater-than predicate.

        :param other: Numeric threshold.
        :returns: A ``fieldCompare`` predicate with ``op='>'``.
        """
        return field_compare(self.name, ">", _coerce_condition_number(other))

    def __ge__(self, other: object) -> Predicate:
        """Build a numeric greater-than-or-equal predicate.

        :param other: Numeric threshold.
        :returns: A ``fieldCompare`` predicate with ``op='>='``.
        """
        return field_compare(self.name, ">=", _coerce_condition_number(other))

    def __lt__(self, other: object) -> Predicate:
        """Build a numeric less-than predicate.

        :param other: Numeric threshold.
        :returns: A ``fieldCompare`` predicate with ``op='<'``.
        """
        return field_compare(self.name, "<", _coerce_condition_number(other))

    def __le__(self, other: object) -> Predicate:
        """Build a numeric less-than-or-equal predicate.

        :param other: Numeric threshold.
        :returns: A ``fieldCompare`` predicate with ``op='<='``.
        """
        return field_compare(self.name, "<=", _coerce_condition_number(other))

    def exists(self) -> Predicate:
        """Build a predicate that checks field existence.

        :returns: A ``hasField`` predicate.
        """
        return has_field(self.name)

    def between(self, minimum: float, maximum: float) -> Predicate:
        """Build an inclusive numeric range predicate.

        :param minimum: Lower inclusive bound.
        :param maximum: Upper inclusive bound.
        :returns: A ``between`` predicate.
        """
        return between(self.name, minimum, maximum)

    def _as_source(self) -> "MappingChain":
        return MappingChain(kind="field", value=self.name)

    def encoding(
        self,
        *targets: VisualEncodings,
    ) -> "Mapping":
        """Map this symbolizer to visual encoding."""
        return self._as_source().encoding(*targets)

    def identity(
        self,
    ) -> "MappingChain":
        """Apply an identity scale to this field before ``encoding(...)``."""
        return self._as_source().identity()

    def colormap(
        self,
        colormap: str = "viridis",
        *,
        domain: Sequence[float] | None = None,
        n_shades: int = 9,
        mode: ClassificationMode = ClassificationMode.EQUAL_INTERVAL,
        reverse: bool = False,
        fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
    ) -> "MappingChain":
        """Apply a color-ramp scale to this field before ``encoding(...)``."""
        return self._as_source().colormap(
            colormap=colormap,
            domain=domain,
            n_shades=n_shades,
            mode=mode,
            reverse=reverse,
            fallback=fallback,
        )

    def categorical(
        self,
        colormap: str = "viridis",
        *,
        n_shades: int | None = None,
        reverse: bool | None = None,
        fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
    ) -> "MappingChain":
        """Apply a categorical scale to this field before ``encoding(...)``."""
        return self._as_source().categorical(
            colormap=colormap,
            n_shades=n_shades,
            reverse=reverse,
            fallback=fallback,
        )

    def scalar(
        self,
        *,
        domain: Sequence[float],
        output_range: Sequence[float],
        fallback: float | None = None,
        scalar_stops: Sequence[ScalarStop] | None = None,
    ) -> "MappingChain":
        """Apply a scalar interpolation scale to this field before ``encoding(...)``."""
        return self._as_source().scalar(
            domain=domain,
            output_range=output_range,
            fallback=fallback,
            scalar_stops=scalar_stops,
        )


def field(name: str) -> FieldPredicate:
    """Create a field reference used by predicates and mapping chains.

    Examples::

        field("temperature").colormap("viridis").encoding("fill")
        when(field("magnitude") > 3).constant("red").encoding("fill")
    """
    return FieldPredicate(name)


class ExpressionPredicate:
    """Create an expression-based mapping source."""

    def __init__(self, code: str, expr_type: Literal["vega", "py"]):
        self.code = code
        self.expr_type = expr_type

    def _as_source(self) -> "MappingChain":
        vega_code = (
            self.code
            if self.expr_type == "vega"
            else _python_expr_to_vega_expr(self.code)
        )
        expr_scale = expression(vega_code, fallback=(0, 0, 0, 1))
        return MappingChain(kind="expr", value=0, scale=expr_scale)

    def encoding(self, *targets):
        return self._as_source().encoding(*targets)


class Mapping:
    """Final mapping produced by ``...encoding(...)`` chains."""

    __slots__ = ("_rule",)

    def __init__(self, rule: schema_symbology.IEncodingRule):
        self._rule = rule


class MappingChain:
    """Fluent chain for building a single mapping.

    A mapping chain starts from ``field(...)`` or ``constant(...)`` or ``expr(...)``, optionally
    applies a scale (``identity``, ``colormap``, ``categorical``, ``scalar``),
    and is finalized with ``encoding(...)``.
    """

    __slots__ = (
        "_kind",
        "_scale",
        "_scale_kind",
        "_value",
        "_when",
        "_when_op",
    )

    def __init__(
        self,
        *,
        kind: Literal["field", "constant", "expr"],
        value: str | float | RGBA | Sequence[float],
        scale: Any | None = None,
        scale_kind: ScaleKind | None = None,
        when: list[schema_symbology.IPredicate] | None = None,
        when_op: WhenOpInput = None,
    ):
        self._kind = kind
        self._value = value
        self._scale = scale
        self._scale_kind = scale_kind
        self._when = when
        self._when_op = when_op

    def _copy(
        self,
        *,
        scale: Any | None = None,
        scale_kind: ScaleKind | None = None,
        when: list[schema_symbology.IPredicate] | None = None,
        when_op: WhenOpInput = None,
    ) -> "MappingChain":
        return MappingChain(
            kind=self._kind,
            value=self._value,
            scale=self._scale if scale is None else scale,
            scale_kind=self._scale_kind if scale_kind is None else scale_kind,
            when=self._when if when is None else when,
            when_op=self._when_op if when_op is None else when_op,
        )

    def _assert_scale_not_mixed(self, next_scale: ScaleKind) -> None:
        if self._scale_kind is None:
            return
        if self._scale_kind == next_scale:
            raise TypeError(f"{next_scale} is already set for this mapping chain")
        raise TypeError("Scales cannot be mixed in a single field(...) chain")

    def when(self, *when: WhenInput) -> "MappingChain":
        """Attach guard predicate(s) to this mapping chain."""
        return self._copy(when=_normalize_when(when))

    def when_op(self, when_op: WhenOpInput) -> "MappingChain":
        """Set the logical combinator used for mapping ``when`` predicates."""
        return self._copy(when_op=when_op)

    def identity(
        self,
    ) -> "MappingChain":
        """Apply an identity scale to a ``field(...)`` source.

        :returns: The updated :class:`MappingChain`.
        :raises TypeError: If the source was created with :func:`constant`.
        """
        if self._kind != "field":
            raise TypeError("identity scale requires a field(...) source")
        self._assert_scale_not_mixed("identity")
        return self._copy(scale=_identity_scale(), scale_kind="identity")

    def colormap(
        self,
        colormap: str = "viridis",
        *,
        domain: Sequence[float] | None = None,
        n_shades: int = 9,
        mode: ClassificationMode = ClassificationMode.EQUAL_INTERVAL,
        reverse: bool = False,
        fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
    ) -> "MappingChain":
        """Apply a color-ramp scale to a ``field(...)`` source.

        :param colormap: Ramp name (for example ``"viridis"``).
        :param domain: The input range.
        :param n_shades: Number of discrete shades to produce.
        :param mode: The interpolation mode.
        :param reverse: Whether to reverse the ramp order.
        :param fallback: Fallback RGBA/color value.
        :returns: The updated :class:`MappingChain`.
        :raises TypeError: If the source was created with :func:`constant`.
        """
        if self._kind != "field":
            raise TypeError("colormap scale requires a field(...) source")
        self._assert_scale_not_mixed("colormap")

        return self._copy(
            scale=_colormap_scale(
                name=colormap,
                domain=domain,
                n_shades=n_shades,
                mode=mode,
                reverse=reverse,
                fallback=fallback,
            ),
            scale_kind="colormap",
        )

    def categorical(
        self,
        colormap: str = "viridis",
        *,
        n_shades: int | None = None,
        reverse: bool | None = None,
        fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
    ) -> "MappingChain":
        """Apply a categorical scale to a ``field(...)`` source.

        :param colormap: Name of the categorical color ramp.
        :returns: The updated :class:`MappingChain`.
        :raises TypeError: If the source was created with :func:`constant`.
        """
        if self._kind != "field":
            raise TypeError("categorical scale requires a field(...) source")
        self._assert_scale_not_mixed("categorical")
        return self._copy(
            scale=_categorical_scale(
                name=colormap,
                n_shades=n_shades,
                reverse=reverse,
                fallback=fallback,
            ),
            scale_kind="categorical",
        )

    def scalar(
        self,
        *,
        domain: Sequence[float],
        output_range: Sequence[float],
        fallback: float | None = None,
        scalar_stops: Sequence[ScalarStop] | None = None,
    ) -> "MappingChain":
        """Apply a scalar interpolation scale to a ``field(...)`` source.

        :returns: The updated :class:`MappingChain`.
        :raises TypeError: If the source was created with :func:`constant`.
        """
        if self._kind != "field":
            raise TypeError("scalar scale requires a field(...) source")
        self._assert_scale_not_mixed("scalar")
        return self._copy(
            scale=_scalar_scale(
                domain=domain,
                output_range=output_range,
                fallback=fallback if fallback is not None else output_range[0],
                scalar_stops=scalar_stops,
            ),
            scale_kind="scalar",
        )

    def encoding(
        self,
        *targets: VisualEncodings,
    ) -> Mapping:
        """Finalize the chain and encode to output channel(s)."""
        if self._kind == "field":
            assert isinstance(self._value, str)
            fields = [self._value]
            scale = self._scale if self._scale is not None else _identity_scale()
        elif self._kind == "expr":
            assert self._scale is not None, "expression kind requires a scale"
            fields = None
            scale = self._scale
        else:
            fields = None
            if self._scale is not None:
                scale = self._scale
            elif isinstance(self._value, (int, float)):
                scale = _constant_num_scale(float(self._value))
            else:
                scale = _constant_color_scale(self._value)

        selected_when = self._when
        selected_when_op = self._when_op
        if selected_when is not None and selected_when_op is None:
            selected_when_op = "all"

        rule = encoding_rule(
            mapping(scale=scale, channels=_resolve_ENCODINGs(targets)),
            fields=fields,
            when=selected_when,
            when_op=selected_when_op,
        )
        return Mapping(rule)


class Layer:
    """A single symbology layer made of mapping chains."""

    __slots__ = ("_when", "_when_op", "mappings", "preprocess")

    def __init__(
        self,
        mappings: Sequence[Mapping] | None = None,
        *,
        preprocess: Sequence[schema_symbology.ITransform] | None = None,
    ):
        self.mappings = [_coerce_mapping(mapping) for mapping in (mappings or [])]
        self.preprocess = list(preprocess) if preprocess is not None else None
        self._when = None
        self._when_op = None

    def when(self, *when: WhenInput) -> "Layer":
        """Attach layer-level predicates.

        :param when: Predicate or predicates created with helpers such as
            :func:`field`, :func:`has_field`, or :func:`between`.
        :returns: A new :class:`Layer` with the predicates applied.
        """
        updated = Layer(mappings=self.mappings, preprocess=self.preprocess)
        updated._when = _normalize_when(when)
        updated._when_op = self._when_op
        return updated

    def when_op(self, when_op: WhenOpInput) -> "Layer":
        """Set the logical combinator for layer-level predicates.

        :param when_op: ``"all"`` or ``"any"``.
        :returns: A new :class:`Layer` with the combinator applied.
        """
        updated = Layer(mappings=self.mappings, preprocess=self.preprocess)
        updated._when = self._when
        updated._when_op = when_op
        return updated

    def _to_grammar_layer(self) -> schema_symbology.IGrammarLayer:
        """Convert this value to a schema :class:`IGrammarLayer`.

        :returns: The serialized grammar-layer payload.
        """
        return grammar_layer(
            *[mapping._rule for mapping in self.mappings],
            preprocess=self.preprocess,
            when=self._when,
            when_op=self._when_op,
        )


class WhenBuilder:
    """Start a mapping chain by declaring guard predicates first.

    Use :func:`when` to create instances, then choose a source with
    :meth:`constant` or :meth:`field`.
    """

    __slots__ = ("_when", "_when_op")

    def __init__(
        self,
        *,
        when: WhenInput,
        when_op: WhenOpInput = None,
    ):
        self._when = _normalize_when(when)
        self._when_op = when_op

    def when_op(self, when_op: WhenOpInput) -> "WhenBuilder":
        """Set the logical combinator for this builder's predicates."""
        return WhenBuilder(
            when=(
                [_as_predicate(predicate) for predicate in self._when]
                if self._when is not None
                else None
            ),
            when_op=when_op,
        )

    def constant(self, value: float | RGBA | Sequence[float] | str) -> MappingChain:
        """Start a constant mapping chain with the builder predicates attached."""
        return MappingChain(
            kind="constant",
            value=value,
            when=self._when,
            when_op=self._when_op,
        )

    def field(self, name: str) -> MappingChain:
        """Start a field mapping chain with the builder predicates attached."""
        return MappingChain(
            kind="field",
            value=name,
            when=self._when,
            when_op=self._when_op,
        )


def constant(value: float | RGBA | Sequence[float] | str) -> MappingChain:
    """Create a constant mapping source for chain-style symbology.

    Finalize with ``encoding(...)`` to create a mapping.
    """
    return MappingChain(kind="constant", value=value)


def vega_expr(code: str) -> ExpressionPredicate:
    """Create an expression-based mapping source using Vega syntax.

    The expression is evaluated at render time for each feature. Use the
    ``datum`` variable to reference feature properties.

    Example::

        vega_expr("datum.population > 1000000 ? 'cyan' : 'pink'").encoding("fill")
    """
    if not isinstance(code, str) or not code.strip():
        raise ValueError("vega_expr must be a non-empty string")
    return ExpressionPredicate(code, "vega")


def python_expr(code: str) -> ExpressionPredicate:
    """Create an expression-based mapping source using Python syntax.

    The Python expression is converted to Vega and evaluated at render time.
    Use the ``datum`` variable to reference feature properties.

    Example::

        python_expr("'red' if datum.population > 1000000 else 'orange'").encoding("fill")
    """
    _python_expr_to_vega_expr(code)
    return ExpressionPredicate(code, "py")


def when(*when: WhenInput) -> WhenBuilder:
    """Create a when-first builder for readable guarded mapping chains.

    Examples::

        when(field("mag") >= 5).constant("red").encoding("fill")
        when(field("mag") > 3, field("mag") < 8).when_op("all").field("mag").identity().encoding("radius")
    """
    return WhenBuilder(when=when)


def layer(
    *mappings: Mapping,
    preprocess: Sequence[schema_symbology.ITransform] | None = None,
) -> Layer:
    """Build a layer from one or more finalized mappings."""
    return Layer(
        mappings=list(mappings),
        preprocess=preprocess,
    )


class GrammarSymbology(BaseModel):
    """Container for the normalized grammar symbology state.

    Prefer constructing symbology via mapping chains and layer lists, then
    serializing with ``to_symbology_state(...)``.
    """

    model_config = ConfigDict(extra="forbid")

    layers: list[schema_symbology.IGrammarLayer]

    def _with_layers(self, *layers: schema_symbology.IGrammarLayer) -> Self:
        return GrammarSymbology(layers=[*self.layers, *layers])

    def with_layer(
        self,
        item: Layer | schema_symbology.IGrammarLayer | Sequence[Mapping],
    ) -> Self:
        """Return a copy with one additional layer appended."""
        if isinstance(item, Layer):
            return self._with_layers(item._to_grammar_layer())
        if isinstance(item, schema_symbology.IGrammarLayer):
            return self._with_layers(item)
        return self._with_layers(grammar_layer(*[mapping._rule for mapping in item]))


Symbology = GrammarSymbology


def _coerce_condition_number(value: object) -> float:
    if not isinstance(value, int | float):
        raise TypeError("field comparison predicates only support numeric values")
    return float(value)


def _normalize_when(
    when: WhenInput | schema_symbology.IPredicate | Sequence[Any],
) -> list[schema_symbology.IPredicate] | None:
    if when is None:
        return None
    if isinstance(when, Predicate):
        if when._internal is None:
            raise TypeError(
                "Predicate must be created via field(...) or predicate helpers",
            )
        return [when._internal]
    if isinstance(when, schema_symbology.IPredicate):
        return [when]

    normalized: list[schema_symbology.IPredicate] = []
    for item in when:
        if isinstance(item, Predicate):
            if item._internal is None:
                raise TypeError(
                    "Predicate must be created via field(...) or predicate helpers",
                )
            normalized.append(item._internal)
        elif isinstance(item, schema_symbology.IPredicate):
            normalized.append(item)
        else:
            raise TypeError(f"Unsupported predicate type: {type(item)!r}")
    return normalized


def _coerce_style_channel(channel: Any) -> schema_symbology.Encoding:
    if isinstance(channel, schema_symbology.Encoding):
        return channel
    return schema_symbology.Encoding(root=channel)


def _normalize_channels(channels: Sequence[Any]) -> list[schema_symbology.Encoding]:
    return [_coerce_style_channel(channel) for channel in channels]


def _constant_color_scale(
    value: RGBA | Sequence[float] | str,
) -> schema_symbology.IConstantRGBAScale:
    return schema_symbology.IConstantRGBAScale(
        params=schema_symbology.Params3(
            value=schema_symbology.RGBA(root=coerce_rgba(value)),
        ),
    )


def _constant_num_scale(value: float) -> schema_symbology.IConstantNumScale:
    return schema_symbology.IConstantNumScale(
        params=schema_symbology.Params4(value=value),
    )


def _identity_scale() -> schema_symbology.IIdentityScale:
    return schema_symbology.IIdentityScale()


def _python_expr_to_vega_expr(python_expr: str) -> str:
    """Convert Python expression to Vega expression."""
    if not isinstance(python_expr, str) or not python_expr.strip():
        raise ValueError("python_expr must be a non-empty string")
    try:
        return py2vega(
            python_expr,
            whitelist=[Variable("datum")],
        )
    except Exception as e:
        raise ValueError(f"Invalid Python expression: {e}") from e


def expression(
    expr: str,
    fallback: float | RGBA | Sequence[float] | str,
) -> schema_symbology.IExpressionScale:
    """Create an expression-based scale that evaluates a formula at render time.

    :param expr: Expression string in the layer expression language.
    :param fallback: Value used when the expression cannot be evaluated. Pass a
        ``float`` for numeric channels or an RGBA/color value for color channels.
    :returns: An expression scale object that can be passed to :func:`mapping`.
    """
    fallback_value: float | list[float]
    if isinstance(fallback, (int, float)):
        fallback_value = float(fallback)
    else:
        fallback_value = coerce_rgba(fallback)

    return schema_symbology.IExpressionScale(
        params=schema_symbology.Params5(expr=expr, fallback=fallback_value),
    )


def _colormap_scale(
    name: str,
    *,
    domain: Sequence[float] | None = None,
    n_shades: int = 9,
    mode="equal interval",
    reverse: bool = False,
    fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
    color_stops: Sequence[schema_symbology.ColorStop] | None = None,
) -> schema_symbology.IColorRampScale:
    params = schema_symbology.Params(
        name=name,
        domain=list(domain) if domain is not None else None,
        nShades=n_shades,
        mode=mode.value,
        reverse=reverse,
        fallback=schema_symbology.RGBA(root=coerce_rgba(fallback)),
        colorStops=list(color_stops) if color_stops is not None else None,
    )
    return schema_symbology.IColorRampScale(
        params=params,
    )


def _categorical_scale(
    name: str,
    *,
    n_shades: int | None = None,
    reverse: bool | None = None,
    fallback: RGBA | Sequence[float] | str = (0.0, 0.0, 0.0, 1.0),
) -> schema_symbology.ICategoricalScale:
    return schema_symbology.ICategoricalScale(
        params=schema_symbology.Params1(
            colorRamp=name,
            nShades=n_shades,
            reverse=reverse,
            fallback=schema_symbology.RGBA(root=coerce_rgba(fallback)),
        ),
    )


def _scalar_scale(
    *,
    domain: Sequence[float],
    output_range: Sequence[float],
    fallback: float,
    scalar_stops: Sequence[ScalarStop] | None = None,
) -> schema_symbology.IScalarScale:
    params = schema_symbology.Params2(
        domain=list(domain),
        range=list(output_range),
        fallback=fallback,
        scalarStops=_normalize_scalar_stops(scalar_stops),
    )
    return schema_symbology.IScalarScale(
        params=params,
    )


def mapping(
    scale: Any,
    channels: Sequence[Any],
) -> schema_symbology.IMapping:
    """Bind a scale to one or more style channels.

    :param scale: A scale object (e.g. from ``expression``, ``colormap``,
        or the private ``_*_scale`` helpers).
    :param channels: Style channel names to drive with the scale.
    :returns: A mapping object that can be passed to ``encoding_rule``.
    """
    return schema_symbology.IMapping(
        scale=scale,
        channels=_normalize_channels(channels),
    )


def encoding_rule(
    *mappings: schema_symbology.IMapping,
    fields: Sequence[str] | None = None,
    when: Sequence[schema_symbology.IPredicate] | None = None,
    when_op: Literal["all", "any"] | None = None,
    id: str | None = None,
) -> schema_symbology.IEncodingRule:
    """Create an encoding rule that groups one or more channel mappings.

    :param mappings: One or more ``mapping`` objects to include in this rule.
    :param fields: Feature field names that the rule depends on. Used for
        data-driven scales that need to know which fields to load.
    :param when: Optional list of predicates. The rule is applied only when the
        predicates evaluate to ``True``.
    :param when_op: How to combine multiple predicates: ``"all"`` (AND) or
        ``"any"`` (OR). Defaults to ``"all"`` when omitted.
    :param id: Explicit rule identifier. A UUID is generated when ``None``.
    :returns: An encoding rule that can be passed to ``grammar_layer``.
    """
    return schema_symbology.IEncodingRule(
        id=id or str(uuid4()),
        fields=list(fields) if fields is not None else None,
        mappings=list(mappings),
        when=list(when) if when is not None else None,
        whenOp=schema_symbology.WhenOp(when_op) if when_op is not None else None,
    )


def grammar_layer(
    *rules: schema_symbology.IEncodingRule,
    preprocess: Sequence[schema_symbology.ITransform] | None = None,
    when: Sequence[schema_symbology.IPredicate] | None = None,
    when_op: Literal["all", "any"] | None = None,
    id: str | None = None,
) -> schema_symbology.IGrammarLayer:
    """Create a grammar layer containing encoding rules and optional transforms.

    :param rules: One or more ``encoding_rule`` objects that define the
        visual mapping for this layer.
    :param preprocess: Optional sequence of ``kde_transform`` or
        ``cluster_transform`` steps applied before rendering.
    :param when: Optional predicates that gate whether the layer is rendered.
    :param when_op: How to combine multiple predicates: ``"all"`` (AND) or
        ``"any"`` (OR). Defaults to ``"all"`` when omitted.
    :param id: Explicit layer identifier. A UUID is generated when ``None``.
    :returns: A grammar layer that can be passed to ``symbology_state``.
    """
    return schema_symbology.IGrammarLayer(
        id=id or str(uuid4()),
        preprocess=list(preprocess) if preprocess is not None else None,
        rules=list(rules),
        when=list(when) if when is not None else None,
        whenOp=schema_symbology.WhenOp(when_op) if when_op is not None else None,
    )


def geometry_type(
    value: Literal["Point", "LineString", "Polygon"],
) -> Predicate:
    """Create a predicate that matches features by their geometry type.

    :param value: The geometry type to match: ``"Point"``, ``"LineString"``,
        or ``"Polygon"``.
    :returns: A predicate that can be passed to ``encoding_rule`` or
        ``grammar_layer``.
    """
    return _as_predicate(
        schema_symbology.IPredicate(
            root=schema_symbology.IGeometryTypePredicate(
                value=schema_symbology.Value(value),
            ),
        ),
    )


def has_field(field: str) -> Predicate:
    """Create a predicate that matches features which have a given field.

    :param field: Name of the feature field to test for existence.
    :returns: A predicate that evaluates to ``True`` when the field is present.
    """
    return _as_predicate(
        schema_symbology.IPredicate(
            root=schema_symbology.IHasFieldPredicate(
                field=field,
            ),
        ),
    )


def field_equals(field: str, value: str | float) -> Predicate:
    """Create a predicate that matches features where a field equals a given value.

    :param field: Name of the feature field to test.
    :param value: Expected field value (string or number).
    :returns: A predicate that evaluates to ``True`` when the field equals ``value``.
    """
    return _as_predicate(
        schema_symbology.IPredicate(
            root=schema_symbology.IFieldEqualsPredicate(
                field=field,
                value=value,
            ),
        ),
    )


def field_compare(field: str, op: str, value: float) -> Predicate:
    """Create a predicate that compares a numeric field against a threshold.

    :param field: Name of the numeric feature field to test.
    :param op: Comparison operator string, e.g. ``"<"``, ``"<="``, ``">"``,
        ``">="``, ``"!="``.
    :param value: Threshold value to compare against.
    :returns: A predicate that evaluates to ``True`` when the comparison holds.
    """
    return _as_predicate(
        schema_symbology.IPredicate(
            root=schema_symbology.IFieldComparePredicate(
                field=field,
                op=schema_symbology.ICompareOp(op),
                value=value,
            ),
        ),
    )


def between(field: str, minimum: float, maximum: float) -> Predicate:
    """Create a predicate that matches features where a field value falls in a range.

    The range is inclusive: ``minimum <= field_value <= maximum``.

    :param field: Name of the numeric feature field to test.
    :param minimum: Lower bound of the range (inclusive).
    :param maximum: Upper bound of the range (inclusive).
    :returns: A predicate that evaluates to ``True`` when the field is in range.
    """
    return _as_predicate(
        schema_symbology.IPredicate(
            root=schema_symbology.IBetweenPredicate(
                field=field,
                min=minimum,
                max=maximum,
            ),
        ),
    )


def kde_transform(
    radius: float,
    blur: float,
    weight_field: str | None = None,
) -> schema_symbology.ITransform:
    """Create a KDE (kernel density estimation) preprocessing transform.

    Used to build heatmap layers. Pass the result as the ``preprocess`` argument
    of ``grammar_layer``.

    :param radius: KDE kernel radius in pixels.
    :param blur: Amount of Gaussian blur applied to the density surface.
    :param weight_field: Optional feature field to use as per-point weights.
    :returns: A transform object suitable for ``grammar_layer``.
    """
    return schema_symbology.ITransform(
        root=schema_symbology.IKDETransform(
            radius=radius,
            blur=blur,
            weightField=weight_field,
        ),
    )


def cluster_transform(radius: float) -> schema_symbology.ITransform:
    """Create a cluster preprocessing transform that aggregates nearby points.

    Pass the result as the ``preprocess`` argument of ``grammar_layer``.

    :param radius: Clustering radius in pixels.
    :returns: A transform object suitable for ``grammar_layer``.
    """
    return schema_symbology.ITransform(
        root=schema_symbology.IClusterTransform(
            radius=radius,
        ),
    )


def heatmap(
    *,
    radius: float = 2.0,
    blur: float = 5.0,
    weight_field: str | None = None,
    weight: str | None = None,
    mappings: Sequence[Mapping] | None = None,
) -> Layer:
    """Create a heatmap layer with KDE (kernel density estimation) transform.

    :param radius: The radius of the KDE transform in pixels.
    :param blur: The blur of the KDE transform.
    :param weight_field: Optional field to use for weighting the KDE.
    :param weight: Alias for ``weight_field``.
    :param mappings: Optional mapping chains for this layer.
    """
    transform = kde_transform(
        radius=radius,
        blur=blur,
        weight_field=weight_field or weight,
    )
    return Layer(mappings=list(mappings or []), preprocess=[transform])


def cluster(
    *,
    radius: float,
    mappings: Sequence[Mapping] | None = None,
) -> Layer:
    """Create a symbology that aggregates nearby points into clusters.

    :param radius: Clustering radius in pixels.
    :param mappings: Optional mapping chains for this layer.
    :returns: A ``Layer`` with a cluster preprocessing transform.
    """
    transform = cluster_transform(radius=radius)
    return Layer(mappings=list(mappings or []), preprocess=[transform])


def symbology_state(
    *,
    layers: Sequence[schema_symbology.IGrammarLayer] | None = None,
) -> GrammarSymbology:
    """Create a ``GrammarSymbology`` from an explicit list of grammar layers.

    :param layers: Grammar layers to include. Defaults to an empty list.
    :returns: A new ``GrammarSymbology`` instance.
    """
    return GrammarSymbology(layers=list(layers or []))


def _constant_rule(
    *,
    target: VisualEncodings,
    value: RGBA | Sequence[float] | str | float,
    when: WhenInput = None,
    when_op: WhenOpInput = "all",
) -> schema_symbology.IEncodingRule:
    if isinstance(value, (int, float)):
        scale = _constant_num_scale(float(value))
    else:
        scale = _constant_color_scale(value)
    return encoding_rule(
        mapping(scale=scale, channels=_resolve_ENCODINGs(target)),
        when=_normalize_when(when),
        when_op=when_op,
    )


def _mapped_rule(
    *,
    scale: Any,
    value: str,
    target: VisualEncodings,
    when: WhenInput = None,
    when_op: WhenOpInput = "all",
) -> schema_symbology.IEncodingRule:
    return encoding_rule(
        mapping(scale=scale, channels=_resolve_ENCODINGs(target)),
        fields=[value],
        when=_normalize_when(when),
        when_op=when_op,
    )


def _single_layer(*rules: schema_symbology.IEncodingRule) -> GrammarSymbology:
    return symbology_state(layers=[grammar_layer(*rules)])


def _resolve_ENCODINGs(
    target: VisualEncodings,
) -> list[schema_symbology.Encoding]:
    requested = [target] if isinstance(target, str) else list(target)
    channels: list[schema_symbology.Encoding] = []
    for item in requested:
        # Check if it's a shorthand
        if item in ENCODING_SHORTCUTS:
            channels.extend(ENCODING_SHORTCUTS[item])
        # Otherwise check if it's a valid schema channel
        elif item in _SCHEMA_CHANNEL_VALUES:
            channels.append(item)
        else:
            raise ValueError(
                f"Unsupported target: {item!r}.\nSupported targets are: {[*ENCODING_SHORTCUTS.keys(), *_SCHEMA_CHANNEL_VALUES]}",
            )

    deduped: list[schema_symbology.Encoding] = []
    for channel in channels:
        if channel not in deduped:
            deduped.append(channel)
    return deduped


def _coerce_mapping(item: Any) -> Mapping:
    if isinstance(item, Mapping):
        return item
    if isinstance(item, MappingChain):
        raise TypeError(
            "Unfinished mapping chain. Finish chains with .encoding(...).",
        )
    raise TypeError(
        "Layer mappings must be Mapping values. Finish chains with .encoding(...).",
    )


def _coerce_layer(item: Any) -> schema_symbology.IGrammarLayer:
    if isinstance(item, MappingChain):
        raise TypeError(
            "Unfinished mapping chain. Finish chains with .encoding(...).",
        )
    if isinstance(item, Layer):
        return item._to_grammar_layer()
    if isinstance(item, GrammarSymbology):
        if len(item.layers) != 1:
            raise TypeError(
                "A layer entry cannot contain multiple layers. Pass each layer separately.",
            )
        return item.layers[0]
    if isinstance(item, (list, tuple)):
        mappings = [_coerce_mapping(mapping) for mapping in item]
        return grammar_layer(*[mapping._rule for mapping in mappings])
    raise TypeError(f"Unsupported layer item: {type(item)!r}")


SymbologyInput = (
    Symbology
    | Layer
    | list[Mapping]
    | list[Symbology | Layer | list[Mapping] | tuple[Mapping, ...]]
    | BaseModel
    | dict[str, Any]
    | None
)


def to_symbology_state(
    symbology: SymbologyInput,
) -> dict[str, Any] | None:
    """Serialize a symbology value to a plain dict suitable for storage.

    Accepts the various forms that the API may produce:

    * ``None`` — returns ``None``.
    * ``GrammarSymbology`` — serialized directly.
    * ``list[Mapping]`` — treated as one layer.
    * ``list[GrammarSymbology]`` — layers are merged and serialized.
    * ``list[list[Mapping]]`` — each nested list is one layer.
    * ``Layer`` — serialized as a single layer.
    * ``pydantic.BaseModel`` — serialized if the model has a ``layers`` key.
    * ``dict`` — passed through if it contains a ``layers`` key.

    :param symbology: The symbology to serialize.
    :returns: A ``dict`` with a ``"layers"`` key, or ``None`` when the input
        is ``None`` or produces no layers.
    :raises TypeError: If the input type is not supported.
    :raises ValueError: If a dict input lacks the required ``'layers'`` key.
    """
    if symbology is None:
        return None

    if isinstance(symbology, Layer):
        return GrammarSymbology(layers=[symbology._to_grammar_layer()]).model_dump(
            mode="json",
            exclude_none=True,
        )

    # Handle list-based symbology forms
    if isinstance(symbology, list):
        if not symbology:
            return None

        # Single-layer shorthand: a top-level list of Mapping values.
        if all(isinstance(item, Mapping) for item in symbology):
            return GrammarSymbology(
                layers=[grammar_layer(*[mapping._rule for mapping in symbology])],
            ).model_dump(
                mode="json",
                exclude_none=True,
            )

        layers: list[schema_symbology.IGrammarLayer] = []
        for item in symbology:
            if isinstance(item, GrammarSymbology):
                layers.extend(item.layers)
            elif isinstance(item, MappingChain):
                raise TypeError(
                    "Unfinished mapping chain. Finish chains with .encoding(...).",
                )
            elif isinstance(item, Layer | list | tuple):
                layers.append(_coerce_layer(item))
            else:
                raise TypeError(f"Unsupported symbology item in list: {type(item)!r}")
        if not layers:
            return None
        return GrammarSymbology(layers=layers).model_dump(
            mode="json",
            exclude_none=True,
        )

    if isinstance(symbology, GrammarSymbology):
        return symbology.model_dump(mode="json", exclude_none=True)

    if isinstance(symbology, BaseModel):
        payload = symbology.model_dump(mode="json", exclude_none=True)
        if "layers" in payload:
            return {"layers": payload["layers"]}
        raise TypeError(
            f"Unsupported BaseModel symbology value: {type(symbology)!r}",
        )

    if isinstance(symbology, dict):
        layers = symbology.get("layers")
        if layers is None:
            raise ValueError("symbology dict must contain a 'layers' key")
        return {"layers": layers}

    raise TypeError(f"Unsupported symbology value: {type(symbology)!r}")
