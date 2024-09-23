import json
from urllib.error import HTTPError

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


class ExportToQgisHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        body = self.get_json_body()
        qgis_installed = True
        try:
            from .qgis_loader import export_project_to_qgis  # noqa
        except ImportError:
            qgis_installed = False

        if not qgis_installed:
            raise HTTPError(500, "QGIS is not installed")

        path = body.get("path", "")
        virtual_file = body.get("virtual_file", "")
        if not path:
            raise HTTPError(400, "The file path is missing")
        elif not virtual_file:
            raise HTTPError(400, "The file content is missing")

        status = export_project_to_qgis(path, virtual_file)
        self.finish(json.dumps({"exported": status, "path": path}))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    check_pattern = url_path_join(base_url, "jupytergis_qgis", "backend-check")
    export_pattern = url_path_join(base_url, "jupytergis_qgis", "export")
    handlers = [
        (check_pattern, BackendCheckHandler),
        (export_pattern, ExportToQgisHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
