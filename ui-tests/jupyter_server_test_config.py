"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""

import os

from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)  # noqa: F821
c.LabApp.collaborative = True  # noqa: F821
c.FileContentsManager.delete_to_trash = False  # noqa: F821

# Verbose kernel/session logs in CI to debug xeus hangs.
if os.environ.get("CI") or os.environ.get("JGIS_TEST_SERVER_DEBUG"):
    c.Application.log_level = "DEBUG"  # noqa: F821
    c.ServerApp.log_level = "DEBUG"  # noqa: F821
