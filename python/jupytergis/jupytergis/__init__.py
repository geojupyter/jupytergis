# This is to make dev jgis work with dev jgis-tiler -- remove eventually
from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

__version__ = "0.14.0"

from jupytergis_lab import GISDocument, explore  # noqa
