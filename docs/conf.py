import os

on_rtd = os.environ.get("READTHEDOCS", None) == "True"

html_theme = "pydata_sphinx_theme"
html_theme_options = {
    "github_url": "https://github.com/geojupyter/jupytergis",
    "navbar_align": "left",
    "header_links_before_dropdown": 6,
    "pygments_light_style": "tango",
    "pygments_dark_style": "monokai",
    "navbar_end": [
        "theme-switcher",
        "navbar-icon-links",
    ],
    "external_links": [
        {"name": "Try with JupyterLite", "url": "lite/lab/index.html"},
    ],
}

# Hide left sidebar on single-page sections; keep it for Users and Contributors
html_sidebars = {
    "index": [],
    "about/*": [],
    "getting_started/*": [],
    "changelog": [],
}

html_static_path = ["assets"]
html_css_files = [
    "css/custom.css",
]

extensions = [
    "jupyterlite_sphinx",
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx.ext.intersphinx",
    "sphinx.ext.napoleon",
    "sphinxcontrib.mermaid",
    "sphinx_inline_tabs",
    "sphinx_exercise",
    "sphinx_togglebutton",
    "myst_parser",
]

myst_enable_extensions = [
    "colon_fence",
]
myst_fence_as_directive = ["mermaid"]

master_doc = "index"
project = "JupyterGIS"
html_title = "JupyterGIS docs"
copyright = "2024, The JupyterGIS Development Team"
author = "The JupyterGIS Development Team"
language = "en"

jupyterlite_contents = [
    "../examples",
]
jupyterlite_dir = "."
jupyterlite_config = "jupyter_lite_config.json"
jupyterlite_silence = False

exclude_patterns = []
highlight_language = "python"
pygments_style = "sphinx"
todo_include_todos = False
htmlhelp_basename = "jupytergisdoc"

intersphinx_mapping = {"python": ("https://docs.python.org/3", None)}

nitpick_ignore = [
    ("py:mod", "ypywidgets"),
]

jupyterlite_ignore_contents = [
    r".*\.qgz$",
    r"99-Explore_data_in_a_map\.ipynb$",
]
