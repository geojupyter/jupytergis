# Keybindings

:::{admonition} Objectives
:class: seealso

By the end of this tutorial, you will be able to add or modify keybindings for
JupyterGIS.
:::

:::{admonition} Prerequisites
:class: warning

- Knowledge of "commands".

:::

## The keybindings file

Keybindings exist in the `base` JavaScript package at
`packages/base/src/keybindings.json`.

## Editing the keybindings file

Each keybinding configuration maps a `command` to its keybindings `keys` and the HTML
element selectors for which this keybinding is enabled.
For example, this keybinding triggers the "identify" command when the `I` key is pressed:

```json
  {
      "command": "jupytergis:identify",
      "keys": ["I"],
      "selector": ".data-jgis-keybinding"
  },
```

### Where do I find the command ID string?

Command IDs are defined in the `CommandIDs` namespace in the `base` JavaScript package
(`packages/base/src/constants.ts`).

### What selector string do I need?

Probably only `.data-jgis-keybinding`!
This selector enables the keybinding to work when
JupyterGIS is in focus, but not when for example a Jupyter Notebook is in focus.

In some special cases, you may want more selectors to further restrict the focused
elements that accept the keybinding.

## References

- A PR which adds a keybinding to toggle the identify tool with `i`:
  <https://github.com/geojupyter/jupytergis/issues/582>
