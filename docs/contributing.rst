============
Contributing
============

Development install
-------------------

.. note::

    You will need `Node.js <https://nodejs.org/>`_ to build the extension package.

    The ``jlpm`` command is JupyterLab's pinned version of
    `yarn <https://yarnpkg.com/>`__ that is installed with JupyterLab. You may use
    `yarn <https://yarnpkg.com/>`__ or `npm <https://www.npmjs.com/>`_ in lieu of ``jlpm`` below.


Clone the source
^^^^^^^^^^^^^^^^

.. code-block:: bash

    # Clone the repo to your local environment
    git clone https://github.com/geojupyter/jupytergis.git

    # Change directory to the jupytergis directory
    cd jupytergis


Create a virtual environment
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. tabs::

    .. tab:: Micromamba (recommended)

        .. code-block:: bash

            # Create a virtual environment
            micromamba create --name jupytergis_dev -c conda-forge pip "nodejs<22" qgis

            # Activate it
            micromamba activate jupytergis_dev


    .. tab:: Plain python

        .. note::

            You may need to install some non-Python dependencies (e.g. QGIS,
            Node.js) separately when using this method.


        .. code-block:: bash

            # Create a virtual environment
            python -m venv .venv

            # Activate it
            source .venv/bin/activate


Install dependencies and build
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: bash

    # Install JupyterLab for jlpm
    python -m pip install jupyterlab

    # Install packages in development mode.
    # WARNING: This step may hang indefinitely due to a bug in Nx. See
    #          troubleshooting below.
    python scripts/dev-install.py

    # Rebuild extension Typescript source after making changes
    jlpm run build


.. note::

    By default, the ``jlpm run build`` command generates the source maps for this extension to make it easier to debug using the browser dev tools.
    To also generate source maps for the JupyterLab core extensions, you can run the following command:

    .. code-block:: bash

        jupyter lab build --minimize=False


Watch for changes and rebuild
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

.. code-block:: bash

    # Watch the source directory in one terminal, automatically rebuilding when needed
    jlpm run watch

    # Run JupyterLab in another terminal
    jupyter lab

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

.. note::

   ``jlpm run watch`` will sit and wait for a change once started. Edit a file
   to trigger a build.


Development uninstall
----------------------

.. code-block:: bash

    pip uninstall jupytergis

In development mode, you will also need to remove the symlink created by ``jupyter labextension develop`` command. To find its location, you can run ``jupyter labextension list`` to figure out where the ``labextensions`` folder is located. Then you can remove the symlink named ``jupytergis`` within that folder.


Code quality
------------

We have several tools configured for checking code quality:

* Pre-commit checks run automatically at commit time.
  Install checks with ``pre-commit install``.
  Run them manually with ``pre-commit run --all-files``.
  **Will exit non-zero when finding errors or changing files.**

  * Ruff formats and lints (sometimes autofixes) Python code.

  * Generic pre-commit checks help avoid common mistakes like committing large
    files or trailing whitespace.

* Package scripts (defined in ``package.json``) to check (and/or fix)
  TypeScript, JavaScript, CSS, JSON, Markdown, and YAML.
  Run manually with ``jlpm run lint``.
  **Will exit 0 when applying fixes.
  Check the logs and/or ``git status`` after every run.**

  * Prettier formats the file types listed above.

  * Eslint lints (sometimes autofixes) JS/TS code.


Troubleshooting
---------------

* Setup of development environment hangs indefinitely when running the
  ``dev-install.py`` step, specifically on the Yarn linking step.

  * This may be caused by having a ``.gitignore`` file in your home directory.
    This is a `known issue with Nx <https://github.com/nrwl/nx/issues/27494>`_.
    The `only known workaround <https://github.com/nrwl/nx/issues/27494#issuecomment-2481207598>`_ is to remove the ``.gitignore`` file from your home directory or to work in a location outside of the home directory tree.
