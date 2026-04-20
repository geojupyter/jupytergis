(how-to-ai-skills)=

# Teach the AI chat with Agent Skills

JupyterGIS ships a growing set of commands (layer creation, symbology, story maps, processing operations, …) that can be driven programmatically. When you use [JupyterLite AI](https://jupyterlite-ai.readthedocs.io/) as your chat interface, the assistant does not know about these commands out of the box and cannot reliably pick the right one for a task.

[Agent Skills](https://agentskills.io) are the supported way to bridge that gap: you drop a small markdown file into your workspace, and the chat picks it up automatically whenever the request matches. This guide explains how to author a JupyterGIS skill on the filesystem and make it discoverable by JupyterLite AI.

:::{admonition} Scope
:class: note
This page covers the **filesystem** workflow — authoring `SKILL.md` files under your workspace. JupyterLite AI also supports registering skills programmatically from a JupyterLab extension; see the [upstream Agent Skills documentation](https://jupyterlite-ai.readthedocs.io/en/latest/skills/) for that path.
:::

## Prerequisites

- A JupyterGIS installation with [JupyterLite AI](https://jupyterlite-ai.readthedocs.io/) enabled and a model provider configured.
- A `.jGIS` file open in your workspace to exercise the skill against.

## Where to place skills

Skills live in a dedicated directory at the root of your Jupyter workspace. JupyterLite AI scans two locations by default:

```
.agents/skills/          # hidden directory (requires allow_hidden)
  add-basemap/
    SKILL.md

_agents/skills/          # visible in the Jupyter file browser
  add-basemap/
    SKILL.md
```

Use `_agents/skills/` if you want the folder to be visible in the file browser with no extra configuration — this is the easiest starting point. Use `.agents/skills/` if you want to follow the convention shared with other AI coding tools; it takes priority when the same skill name exists in both locations.

Each skill is its own subdirectory containing a `SKILL.md` file. Only the top-level subdirectories are scanned, so nesting skills further will not work.

## Writing a JupyterGIS skill

A skill is a markdown file with YAML frontmatter: a `name`, a `description` the chat uses to decide when the skill is relevant, and a body containing the instructions the agent should follow once it activates.

Here is a minimal skill that teaches the assistant how to add an OpenStreetMap raster basemap to the currently open project:

````markdown
---
name: jupytergis-add-osm-basemap
description: Add an OpenStreetMap raster basemap to the currently open JupyterGIS (.jGIS) document.
---

## Instructions

When the user asks to add an OpenStreetMap basemap (or a default basemap) to a JupyterGIS document:

1. Determine the path of the active `.jGIS` file. If no document is open, ask the user to open one first.
2. Invoke the command `jupytergis:newRasterWithParams` with:

   ```json
   {
     "filePath": "<path to the .jGIS file>",
     "name": "OpenStreetMap",
     "parameters": {
       "source": {
         "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
         "maxZoom": 19,
         "minZoom": 0,
         "attribution": "© OpenStreetMap contributors"
       }
     }
   }
   ```

3. Confirm to the user that the layer has been added and suggest they toggle it in the layer tree if it is not already visible.

## Guidelines

- Never invent a file path — always read it from the active document or ask the user.
- Prefer `*WithParams` variants of JupyterGIS commands (e.g. `jupytergis:newRasterWithParams`) over the dialog-based ones, so execution does not require UI interaction.
- Keep layer names short and human-readable.
````

The frontmatter fields are:

| Field         | Required | Description                                                     |
| ------------- | -------- | --------------------------------------------------------------- |
| `name`        | Yes      | Short identifier used to load the skill.                        |
| `description` | Yes      | One-sentence summary of what the skill does and when to use it. |

:::{admonition} Discoverability depends on the description
:class: tip
JupyterLite AI preloads skill names and descriptions into the system prompt so the model can pick the right skill without an explicit search. Write the `description` as a trigger: what the user is trying to do, not what the skill does internally.
:::

### Finding command IDs and argument shapes

JupyterGIS commands used from a skill are the same commands the UI fires. To find the right one:

- Browse the command catalog under `packages/base/src/commands/` in the source tree (for example [`BaseCommandIDs.ts`](https://github.com/geojupyter/jupytergis/blob/main/packages/base/src/commands/BaseCommandIDs.ts) and [`operationCommands.ts`](https://github.com/geojupyter/jupytergis/blob/main/packages/base/src/commands/operationCommands.ts)).
- Prefer the `*WithParams` commands (introduced in [#969](https://github.com/geojupyter/jupytergis/pull/969)) — they accept a structured `args` object and do not require opening a dialog, which is what makes them usable from a skill.
- Each `*WithParams` command declares its argument schema via `describedBy.args`. Copying that shape into the skill keeps the instructions grounded in the real command signature.

### Adding resource files

If a skill needs more than fits in `SKILL.md` — say a long reference document, a style template, or a snippet of Python — place the extra files next to `SKILL.md` and reference them from the instructions:

```
_agents/skills/
  add-osm-basemap/
    SKILL.md
    references/
      tile-providers.md
```

The agent can load these on demand through `load_skill` with a `resource` argument. This keeps the main skill short while still giving the model access to larger context when it actually needs it.

## Configuring the workspace

### JupyterLab

`_agents/skills/` works with no extra configuration. If you use the hidden `.agents/skills/` variant instead, allow hidden contents in your Jupyter server config:

```python
# jupyter_server_config.py
c.ContentsManager.allow_hidden = True
```

Make sure the server root directory is the workspace that contains the skills folder.

### JupyterLite

JupyterLite runs entirely in the browser, so there is no server-side config — skills are read from the browser filesystem or the bundled site content.

- `_agents/skills/` works out of the box. Create it from the file browser or bundle it into your JupyterLite build.
- To use `.agents/skills/`, enable hidden files in your `jupyter_lite_config.json`:

  ```json
  {
    "ContentsManager": {
      "allow_hidden": true
    }
  }
  ```

  Optionally show hidden files in the file browser via `overrides.json`:

  ```json
  {
    "@jupyterlab/filebrowser-extension:browser": {
      "showHiddenFiles": true
    }
  }
  ```

### Custom skill paths

To load skills from a different location (for example a shared `.claude/skills/` folder), open **Settings → Settings Editor**, search for **JupyterLite AI**, and edit the **Skills Paths** list. Earlier entries win when the same skill name appears twice.

## Sharing skills with a JupyterLite deployment

Skills bundled under `_agents/skills/` (or `.agents/skills/` with hidden files enabled) in a JupyterLite build become part of the deployed site, so visitors get the same JupyterGIS-aware chat behavior with no extra setup. This is a convenient way to ship a curated set of JupyterGIS skills alongside a [story map deployment](./story-maps.md).

## Security considerations

Skills are instructions the AI agent will follow verbatim when they activate. Before dropping a skill from an external source into your workspace:

- Read `SKILL.md` end-to-end — especially the body after the frontmatter.
- Check any bundled resource files; scripts or templates can contain arbitrary content.
- Be cautious with skills that execute code, modify files, or reach out to external services.

For the full specification and the programmatic registration API, see the [JupyterLite AI skills documentation](https://jupyterlite-ai.readthedocs.io/en/latest/skills/).
