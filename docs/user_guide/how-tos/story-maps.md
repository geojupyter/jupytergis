(how-to-story-map)=

# Create and Edit Story Maps

Story maps let you present a sequence of map views (segments) with optional text and images. This guide explains how to create a story, add and edit segments, use the Story Editor, and preview the story.

## Creating a story

A story is created when you add the first **Story Segment** layer:

1. Open the **Add Layer** menu from the toolbar.
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
