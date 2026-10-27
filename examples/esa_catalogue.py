"""Build JupyterGIS OpenEO layers from real ESA APEx algorithm-catalogue UDPs.

The ESA APEx *Algorithm Catalogue* (https://algorithm-catalogue.apex.esa.int)
publishes Earth-observation algorithms as openEO **User-Defined Processes**
(UDPs) — self-contained openEO process graphs — in the public
``ESA-APEx/apex_algorithms`` GitHub repository.

A number of these UDPs are pure band-math / index algorithms whose *every*
openEO process is implemented by ``titiler-openeo``. Their **original** graphs
can therefore be served straight into JupyterGIS as XYZ tile layers, without
rewriting the algorithm — only the ``load_collection`` binding differs, because
the catalogue graphs target the Copernicus Data Space collection id
(``SENTINEL2_L2A``) while a local ``titiler-openeo`` typically exposes the
Element-84 Earth-Search collection id (``sentinel-2-l2a``).

This module:

* keeps a curated list of catalogue UDPs that run unmodified on titiler-openeo
  (:data:`CATALOGUE`),
* fetches a UDP graph verbatim from GitHub (:func:`fetch_udp`),
* rebinds it to the collection your titiler-openeo exposes and resolves the
  graph's parameters to concrete values (:func:`build_datacube`), returning an
  openEO ``DataCube`` ready for ``GISDocument.add_openeo_tile_layer(...)``.

:data:`CATALOGUE` is only a curated *menu* of graphs confirmed to run here — it
is not a whitelist. The engine is generic: :func:`fetch_udp` and
:func:`build_datacube` also accept a **raw repo path** to any UDP JSON in
``ESA-APEx/apex_algorithms``, so you can run a catalogue algorithm that isn't
listed below *without editing this file*, e.g.::

    build_datacube(con, "algorithm_catalog/<publisher>/<algo>/openeo_udp/<algo>.json")

Only ``titiler-openeo`` advertises the XYZ secondary web service that JupyterGIS
needs to render an openEO layer, so these examples assume a local (or remote)
titiler-openeo server — see ``examples/99-OpenEO-titiler-local.ipynb`` for setup.

Usage
-----
>>> import openeo
>>> from jupytergis import GISDocument
>>> from esa_catalogue import build_datacube, list_algorithms
>>> con = openeo.connect("http://127.0.0.1:8080").authenticate_basic("test", "test")
>>> cube = build_datacube(con, "ndsi")           # real APEx NDSI graph
>>> doc = GISDocument()
>>> await doc.ready()
>>> doc.add_openeo_tile_layer(cube, name="NDSI (snow)")
"""

from __future__ import annotations

import copy
import json
import re
import urllib.request
from typing import Any

_RAW_BASE = "https://raw.githubusercontent.com/ESA-APEx/apex_algorithms/main/"
CATALOGUE_HOME = "https://algorithm-catalogue.apex.esa.int"


class Algorithm:
    """Metadata for one catalogue UDP that runs unmodified on titiler-openeo."""

    def __init__(self, path: str, title: str, theme: str, *, verified: bool = False):
        #: Path of the UDP JSON inside the ESA-APEx/apex_algorithms repo.
        self.path = path
        #: Human-readable title.
        self.title = title
        #: One-word theme (snow, vegetation, water, ...).
        self.theme = theme
        #: ``True`` if this graph has been confirmed to validate *and* render a
        #: real tile on a reference titiler-openeo (a CDSE-federated Sentinel-2
        #: L2A backend). Unverified graphs are valid catalogue UDPs but may be
        #: rejected by a given titiler-openeo build (e.g. its process-graph
        #: validator, pipeline-item limit, or unsupported band-math shape).
        self.verified = verified

    @property
    def source_url(self) -> str:
        """Permalink to the UDP definition on GitHub (the graph we run)."""
        return f"https://github.com/ESA-APEx/apex_algorithms/blob/main/{self.path}"

    @property
    def raw_url(self) -> str:
        return _RAW_BASE + self.path


def _ds(name: str) -> str:
    return f"algorithm_catalog/developmentseed/{name}/openeo_udp/{name}.json"


#: Catalogue UDPs whose openEO process vocabulary is supported by titiler-openeo,
#: so their original graphs can render in JupyterGIS as-is (only the Sentinel-2
#: collection id is rebound and band names remapped). Keyed by catalogue
#: algorithm id. Entries flagged ``verified=True`` have been confirmed to
#: validate *and* render a real tile on a reference titiler-openeo; the rest are
#: valid UDPs that a given backend build may still reject (see ``Algorithm``).
CATALOGUE: dict[str, Algorithm] = {
    "ndsi": Algorithm(
        _ds("ndsi"),
        "Normalized Difference Snow Index",
        "snow",
        verified=True,
    ),
    "snow_classifier": Algorithm(
        _ds("snow_classifier"),
        "Snow classifier (NDSI + NDVI)",
        "snow",
        verified=True,
    ),
    "enhanced_vegetation_index": Algorithm(
        _ds("enhanced_vegetation_index"),
        "Enhanced Vegetation Index 2 (EVI2)",
        "vegetation",
    ),
    "atmospheric_resistant_vegetation_index": Algorithm(
        _ds("atmospheric_resistant_vegetation_index"),
        "Atmospherically Resistant Vegetation Index (ARVI)",
        "vegetation",
    ),
    "plant-senescence-reflectance-index": Algorithm(
        _ds("plant-senescence-reflectance-index"),
        "Plant Senescence Reflectance Index (PSRI)",
        "vegetation",
    ),
    "ndci_cyanobacteria": Algorithm(
        _ds("ndci_cyanobacteria"),
        "NDCI cyanobacteria (chlorophyll-a)",
        "water",
    ),
    "mago_water_quality": Algorithm(
        _ds("mago_water_quality"),
        "MAGO inland water-quality",
        "water",
    ),
    "swbm": Algorithm(
        _ds("swbm"),
        "Simple Water Bodies Mapping",
        "water",
        verified=True,
    ),
    "apa_aquatic_plants_algae": Algorithm(
        _ds("apa_aquatic_plants_algae"),
        "Aquatic Plants & Algae detection",
        "water",
    ),
    "barren_soil": Algorithm(_ds("barren_soil"), "Barren Soil Index (BSI)", "soil"),
    "bais2": Algorithm(
        _ds("bais2"),
        "Burned Area Index for Sentinel-2 (BAIS2)",
        "fire",
    ),
    "fire_boundary": Algorithm(_ds("fire_boundary"), "Fire boundary detection", "fire"),
    "wildfire_visualization": Algorithm(
        _ds("wildfire_visualization"),
        "Cartographic wildfire visualization",
        "fire",
    ),
}

# Names of the special, process-local parameters that openEO binds inside child
# process graphs (reducers, apply callbacks, load_collection property filters).
# These are NOT top-level UDP parameters and must never be substituted here.
_LOCAL_PARAMS = {"data", "x", "y", "value", "context", "label"}


def list_algorithms(*, verified_only: bool = False) -> None:
    """Print the curated catalogue algorithms grouped by theme.

    A ``✓`` marks graphs verified to validate and render on a reference
    titiler-openeo; unmarked ones are valid UDPs a given backend may still
    reject. Pass ``verified_only=True`` to list only the confirmed-working ones.
    """
    by_theme: dict[str, list[str]] = {}
    for key, algo in CATALOGUE.items():
        if verified_only and not algo.verified:
            continue
        mark = "✓" if algo.verified else " "
        by_theme.setdefault(algo.theme, []).append(f"{mark} {key} — {algo.title}")
    for theme in sorted(by_theme):
        print(f"[{theme}]")
        for line in by_theme[theme]:
            print(f"  {line}")


def default_extent(name: str) -> dict[str, float] | None:
    """Return the catalogue author's default AOI for ``name`` (or ``None`` if the
    UDP has no default extent). Handy for centering a map on the algorithm.
    """
    udp = fetch_udp(name)
    defaults = {p["name"]: p.get("default") for p in udp.get("parameters", [])}
    spatial_names, _ = _extent_param_names(udp["process_graph"])
    for pname in spatial_names:
        extent = defaults.get(pname)
        if isinstance(extent, dict) and "west" in extent:
            return extent
    return None


def default_center(name: str) -> tuple[float, float] | None:
    """Return ``(latitude, longitude)`` of the default AOI centre, or ``None``."""
    extent = default_extent(name)
    if not extent:
        return None
    lat = (extent["south"] + extent["north"]) / 2
    lon = (extent["west"] + extent["east"]) / 2
    return lat, lon


def fetch_udp(name: str) -> dict[str, Any]:
    """Fetch a catalogue UDP definition verbatim from GitHub.

    :param name: Catalogue algorithm id (a key of :data:`CATALOGUE`) or a raw
        repo path to a UDP JSON.
    """
    if name in CATALOGUE:
        url = CATALOGUE[name].raw_url
    elif name.endswith(".json"):
        url = _RAW_BASE + name.lstrip("/")
    else:
        raise KeyError(
            f"Unknown algorithm {name!r}. Known ids: {', '.join(sorted(CATALOGUE))}",
        )
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _substitute_parameters(node: Any, values: dict[str, Any]) -> Any:
    """Recursively replace ``{"from_parameter": k}`` with ``values[k]``.

    Only top-level UDP parameters (those present in ``values``) are substituted;
    process-local parameters bound by parent processes are left untouched.
    """
    if isinstance(node, dict):
        if set(node) == {"from_parameter"} and node["from_parameter"] in values:
            return copy.deepcopy(values[node["from_parameter"]])
        return {k: _substitute_parameters(v, values) for k, v in node.items()}
    if isinstance(node, list):
        return [_substitute_parameters(v, values) for v in node]
    return node


def _extent_param_names(process_graph: dict[str, Any]) -> tuple[set[str], set[str]]:
    """Return the parameter names a graph's ``load_collection`` uses for its
    spatial and temporal extents (names vary between catalogue authors — e.g.
    ``bounding_box``/``time`` vs ``bbox``/``temporal_extent``).
    """
    spatial: set[str] = set()
    temporal: set[str] = set()
    for node in process_graph.values():
        if not isinstance(node, dict) or node.get("process_id") != "load_collection":
            continue
        for key, bucket in (("spatial_extent", spatial), ("temporal_extent", temporal)):
            ref = node["arguments"].get(key)
            if isinstance(ref, dict) and set(ref) == {"from_parameter"}:
                bucket.add(ref["from_parameter"])
    return spatial, temporal


def _rebind_load_collection(
    process_graph: dict[str, Any],
    collection: str,
    bands: list[str] | None,
    keep_cloud_filter: bool,
) -> None:
    """In-place: point every ``load_collection`` at ``collection``."""
    for node in process_graph.values():
        if not isinstance(node, dict) or node.get("process_id") != "load_collection":
            continue
        args = node["arguments"]
        args["id"] = collection
        if bands is not None:
            args["bands"] = bands
        if not keep_cloud_filter:
            # The scene-level eo:cloud_cover property filter is optional and
            # backend-specific; drop it by default so the graph doesn't depend
            # on STAC query support in the target collection.
            args.pop("properties", None)


def _requested_bands(process_graph: dict[str, Any]) -> list[str]:
    """Collect every band name any ``load_collection`` in the graph requests."""
    out: list[str] = []
    for node in process_graph.values():
        if not isinstance(node, dict) or node.get("process_id") != "load_collection":
            continue
        for band in node["arguments"].get("bands") or []:
            if isinstance(band, str) and band not in out:
                out.append(band)
    return out


def collection_band_names(connection, collection: str) -> list[str]:
    """Return the band names ``collection`` exposes on the connected backend.

    Reads the collection's ``cube:dimensions`` band dimension (openEO STAC), then
    falls back to ``summaries.eo:bands``. Returns ``[]`` if the metadata declares
    no bands.
    """
    meta = connection.describe_collection(collection)
    for dim in (meta.get("cube:dimensions") or {}).values():
        if isinstance(dim, dict) and dim.get("type") == "bands":
            return [b for b in dim.get("values", []) if isinstance(b, str)]
    eo_bands = (meta.get("summaries") or {}).get("eo:bands", [])
    return [b["name"] for b in eo_bands if isinstance(b, dict) and "name" in b]


def _resolution_rank(suffix: str) -> int:
    """Sort key for a band's resolution suffix; finer (e.g. ``10m``) sorts first."""
    match = re.fullmatch(r"(\d+)m", suffix)
    return int(match.group(1)) if match else 10**6


def _build_band_map(
    requested: list[str],
    available: list[str],
) -> dict[str, str]:
    """Map each requested band to the backend's actual name for it.

    Catalogue graphs use bare Sentinel-2 band names (``B02``, ``B8A``, ...). Some
    backends expose those verbatim (Earth Search) while others suffix them with a
    resolution (``B02_10m``, ``B8A_20m``, ...). For every requested band that the
    backend does *not* expose verbatim, pick its finest-resolution variant
    (``B02`` -> ``B02_10m``). Bands with no match are left unchanged so a genuine
    typo still surfaces as a clear backend error.
    """
    available_set = set(available)
    band_map: dict[str, str] = {}
    for band in requested:
        if band in available_set:
            continue
        variants = [b for b in available if b.startswith(f"{band}_")]
        if not variants:
            continue
        band_map[band] = min(
            variants,
            key=lambda b: _resolution_rank(b[len(band) + 1 :]),
        )
    return band_map


def _apply_band_map(node: Any, band_map: dict[str, str]) -> Any:
    """Recursively rename band names in-graph (``load_collection.bands`` and the
    band-label string literals downstream band-math uses to pick a band).
    """
    if isinstance(node, dict):
        return {k: _apply_band_map(v, band_map) for k, v in node.items()}
    if isinstance(node, list):
        return [_apply_band_map(v, band_map) for v in node]
    if isinstance(node, str):
        return band_map.get(node, node)
    return node


def build_datacube(
    connection,
    name: str,
    *,
    collection: str = "sentinel-2-l2a",
    spatial_extent: dict[str, float] | None = None,
    temporal_extent: list[str] | None = None,
    bands: list[str] | None = None,
    keep_cloud_filter: bool = False,
    remap_bands: bool = True,
    parameters: dict[str, Any] | None = None,
):
    """Return an openEO ``DataCube`` for catalogue algorithm ``name``.

    The algorithm's original graph is used unchanged apart from the
    ``load_collection`` binding. The graph's declared parameters are resolved to
    concrete values (its own catalogue-author defaults, unless overridden) so the
    result is a fully-bound, ready-to-render cube.

    :param connection: An authenticated ``openeo.Connection`` to a titiler-openeo
        server.
    :param name: Catalogue algorithm id (key of :data:`CATALOGUE`) or repo path.
    :param collection: Collection id your titiler-openeo exposes for Sentinel-2
        L2A. Defaults to the Earth-Search id ``sentinel-2-l2a``.
    :param spatial_extent: Optional ``{west, south, east, north}`` AOI. Defaults
        to the catalogue author's own AOI baked into the UDP.
    :param temporal_extent: Optional ``[start, end]`` range. Defaults to the
        catalogue author's own range.
    :param bands: Optional band-name override (when your collection names bands
        differently from the catalogue graph). Given explicitly, it is used as-is
        and automatic band-name remapping is skipped.
    :param keep_cloud_filter: Keep the UDP's scene-level ``eo:cloud_cover``
        property filter (requires STAC query support in the collection).
    :param remap_bands: When ``True`` (default) and ``bands`` is not given, query
        the backend's ``collection`` and rewrite the graph's bare Sentinel-2 band
        names (``B02``) to the names the backend actually exposes (e.g.
        ``B02_10m``, picking the finest resolution). No-op on backends that expose
        the bare names.
    :param parameters: Optional extra parameter overrides by name.
    """
    udp = fetch_udp(name)
    process_graph = copy.deepcopy(udp["process_graph"])

    # Resolve declared parameters to concrete values: author defaults first,
    # then any caller overrides.
    values: dict[str, Any] = {
        p["name"]: p.get("default")
        for p in udp.get("parameters", [])
        if p["name"] not in _LOCAL_PARAMS
    }
    spatial_names, temporal_names = _extent_param_names(process_graph)
    if spatial_extent is not None:
        for pname in spatial_names:
            values[pname] = spatial_extent
    if temporal_extent is not None:
        for pname in temporal_names:
            values[pname] = temporal_extent
    if parameters:
        values.update(parameters)

    _rebind_load_collection(process_graph, collection, bands, keep_cloud_filter)

    # Catalogue graphs request bare Sentinel-2 band names (``B02``); some backends
    # expose them suffixed by resolution (``B02_10m``). When the caller hasn't
    # curated an explicit band list, rewrite the graph's band names to whatever
    # this backend's collection actually exposes (both in load_collection and in
    # the downstream band-label references band-math relies on).
    if bands is None and remap_bands:
        band_map = _build_band_map(
            _requested_bands(process_graph),
            collection_band_names(connection, collection),
        )
        if band_map:
            process_graph = _apply_band_map(process_graph, band_map)

    # load_collection's spatial/temporal extents (and any other parameter refs)
    # still point at from_parameter; resolve them to concrete values.
    process_graph = _substitute_parameters(process_graph, values)

    unresolved = _find_unresolved_parameters(process_graph, values)
    if unresolved:
        raise ValueError(
            f"Algorithm {name!r} has unresolved parameter(s) {sorted(unresolved)}; "
            "pass them via the `parameters=` argument.",
        )

    for node in process_graph.values():
        if isinstance(node, dict) and node.get("process_id") == "load_collection":
            args = node["arguments"]
            if args.get("spatial_extent") is None:
                raise ValueError(
                    f"Algorithm {name!r} has no default spatial extent; pass "
                    "`spatial_extent={'west':..,'south':..,'east':..,'north':..}`.",
                )
            if args.get("temporal_extent") is None:
                raise ValueError(
                    f"Algorithm {name!r} has no default temporal extent; pass "
                    "`temporal_extent=['YYYY-MM-DD', 'YYYY-MM-DD']`.",
                )

    return connection.datacube_from_flat_graph(process_graph)


def _find_unresolved_parameters(node: Any, values: dict[str, Any]) -> set[str]:
    """Collect top-level ``from_parameter`` refs that were not substituted."""
    found: set[str] = set()
    if isinstance(node, dict):
        if set(node) == {"from_parameter"}:
            name = node["from_parameter"]
            if name not in _LOCAL_PARAMS:
                found.add(name)
        else:
            for v in node.values():
                found |= _find_unresolved_parameters(v, values)
    elif isinstance(node, list):
        for v in node:
            found |= _find_unresolved_parameters(v, values)
    return found


if __name__ == "__main__":
    print(f"ESA APEx algorithm catalogue: {CATALOGUE_HOME}\n")
    print("Curated titiler-openeo-runnable algorithms:\n")
    list_algorithms()
