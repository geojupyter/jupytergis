import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class BackendCheckHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        body = self.get_json_body()
        qgis_installed = True
        try:
            import qgis  # noqa
        except ImportError:
            qgis_installed = False
        self.finish(json.dumps({"installed": qgis_installed}))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupytergis_qgis", "backend-check")
    handlers = [(route_pattern, BackendCheckHandler)]
    web_app.add_handlers(host_pattern, handlers)
