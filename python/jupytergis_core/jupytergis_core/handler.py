from os import environ

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import requests


class ProxyHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        url = self.get_argument("url")
        print(f"Proxy request received for: {url}")
        try:
            response = requests.get(url)
            response.raise_for_status()

            self.set_header("Access-Control-Allow-Origin", "*")
            self.set_header(
                "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
            )
            self.set_header(
                "Access-Control-Allow-Headers",
                "X-Requested-With, Content-Type, Authorization",
            )

            self.set_header("Content-Type", response.headers["Content-Type"])

            self.finish(response.content)
        except requests.exceptions.RequestException as e:
            self.set_status(500)
            self.finish(str(e))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    proxy_route_pattern = url_path_join(base_url, "jupytergis_core", "proxy")

    print(f"Setting up proxy handler at: {proxy_route_pattern}")
    handlers = [(proxy_route_pattern, ProxyHandler)]
    if environ.get("JGIS_EXPOSE_MAPS", False):
        web_app.settings["page_config_data"]["jgis_expose_maps"] = True
    web_app.add_handlers(host_pattern, handlers)
