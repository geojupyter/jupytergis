import os

on_rtd = os.environ.get("READTHEDOCS", None) == "True"

html_theme = "pydata_sphinx_theme"
html_theme_options = {"github_url": "https://github.com/geojupyter/jupytergis"}

extensions = [
    "jupyterlite_sphinx",
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx.ext.intersphinx",
    "sphinx.ext.napoleon",
    "sphinx_tabs.tabs",
]

source_suffix = ".rst"
master_doc = "index"
project = "JupyterGIS"
copyright = "2024, The JupyterGIS Development Team"
author = "The JupyterGIS Development Team"
language = "en"

jupyterlite_contents = [
    "../examples/*.jGIS",
    "../examples/*.json",
    "../examples/nyc.zip",
    "../examples/radar.gif",
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
