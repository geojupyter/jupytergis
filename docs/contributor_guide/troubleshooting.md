# Troubleshooting

- Setup of development environment hangs indefinitely when running the
  `dev-install.py` step, specifically on the Yarn linking step.

  - This may be caused by having a `.gitignore` file in your home directory.
    This is a [known issue with Nx](https://github.com/nrwl/nx/issues/27494).
    The [only known workaround](https://github.com/nrwl/nx/issues/27494#issuecomment-2481207598) is to remove the `.gitignore` file from your home directory or to work in a location outside of the home directory tree.
