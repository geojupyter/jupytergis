# Keybindings

:::{admonition} Objectives
:class: seealso

By the end of this tutorial, you will be able to add or modify keybindings for
JupyterGIS.
:::

:::{admonition} Prerequisites
:class: warning

* Knowledge of "commands".
:::

## The keybindings file

Keybindings exist in the `base` JavaScript package at
`packages/base/src/keybindings.json`.

## Editing the keybindings file

Each keybinding configuration maps a `command` to its keybindings `keys`.
For example, this keybinding triggers the "identify" command when the `I` key is pressed:

```yaml
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

Probably `.data-jgis-keybinding`!
_TODO: What do "selectors" do?_

## References

* A PR which adds a keybinding to toggle the identify tool with `i`:
  <https://github.com/geojupyter/jupytergis/issues/582>
