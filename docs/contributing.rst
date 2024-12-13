.. _contributing:

============
Contributing
============

Development install
-------------------

**Note:** You will need `Node.js <https://nodejs.org/>`_ to build the extension package.

The ``jlpm`` command is JupyterLab's pinned version of
`yarn <https://yarnpkg.com/>`_ that is installed with JupyterLab. You may use
`yarn <https://yarnpkg.com/>`_ or `npm <https://www.npmjs.com/>`_ in lieu of ``jlpm`` below.

.. code-block:: bash

    # Clone the repo to your local environment
    git clone https://github.com/geojupyter/jupytergis.git

    # Change directory to the jupytergis directory
    cd jupytergis

    # Create a virtual environment and activate it
    python -m venv .venv
    source .venv/bin/activate

    # Install JupyterLab for jlpm
    python -m pip install jupyterlab

    # Install packages in development mode.
    # WARNING: This step may hang indefinitely due to a bug in Nx. See
    #          troubleshooting below.
    python scripts/dev-install.py

    # Rebuild extension Typescript source after making changes
    jlpm run build

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

.. code-block:: bash

    # Watch the source directory in one terminal, automatically rebuilding when needed
    jlpm run watch

    # Run JupyterLab in another terminal
    jupyter lab

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the ``jlpm run build`` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

.. code-block:: bash

    jupyter lab build --minimize=False


Development uninstall
----------------------

.. code-block:: bash

    pip uninstall jupytergis

In development mode, you will also need to remove the symlink created by ``jupyter labextension develop`` command. To find its location, you can run ``jupyter labextension list`` to figure out where the ``labextensions`` folder is located. Then you can remove the symlink named ``jupytergis`` within that folder.


Troubleshooting
---------------

* Setup of development environment hangs indefinitely when running the
  ``dev-install.py`` step, specifically on the Yarn linking step.

  * This may be caused by having a ``.gitignore`` file in your home directory.
    This is a `known issue with Nx <https://github.com/nrwl/nx/issues/27494>`_.
    The `only known workaround <https://github.com/nrwl/nx/issues/27494#issuecomment-2481207598>`_ is to remove the ``.gitignore`` file from your home directory or to work in a location outside of the home directory tree.
