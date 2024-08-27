import os

on_rtd = os.environ.get("READTHEDOCS", None) == "True"

html_theme = "pydata_sphinx_theme"
html_theme_options = {"github_url": "https://github.com/geojupyter/jupytergis"}

extensions = [
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx.ext.intersphinx",
    "sphinx.ext.napoleon",
]

source_suffix = ".rst"
master_doc = "index"
project = "JupyterGIS"
copyright = "2023, The JupyterGIS Development Team"
author = "The JupyterGIS Development Team"
language = "en"

exclude_patterns = []
highlight_language = "python"
pygments_style = "sphinx"
todo_include_todos = False
htmlhelp_basename = "jupytergisdoc"

intersphinx_mapping = {"https://docs.python.org": None}
