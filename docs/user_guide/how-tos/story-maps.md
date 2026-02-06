(how-to-story-map)=

# Create and Edit Story Maps

<video controls width="700">
  <source src="https://github.com/user-attachments/assets/0bfac878-9915-4c04-82c0-361783f96628" type="video/mp4">
  Your browser does not support the video tag.
</video>

Story maps let you present a sequence of map views (segments) with optional text and images. This guide explains how to create a story, edit segments, use the Story Editor, and preview the story.

## Creating a story

A story is created when you add the first **Story Segment** layer:

1. Open the **+** menu from the toolbar.
2. Add **Story Segment**. The new layer captures the current map view (zoom and extent) and becomes the first segment of a new story map.
3. The right panel will show the **Story Editor** so you can set story-level options and add more segments.

If no story exists yet, the Story Editor panel shows an **Add Story Segment** button that does the same thing as the toolbar option.

## Story Editor

With the **Story Editor** tab selected in the right panel, you can:

- **Edit story-level properties**: Title, Story Type (guided or unguided), Presentation Background Color, and Presentation Text Color.

:::{admonition} Presentation Colors
:class: attention
The presentation colors are used only in the Specta view.
:::

:::{admonition} Story Types
:class: tip

- **Guided** stories advance with previous/next controls;
- **unguided** stories follow the selected segment in the layer list, so the viewer can jump to any segment by selecting it.
  :::

- **Add segments**: Click **Add Story Segment** at the bottom of the panel. Each new segment again captures the current map view and is appended to the story. You can then select it in the layer list and edit its properties (see below).

The Story Editor does not list or reorder segments directly; segment order follows the order of Story Segment layers in the **Segments** tab of the left panel.

## Adding segments

- **From the Story Editor**: Click **Add Story Segment** in the right panel. Position the map as desired before clicking; the new segment will use the current view.
- **From the Add Layer menu**: Add **Story Segment** as when creating the first segment. The new segment is added to the current story and uses the current map view.

After adding a segment, select it in the **Segments** tab to edit its properties in the **Object Properties** panel.

## Editing segment properties

Select a Story Segment layer in the left panel (under the **Segments** tab). The **Object Properties** panel shows that segment’s form:

- **Extent**: Use **Set Story Segment Extent** to snap the segment’s view to the current map extent and zoom. Helpful after panning/zooming to the area you want for that slide.
- **Segment Content**: Title, optional image URL, and markdown text for the narrative shown when that segment is active.
- **Transition**: Animation style and duration (in seconds) when moving to this segment.
  - **Immediate** jumps there with no animation.
  - **Linear** animates directly to the segment’s view.
  - **Smooth** zooms out, pans to the segment, then zooms back in.
- **Symbology Override**: Optional overrides for other layers when this segment is active (e.g. visibility, opacity, or opening the symbology dialog for a target layer to set style). Add an override by choosing a target layer and configuring the options.

Changes are saved as you edit; no separate “Save” step is required.

## Preview toggle

At the top of the Story panel (right panel, when the Story Editor tab is active) there is a **Preview Mode** switch.

- **Preview Mode off** (default): The panel shows the **Story Editor** (story-level form and **Add Story Segment**). Use this to create and edit the story and segment properties.
- **Preview Mode on**: The panel shows the **Story Map** viewer: the same step-through experience as in full presentation mode (previous/next, segment content, map updates), but still inside the main JupyterGIS window.

Use Preview Mode to check how the story will look and behave without entering full-screen presentation. The switch is hidden when you are already in presentation mode.

## Share story maps with a JupyterLite deployment

You can share a story map (or a whole JupyterGIS project) as a small, browser-only site so others can open it without installing anything or running a server. Use the [JupyterLite xeus-lite-demo template](https://github.com/jupyterlite/xeus-lite-demo) to create a deployment that includes JupyterGIS.

**Step 1: Create a repo from the template**

1. Open [xeus-lite-demo](https://github.com/jupyterlite/xeus-lite-demo) and click **Use this template**.
2. Choose a name (e.g. `my-story-map`) and create the repository.

**Step 2: Add JupyterGIS to the environment**

1. In your new repo, edit `environment.yml`.
2. Under `dependencies`, add `jupytergis-lite`. For example:

   ```yaml
   name: xeus-kernel
   channels:
     - https://repo.prefix.dev/emscripten-forge-dev
     - https://repo.prefix.dev/conda-forge
   dependencies:
     - xeus-python
     - jupytergis-lite
   ```

**Step 3: Add your story map and data**

1. Put your `.jGIS` file(s) and any other assets in the **content/** directory.
2. Those files will be available in the file browser when the Lite site runs.

:::{admonition} File paths and structure
:class: attention
If your story map or project references other files (e.g. GeoJSON, images, or raster sources), either keep the same folder structure inside **content/** as in your original project, or update the paths in the layer/source settings so they point to the correct locations in the Lite deployment.
:::

**Step 4: Enable GitHub Pages**

1. In the repo: **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. After the workflow finishes, the site will be at `https://<username>.github.io/<repo-name>/`. Open a `.jGIS` file there to view or present the story map.

**Step 5 (optional): Enable Specta**

[Specta](https://github.com/trungleduc/specta) with JupyterGIS is a full-screen story map presentation mode (minimal UI, previous/next navigation, segment content). To enable it in your JupyterLite deployment, add `specta` to the **dependencies** in `.github/build-environment.yml`, alongside the existing JupyterLite packages. For example:

```yaml
# .github/build-environment.yml
name: build-env
channels:
  - conda-forge
dependencies:
  - python
  - pip
  - jupyter_server
  - jupyterlite-core >=0.7
  - jupyterlite-xeus >=4.3
  - notebook >=7.5
  - specta
```

After the next build, opening a `.jGIS` file with a story map can use Specta for presentation. For a live example, see [Specta with a story map](https://geojupyter.github.io/jupytergis-specta/specta/?path=story_map_specta.jgis).

:::{admonition} Collaboration in JupyterLite
:class: note
Real-time collaboration is not supported in JupyterLite; the deployment is read-only for visitors. It is intended for sharing and presenting story maps, not for simultaneous editing.
:::

For more options (e.g. extra JupyterLite plugins), see the [xeus-lite-demo README](https://github.com/jupyterlite/xeus-lite-demo#-how-to-install-other-jupyterlite-plugins) and the [JupyterLite xeus environment docs](https://jupyterlite-xeus.readthedocs.io/en/latest/environment.html).
