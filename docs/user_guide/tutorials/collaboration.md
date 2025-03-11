# Collaborative Features in JupyterGIS

Welcome to the JupyterGIS collaborative features tutorial. JupyterGIS enables seamless sharing of notebooks and GIS files, allowing teams—including GIS specialists, data analysts, and other experts—to work together on spatial projects in a shared environment. This guide will provide you with the tools and steps needed to collaborate effectively, using features like real-time editing, cursor tracking, follow mode, and annotations.

## Motivation

Collaboration is at the heart of effective GIS projects. Teams often include members with diverse backgrounds, skills, and areas of expertise. Without robust collaborative tools, it can become challenging to share insights, make real-time decisions, and maintain consistency across project workflows. JupyterGIS simplifies collaboration by providing real-time editing, annotations, and interactive features that allow teams to seamlessly integrate their work.

:::{admonition} Objectives
:class: seealso
By following this tutorial, you will be able to:

- Generate shareable links to invite collaborators.
- Work together on GIS files and notebooks with live updates.
- Use follow mode to monitor collaborator activities.
- Add annotations and comments to provide context, ask questions, or share insights.
  :::

:::{admonition} Prerequisites
:class: warning
Before beginning this tutorial, JupyterGIS must be installed on your computer (see [Installation instructions](https://jupytergis.readthedocs.io/en/latest/user_guide/install.html)) or you can use an online version of JupyterGIS. Currently, real-time collaboration is not supported in [JupyterLite](https://jupytergis.readthedocs.io/en/latest/lite/lab/index.html?path=france_hiking.jGIS/).
:::

---

## 1. Sharing Your Document

### 1.1. Create Your GIS File

- If you are using a local installation, run JupyterLab.

```
jupyter lab
```

- If you are using an online version, navigate to the JupyterGIS platform.
- In the JupyterLab Launcher, scroll down to the **Other** section.
- Click **GIS File** to open a blank canvas for your project.

![New GIS File](../../assets/images/tutorials/collaboration/new_gis_file.png)

- Notice that you are given an anonymous username, which you can see in the upper right corner. Every user in the project will be assigned an anonymous username.

![Username](../../assets/images/tutorials/collaboration/username.png)

### 1.2. Generate a Shareable Link

- Click on the **Share** button in your interface on the upper right corner, then click on the **Copy Link** button.
- Share this link with colleagues to invite them to your session.
- If you are using a local installation, you can open a new browser and paste the link to simulate a different user.

![Share](../../assets/images/tutorials/collaboration/share.png)

### 1.3. Confirm Collaborator Access

- When your colleagues join using the link, their usernames appear in the top right corner.
- This lets you know exactly who is working on the document.

![Shared Users](../../assets/images/tutorials/collaboration/shared_users.png)

---

## 2. Real-Time Collaboration on a GIS File

### 2.1. Adding and Editing Layers

- Open the layer panel and add a new layer to your GIS file.
- The new layer appears immediately for all collaborators in your session.
- Experiment by adjusting settings like opacity or color, each change is instantly visible to your collaborators.

![Add Layers](../../assets/images/tutorials/collaboration/add_layers.gif)

### 2.2. Tracking Collaborators with Cursors

- Each user's cursor appears on the document in the same color as their icon. This feature makes it easy to see where your teammates are focused on.
- Click on a cursor to display the location (latitude and longitude) where that user is working.

![Cursor](../../assets/images/tutorials/collaboration/cursor.png)

---

## 3. Using Follow Mode

Follow mode allows you to track another user’s activity in the document in real time. When enabled, you’ll see their actions as they navigate and edit. This feature is ideal for live demonstrations, interactive sessions, and collaborative meetings, as it lets you quickly align your view with a teammate’s actions and provide immediate feedback.

### 3.1. Activating Follow Mode

- Click on a collaborator's user icon in the upper right corner to activate follow mode. Observe that the document will then have a frame in their assigned color.
- Click on the user icon again to exit follow mode.

![Follow Mode](../../assets/images/tutorials/collaboration/follow_mode.gif)

```{exercise-start}
:label: enable-follow-mode
```

- Create a new collaborative JupyterGIS session.
- Share the link with a colleague. If you are using a local installation, you can open a new browser and paste the link to simulate a different user.
- From the layer browser, add OpenStreetMap.Mapnik to your GIS file.
- Ask your colleague to add the World Air Quality GeoJSON layer:

```
https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/openaq/exports/geojson.
```

- Locate your colleague's cursor on the document.
- Enable follow mode to track your colleague's actions.

```{exercise-end}

```

```{solution} enable-follow-mode
:class: dropdown

- Open a new GIS file in JupyterGIS. Click the **Share** button and copy the link. Send this to your colleague.
- In the layer browser, select **OpenStreetMap.Mapnik**.
- Your colleague can add the GeoJSON URL by clicking **+** → **New Vector Layer** → **Add GeoJSON Layer** → pasting the provided URL.
- You can find their cursor on the map.
- Click on your colleague's icon on the top right corner to activate **Follow Mode**. Your screen will follow their movements and edits in real-time.

```

---

## 4. Adding Annotations and Comments

Annotations and comments let you add notes directly on your GIS file, which makes it easier for your team to track important details, provide context, ask questions, or share insights.

### 4.1. Creating Annotations

- Right-click anywhere on your GIS file to open the context menu.
- Select **Add Annotation** from the menu. Observe that all collaborators can see the new annotation in real time.

### 4.2. Adding and Viewing Comments

- After adding an annotation, click on it to type your comment.
- Open the right sidebar to view all annotations and comments in the document.
- Click on the middle button to locate the annotation.

![Annotation](../../assets/images/tutorials/collaboration/annotation.gif)

```{exercise}
:label: add-annotations

- Add an annotation to your GIS file. Then add a comment to the annotation.
- Ask your colleague to locate the annotation and add a reply.
- Locate your colleague's reply from the right sidebar.

```

```{solution} add-annotations
:class: dropdown


- Right click on the desired location on your map.
- Choose **Add Annotation**, click on the annotation and enter your comment.
- Your colleague can see your annotation instantly; they can click it and reply.
- Open the annotations panel on the right sidebar to view their reply.

```

---

## 5. Collaborating on Notebooks

Real-time collaboration in notebooks is a powerful tool for teams working on code together. It enables multiple users to write, edit, and run code simultaneously. This feature is ideal for live coding sessions, debugging, and data analysis projects.

### 5.1. Accessing a Shared Notebook

- To create a notebook, click on the **+** icon to open the Launcher, then select one of the kernels under **Notebook**.

![Notebook](../../assets/images/tutorials/collaboration/create_notebook.png)

- Once a notebook is created, it is automatically accessible to all collaborators—no additional sharing is needed.
- To open a shared notebook, click on the explorer button in the left sidebar, then locate and click on the notebook.

![Notebook](../../assets/images/tutorials/collaboration/open_notebook.png)

- Anyone in the session can open, edit, and run the notebook.

### 5.2. Real-Time Code Collaboration

- As you write or execute code, every change is visible to your team instantly.
- Multiple users can write, edit, and run code in the same notebook at the same time for a dynamic, interactive coding experience.

![Notebook](../../assets/images/tutorials/collaboration/notebook.gif)

```{exercise}
:label: notebook-collaboration

- Create a new notebook and load your GIS document.
- Ask your colleague to open the notebook, write the code to remove the air quality layer of the GIS file and run the code cell.

```

````{solution} notebook-collaboration
:class: dropdown

- Create a new notebook from the JupyterLab launcher (select Python kernel).
- Load your GIS document using the following Python code:

```python
from jupytergis import GISDocument
doc = GISDocument("your_project_name.jGIS")
```
- Your colleague can add and execute the following code to list all layers:
```python
doc.layers
```
- Then they can find the air quality layer ID (the layer with the name Custom GeoJSON Layer) and remove it using:
```python
air_quality_layer_id = "your_layer_id"
doc.remove_layer(air_quality_layer_id)

````

---

Congratulations! You have completed the Collaboration Features of JupyerGIS tutorial. You now have the knowledge and tools to collaborate effectively with your team on GIS files and notebooks.

## Additional resources

- [JupyterGIS Blog Post](https://blog.jupyter.org/real-time-collaboration-and-collaborative-editing-for-gis-workflows-with-jupyter-and-qgis-d25dbe2832a6)
