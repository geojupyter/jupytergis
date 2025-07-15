# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## 0.6.1

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.6.0...d5a5451ae352fe06d1f90a5803275f47048b3036))

### Enhancements made

- Add 'New JupyterGIS Project' option to right-click context menu [#800](https://github.com/geojupyter/jupytergis/pull/800) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Ensure correct positioning of collaborator icons [#817](https://github.com/geojupyter/jupytergis/pull/817) ([@arjxn-py](https://github.com/arjxn-py))
- Fix collaborative follow mode [#812](https://github.com/geojupyter/jupytergis/pull/812) ([@mfisher87](https://github.com/mfisher87))
- Add remove button to STAC badges [#806](https://github.com/geojupyter/jupytergis/pull/806) ([@gjmooney](https://github.com/gjmooney))
- Remove STAC platform/product selections when no longer relevant [#805](https://github.com/geojupyter/jupytergis/pull/805) ([@gjmooney](https://github.com/gjmooney))

### Maintenance and upkeep improvements

- Indicate to user when running the JS and Python type generation build steps [#798](https://github.com/geojupyter/jupytergis/pull/798) ([@mfisher87](https://github.com/mfisher87))
- Move GeoJSON source schema to correct dir [#801](https://github.com/geojupyter/jupytergis/pull/801) ([@mfisher87](https://github.com/mfisher87))

### Documentation improvements

- Add code generation documentation [#807](https://github.com/geojupyter/jupytergis/pull/807) ([@mfisher87](https://github.com/mfisher87))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-07-02&to=2025-07-15&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-07-02..2025-07-15&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-07-02..2025-07-15&type=Issues) | [@HaudinFlorence](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AHaudinFlorence+updated%3A2025-07-02..2025-07-15&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-07-02..2025-07-15&type=Issues)

<!-- <END NEW CHANGELOG ENTRY> -->

## 0.6.0

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.5.0...89fd8fb7cc101629f546ea1617590633287b4454))

### Enhancements made

- Increased the width of main-panel in notebook viewer [#787](https://github.com/geojupyter/jupytergis/pull/787) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- Add OpenLayers fullscreen control to map [#764](https://github.com/geojupyter/jupytergis/pull/764) ([@mfisher87](https://github.com/mfisher87))
- Refactor of processing logic to make it less verbose. [#758](https://github.com/geojupyter/jupytergis/pull/758) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- GEODES STAC API Search [#753](https://github.com/geojupyter/jupytergis/pull/753) ([@gjmooney](https://github.com/gjmooney))
- Create shared components [#749](https://github.com/geojupyter/jupytergis/pull/749) ([@gjmooney](https://github.com/gjmooney))
- Enhance proxy [#748](https://github.com/geojupyter/jupytergis/pull/748) ([@gjmooney](https://github.com/gjmooney))
- Processing: Bounding boxes of a vector layer(#734) [#744](https://github.com/geojupyter/jupytergis/pull/744) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- Processing : Centroids of a vector layer [#740](https://github.com/geojupyter/jupytergis/pull/740) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- Multiband symbology: support alpha channel & Fix band offset bug [#718](https://github.com/geojupyter/jupytergis/pull/718) ([@arjxn-py](https://github.com/arjxn-py))
- Enable Python API to add geojson layer with remote url [#715](https://github.com/geojupyter/jupytergis/pull/715) ([@arjxn-py](https://github.com/arjxn-py))
- Refactor vector symbology: Configure radius and color separately [#714](https://github.com/geojupyter/jupytergis/pull/714) ([@arjxn-py](https://github.com/arjxn-py))
- Support coloring vector features by an attribute containing a hex color code [#713](https://github.com/geojupyter/jupytergis/pull/713) ([@mfisher87](https://github.com/mfisher87))
- Auto-save project when updating any property [#708](https://github.com/geojupyter/jupytergis/pull/708) ([@arjxn-py](https://github.com/arjxn-py))
- Simplify Symbology of Vectors [#672](https://github.com/geojupyter/jupytergis/pull/672) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Pin proj4js >=2.19.3 [#778](https://github.com/geojupyter/jupytergis/pull/778) ([@mfisher87](https://github.com/mfisher87))
- Fix LayoutRestorer entries [#743](https://github.com/geojupyter/jupytergis/pull/743) ([@martinRenou](https://github.com/martinRenou))
- Fix file rename in side panels [#736](https://github.com/geojupyter/jupytergis/pull/736) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- Fix blank menu after selecting heatmap [#707](https://github.com/geojupyter/jupytergis/pull/707) ([@arjxn-py](https://github.com/arjxn-py))
- Support Symbology on VectorTileLayers [#703](https://github.com/geojupyter/jupytergis/pull/703) ([@arjxn-py](https://github.com/arjxn-py))
- SymbologyPanel: Eliminate need to re-classify when changing between "radius" and "color" methods [#700](https://github.com/geojupyter/jupytergis/pull/700) ([@arjxn-py](https://github.com/arjxn-py))
- Prevent duplication of color steps when reopening the symbology panel [#697](https://github.com/geojupyter/jupytergis/pull/697) ([@arjxn-py](https://github.com/arjxn-py))
- Don't Save annotation as stringified json [#637](https://github.com/geojupyter/jupytergis/pull/637) ([@arjxn-py](https://github.com/arjxn-py))

### Maintenance and upkeep improvements

- Bump dawidd6/action-download-artifact from 10 to 11 in the gha-dependencies group [#794](https://github.com/geojupyter/jupytergis/pull/794) ([@dependabot](https://github.com/dependabot))
- Add React component type annotations [#791](https://github.com/geojupyter/jupytergis/pull/791) ([@mfisher87](https://github.com/mfisher87))
- Add more explicit typing on RJSF objects [#789](https://github.com/geojupyter/jupytergis/pull/789) ([@mfisher87](https://github.com/mfisher87))
- Improve file naming consistency of schemas [#786](https://github.com/geojupyter/jupytergis/pull/786) ([@mfisher87](https://github.com/mfisher87))
- Use latest version of xeus for docs build [#771](https://github.com/geojupyter/jupytergis/pull/771) ([@Gauss-Taylor-Euler](https://github.com/Gauss-Taylor-Euler))
- Extract loading spinners to shared components [#769](https://github.com/geojupyter/jupytergis/pull/769) ([@mfisher87](https://github.com/mfisher87))
- Rename `generateScene()` -> `generateMap()` [#762](https://github.com/geojupyter/jupytergis/pull/762) ([@HaudinFlorence](https://github.com/HaudinFlorence))
- Refactor vector symbology menus: drive logic with data structure [#752](https://github.com/geojupyter/jupytergis/pull/752) ([@mfisher87](https://github.com/mfisher87))
- new feature request template [#746](https://github.com/geojupyter/jupytergis/pull/746) ([@MMesch](https://github.com/MMesch))
- Update prettier config to always use trailing commas [#731](https://github.com/geojupyter/jupytergis/pull/731) ([@mfisher87](https://github.com/mfisher87))
- Consistently sort and group all TS imports [#730](https://github.com/geojupyter/jupytergis/pull/730) ([@mfisher87](https://github.com/mfisher87))
- Support importing from path alias `@` [#728](https://github.com/geojupyter/jupytergis/pull/728) ([@mfisher87](https://github.com/mfisher87))
- Bump dawidd6/action-download-artifact from 9 to 10 in the gha-dependencies group [#726](https://github.com/geojupyter/jupytergis/pull/726) ([@dependabot](https://github.com/dependabot))
- Remove UsersItem component and use the one from `@jupyter/collaboration` [#723](https://github.com/geojupyter/jupytergis/pull/723) ([@arjxn-py](https://github.com/arjxn-py))

### Documentation improvements

- Make install docs more readable with tabs [#790](https://github.com/geojupyter/jupytergis/pull/790) ([@mfisher87](https://github.com/mfisher87))
- Minor typo fix "you can you" -> "you can use" [#779](https://github.com/geojupyter/jupytergis/pull/779) ([@tylere](https://github.com/tylere))
- Update releasing docs [#684](https://github.com/geojupyter/jupytergis/pull/684) ([@mfisher87](https://github.com/mfisher87))
- Add architecture docs [#576](https://github.com/geojupyter/jupytergis/pull/576) ([@mfisher87](https://github.com/mfisher87))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-05-08&to=2025-07-02&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-05-08..2025-07-02&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adependabot+updated%3A2025-05-08..2025-07-02&type=Issues) | [@Gauss-Taylor-Euler](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AGauss-Taylor-Euler+updated%3A2025-05-08..2025-07-02&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-05-08..2025-07-02&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-05-08..2025-07-02&type=Issues) | [@HaudinFlorence](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AHaudinFlorence+updated%3A2025-05-08..2025-07-02&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-05-08..2025-07-02&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-05-08..2025-07-02&type=Issues) | [@MMesch](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AMMesch+updated%3A2025-05-08..2025-07-02&type=Issues) | [@SylvainCorlay](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3ASylvainCorlay+updated%3A2025-05-08..2025-07-02&type=Issues) | [@trungleduc](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Atrungleduc+updated%3A2025-05-08..2025-07-02&type=Issues) | [@tylere](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Atylere+updated%3A2025-05-08..2025-07-02&type=Issues)

## 0.5.0

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.5...5b440ca10f1eec6fbe000aee08b889580f9c8b2d))

### Enhancements made

- Make "add layer" menus more consistent [#681](https://github.com/geojupyter/jupytergis/pull/681) ([@mfisher87](https://github.com/mfisher87))
- Make the toolbar console button a toggle button [#676](https://github.com/geojupyter/jupytergis/pull/676) ([@HaudinFlorence](https://github.com/HaudinFlorence))
- Remove "sources" panel [#671](https://github.com/geojupyter/jupytergis/pull/671) ([@arjxn-py](https://github.com/arjxn-py))
- Remove source automatically when removing layer [#670](https://github.com/geojupyter/jupytergis/pull/670) ([@arjxn-py](https://github.com/arjxn-py))
- Make collaborator cursors more prominent [#668](https://github.com/geojupyter/jupytergis/pull/668) ([@mfisher87](https://github.com/mfisher87))
- Record JupyterGIS schema version in `.jGIS` project files [#663](https://github.com/geojupyter/jupytergis/pull/663) ([@arjxn-py](https://github.com/arjxn-py))
- Enable setting CORS proxy URL in settings editor [#619](https://github.com/geojupyter/jupytergis/pull/619) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Fix mistakes in explorer basemap names [#680](https://github.com/geojupyter/jupytergis/pull/680) ([@mfisher87](https://github.com/mfisher87))

### Maintenance and upkeep improvements

- Add issue templates: experience report, bug, docs, blank issue [#679](https://github.com/geojupyter/jupytergis/pull/679) ([@mfisher87](https://github.com/mfisher87))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-04-25&to=2025-05-08&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-04-25..2025-05-08&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2025-04-25..2025-05-08&type=Issues) | [@HaudinFlorence](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AHaudinFlorence+updated%3A2025-04-25..2025-05-08&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-04-25..2025-05-08&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-04-25..2025-05-08&type=Issues)

## 0.4.5

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.4...f0e42dbe3e0e4694ee733714794070ff3d471c3e))

### Enhancements made

- Allow initializing a `GISDocument` that has a path [#666](https://github.com/geojupyter/jupytergis/pull/666) ([@davidbrochart](https://github.com/davidbrochart))
- Allow passing source ID [#660](https://github.com/geojupyter/jupytergis/pull/660) ([@davidbrochart](https://github.com/davidbrochart))
- Indicate the point being identified on GeoTiFF [#659](https://github.com/geojupyter/jupytergis/pull/659) ([@arjxn-py](https://github.com/arjxn-py))
- Some fixes in Annotation UX [#650](https://github.com/geojupyter/jupytergis/pull/650) ([@arjxn-py](https://github.com/arjxn-py))
- Interactive Identify Panel [#649](https://github.com/geojupyter/jupytergis/pull/649) ([@arjxn-py](https://github.com/arjxn-py))
- Fill vertical space in linked output & sidecar views [#643](https://github.com/geojupyter/jupytergis/pull/643) ([@SylvainCorlay](https://github.com/SylvainCorlay))
- Improved Annotation UX [#640](https://github.com/geojupyter/jupytergis/pull/640) ([@arjxn-py](https://github.com/arjxn-py))
- Use svg icons for the main view toolbar [#627](https://github.com/geojupyter/jupytergis/pull/627) ([@HaudinFlorence](https://github.com/HaudinFlorence))
- New toolbar button: Center on user's geolocation [#626](https://github.com/geojupyter/jupytergis/pull/626) ([@HaudinFlorence](https://github.com/HaudinFlorence))
- Add scrollbar to the identify panel [#614](https://github.com/geojupyter/jupytergis/pull/614) ([@arjxn-py](https://github.com/arjxn-py))
- Add `explore()` function and `GISDocument.sidecar()` method [#340](https://github.com/geojupyter/jupytergis/pull/340) ([@mfisher87](https://github.com/mfisher87))

### Bugs fixed

- Initialize map view from model's lat/lon/zoom [#665](https://github.com/geojupyter/jupytergis/pull/665) ([@davidbrochart](https://github.com/davidbrochart))
- Alphabetically sort feature properties in IdentifyPanel [#658](https://github.com/geojupyter/jupytergis/pull/658) ([@arjxn-py](https://github.com/arjxn-py))
- Some fixes in Annotation UX [#650](https://github.com/geojupyter/jupytergis/pull/650) ([@arjxn-py](https://github.com/arjxn-py))
- Try fixing layer browser ui-tests [#636](https://github.com/geojupyter/jupytergis/pull/636) ([@arjxn-py](https://github.com/arjxn-py))
- Try fixing notebook on lite by pinning `my-jupyter-shared-drive<0.2.0` [#635](https://github.com/geojupyter/jupytergis/pull/635) ([@arjxn-py](https://github.com/arjxn-py))

### Maintenance and upkeep improvements

- Try fixing layer browser ui-tests [#636](https://github.com/geojupyter/jupytergis/pull/636) ([@arjxn-py](https://github.com/arjxn-py))
- Try fixing notebook on lite by pinning `my-jupyter-shared-drive<0.2.0` [#635](https://github.com/geojupyter/jupytergis/pull/635) ([@arjxn-py](https://github.com/arjxn-py))

### Documentation improvements

- Remove work-in-progress warning from README [#633](https://github.com/geojupyter/jupytergis/pull/633) ([@arjxn-py](https://github.com/arjxn-py))
- Document how to run tests locally (and when you shouldn't) [#632](https://github.com/geojupyter/jupytergis/pull/632) ([@mfisher87](https://github.com/mfisher87))
- Add contributor how-to: Editing commands [#621](https://github.com/geojupyter/jupytergis/pull/621) ([@mfisher87](https://github.com/mfisher87))
- Fix tabs rendering in Contributor Guide [#617](https://github.com/geojupyter/jupytergis/pull/617) ([@pblottiere](https://github.com/pblottiere))
- Add collaborative session creation guide [#608](https://github.com/geojupyter/jupytergis/pull/608) ([@elifsu-simula](https://github.com/elifsu-simula))
- Add contributor how-to: Editing keybindings [#586](https://github.com/geojupyter/jupytergis/pull/586) ([@mfisher87](https://github.com/mfisher87))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-04-08&to=2025-04-25&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-04-08..2025-04-25&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2025-04-08..2025-04-25&type=Issues) | [@davidbrochart](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adavidbrochart+updated%3A2025-04-08..2025-04-25&type=Issues) | [@elifsu-simula](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aelifsu-simula+updated%3A2025-04-08..2025-04-25&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-04-08..2025-04-25&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-04-08..2025-04-25&type=Issues) | [@HaudinFlorence](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AHaudinFlorence+updated%3A2025-04-08..2025-04-25&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-04-08..2025-04-25&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-04-08..2025-04-25&type=Issues) | [@pblottiere](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Apblottiere+updated%3A2025-04-08..2025-04-25&type=Issues) | [@pre-commit-ci](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Apre-commit-ci+updated%3A2025-04-08..2025-04-25&type=Issues) | [@SylvainCorlay](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3ASylvainCorlay+updated%3A2025-04-08..2025-04-25&type=Issues)

## 0.4.4

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.3...270a3b5cbae99d6f85043430e9110f9826a26ae1))

### Bugs fixed

- Pin docprovider [#615](https://github.com/geojupyter/jupytergis/pull/615) ([@martinRenou](https://github.com/martinRenou))
- Use Accel I temporarily [#611](https://github.com/geojupyter/jupytergis/pull/611) ([@arjxn-py](https://github.com/arjxn-py))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-04-07&to=2025-04-08&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-04-07..2025-04-08&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-04-07..2025-04-08&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-04-07..2025-04-08&type=Issues)

## 0.4.3

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.2...10924070d7cd747006448a424e3cc128fd04683e))

### Enhancements made

- Add `save_as()` method to GISDocument API [#595](https://github.com/geojupyter/jupytergis/pull/595) ([@mfisher87](https://github.com/mfisher87))
- Processing: Option to save output layer by the side [#589](https://github.com/geojupyter/jupytergis/pull/589) ([@arjxn-py](https://github.com/arjxn-py))
- Feat:- Adding key shortcut i to identity [#581](https://github.com/geojupyter/jupytergis/pull/581) ([@nakul-py](https://github.com/nakul-py))
- Refactor Processing Logic to make it modular [#578](https://github.com/geojupyter/jupytergis/pull/578) ([@arjxn-py](https://github.com/arjxn-py))
- Make Output Layer name configurable for processing [#573](https://github.com/geojupyter/jupytergis/pull/573) ([@arjxn-py](https://github.com/arjxn-py))
- Restore local geotiff file support [#571](https://github.com/geojupyter/jupytergis/pull/571) ([@arjxn-py](https://github.com/arjxn-py))
- Remove reprojection from buffer operation [#563](https://github.com/geojupyter/jupytergis/pull/563) ([@mfisher87](https://github.com/mfisher87))
- Disable identify tool when we can't identify [#553](https://github.com/geojupyter/jupytergis/pull/553) ([@martinRenou](https://github.com/martinRenou))
- Processing: Add `Dissolve` Command & A better Form structure for Processing Commands [#550](https://github.com/geojupyter/jupytergis/pull/550) ([@arjxn-py](https://github.com/arjxn-py))
- Explicit buffer processing distance unit [#529](https://github.com/geojupyter/jupytergis/pull/529) ([@martinRenou](https://github.com/martinRenou))
- Enable downloading a vectorlayer [#528](https://github.com/geojupyter/jupytergis/pull/528) ([@arjxn-py](https://github.com/arjxn-py))
- Add new user-facing interpolate source property [#522](https://github.com/geojupyter/jupytergis/pull/522) ([@mfisher87](https://github.com/mfisher87))
- Processing PoC - Buffer [#510](https://github.com/geojupyter/jupytergis/pull/510) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Enable adding annotations on QGZ files [#607](https://github.com/geojupyter/jupytergis/pull/607) ([@arjxn-py](https://github.com/arjxn-py))
- Fix pointer to show correct updated location [#606](https://github.com/geojupyter/jupytergis/pull/606) ([@arjxn-py](https://github.com/arjxn-py))
- Use only relevant selectors for keybindings to prevent conflicts [#603](https://github.com/geojupyter/jupytergis/pull/603) ([@arjxn-py](https://github.com/arjxn-py))
- Temporarily change identify keybinding to "Accel+I" to work around bug #592 [#600](https://github.com/geojupyter/jupytergis/pull/600) ([@mfisher87](https://github.com/mfisher87))

### Maintenance and upkeep improvements

- Add documentation build script, fix build warning, and update docs on building docs [#584](https://github.com/geojupyter/jupytergis/pull/584) ([@mfisher87](https://github.com/mfisher87))
- Refactor Processing Logic to make it modular [#578](https://github.com/geojupyter/jupytergis/pull/578) ([@arjxn-py](https://github.com/arjxn-py))
- Organise forms [#572](https://github.com/geojupyter/jupytergis/pull/572) ([@arjxn-py](https://github.com/arjxn-py))
- Update lockfile [#568](https://github.com/geojupyter/jupytergis/pull/568) ([@arjxn-py](https://github.com/arjxn-py))
- Resolve dependabot security alert for `axios` [#565](https://github.com/geojupyter/jupytergis/pull/565) ([@dependabot](https://github.com/dependabot))
- Enable ruff's bugbear "B" ruleset [#562](https://github.com/geojupyter/jupytergis/pull/562) ([@mfisher87](https://github.com/mfisher87))
- organise `schema/` [#542](https://github.com/geojupyter/jupytergis/pull/542) ([@arjxn-py](https://github.com/arjxn-py))

### Documentation improvements

- Add documentation build script, fix build warning, and update docs on building docs [#584](https://github.com/geojupyter/jupytergis/pull/584) ([@mfisher87](https://github.com/mfisher87))
- Convert docs rst to myst [#570](https://github.com/geojupyter/jupytergis/pull/570) ([@kpdavi](https://github.com/kpdavi))
- Fix docs build warning: Adjust documentation headings to start at H1 [#566](https://github.com/geojupyter/jupytergis/pull/566) ([@mfisher87](https://github.com/mfisher87))
- Create requirements-docs.md for building local docs workflow [#557](https://github.com/geojupyter/jupytergis/pull/557) ([@YaoTingYao](https://github.com/YaoTingYao))
- Fix API doc build [#556](https://github.com/geojupyter/jupytergis/pull/556) ([@mfisher87](https://github.com/mfisher87))
- Add quickstart to installation doc [#555](https://github.com/geojupyter/jupytergis/pull/555) ([@mfisher87](https://github.com/mfisher87))
- Docs: upgrading micromamba [#543](https://github.com/geojupyter/jupytergis/pull/543) ([@martinRenou](https://github.com/martinRenou))
- Add a tutorial for collaborative features [#530](https://github.com/geojupyter/jupytergis/pull/530) ([@elifsu-simula](https://github.com/elifsu-simula))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-03-06&to=2025-04-07&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-03-06..2025-04-07&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adependabot+updated%3A2025-03-06..2025-04-07&type=Issues) | [@elifsu-simula](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aelifsu-simula+updated%3A2025-03-06..2025-04-07&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-03-06..2025-04-07&type=Issues) | [@kpdavi](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Akpdavi+updated%3A2025-03-06..2025-04-07&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-03-06..2025-04-07&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-03-06..2025-04-07&type=Issues) | [@nakul-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Anakul-py+updated%3A2025-03-06..2025-04-07&type=Issues) | [@YaoTingYao](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AYaoTingYao+updated%3A2025-03-06..2025-04-07&type=Issues)

## 0.4.2

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.1...4978e892b2d8deaa59a9d9cc515d98d6126b504e))

### Bugs fixed

- Fix releaser for publishing jupytergis-lite [#524](https://github.com/geojupyter/jupytergis/pull/524) ([@martinRenou](https://github.com/martinRenou))
- Move layer visibility toggle to the left of the layer title and icon [#487](https://github.com/geojupyter/jupytergis/pull/487) ([@mfisher87](https://github.com/mfisher87))

### Maintenance and upkeep improvements

- Bump the gha-dependencies group with 3 updates [#512](https://github.com/geojupyter/jupytergis/pull/512) ([@dependabot](https://github.com/dependabot))

### Documentation improvements

- Removing misleading comment [#511](https://github.com/geojupyter/jupytergis/pull/511) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-02-27&to=2025-03-06&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-02-27..2025-03-06&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adependabot+updated%3A2025-02-27..2025-03-06&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-02-27..2025-03-06&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-02-27..2025-03-06&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-02-27..2025-03-06&type=Issues)

## 0.4.1

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.4.0...8a87ee1f424e09578a372b89d0848d2a1ddea921))

### Enhancements made

- Gallery: Add ESRI maps [#508](https://github.com/geojupyter/jupytergis/pull/508) ([@martinRenou](https://github.com/martinRenou))
- Disable smoothing on all raster sources [#485](https://github.com/geojupyter/jupytergis/pull/485) ([@mfisher87](https://github.com/mfisher87))
- Add `remove_layer` method to Python `GISDocument` API [#478](https://github.com/geojupyter/jupytergis/pull/478) ([@mfisher87](https://github.com/mfisher87))

### Bugs fixed

- Fix to vector colors notebook [#507](https://github.com/geojupyter/jupytergis/pull/507) ([@arjxn-py](https://github.com/arjxn-py))
- Fix examples in JupyterLite [#506](https://github.com/geojupyter/jupytergis/pull/506) ([@martinRenou](https://github.com/martinRenou))
- Fix COG performances [#503](https://github.com/geojupyter/jupytergis/pull/503) ([@martinRenou](https://github.com/martinRenou))
- Put commandRegistry back in consoleOptions [#499](https://github.com/geojupyter/jupytergis/pull/499) ([@gjmooney](https://github.com/gjmooney))
- Fix "Try it with JupyterLite" button in user guide [#470](https://github.com/geojupyter/jupytergis/pull/470) ([@mfisher87](https://github.com/mfisher87))
- Lazy import jupyter_server [#465](https://github.com/geojupyter/jupytergis/pull/465) ([@martinRenou](https://github.com/martinRenou))
- Fix bump script for jupytergis-lite [#464](https://github.com/geojupyter/jupytergis/pull/464) ([@martinRenou](https://github.com/martinRenou))

### Maintenance and upkeep improvements

- Use `dist/` while using lite-artifacts [#491](https://github.com/geojupyter/jupytergis/pull/491) ([@arjxn-py](https://github.com/arjxn-py))
- Separate bot for lite snapshots update [#490](https://github.com/geojupyter/jupytergis/pull/490) ([@arjxn-py](https://github.com/arjxn-py))
- Configure ui-tests for lite deployment [#489](https://github.com/geojupyter/jupytergis/pull/489) ([@arjxn-py](https://github.com/arjxn-py))
- Install JupyterGIS metapackage in Update snapshots workflow [#477](https://github.com/geojupyter/jupytergis/pull/477) ([@arjxn-py](https://github.com/arjxn-py))

### Documentation improvements

- Update README screenshot [#482](https://github.com/geojupyter/jupytergis/pull/482) ([@martinRenou](https://github.com/martinRenou))
- Update `image.jGIS` and file handling logic to load correctly [#481](https://github.com/geojupyter/jupytergis/pull/481) ([@arjxn-py](https://github.com/arjxn-py))
- Convert the Troubleshooting document to MyST [#479](https://github.com/geojupyter/jupytergis/pull/479) ([@jmarokhovsky](https://github.com/jmarokhovsky))
- Update user guide tutorial [#475](https://github.com/geojupyter/jupytergis/pull/475) ([@elifsu-simula](https://github.com/elifsu-simula))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-02-13&to=2025-02-27&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-02-13..2025-02-27&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2025-02-13..2025-02-27&type=Issues) | [@elifsu-simula](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aelifsu-simula+updated%3A2025-02-13..2025-02-27&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-02-13..2025-02-27&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-02-13..2025-02-27&type=Issues) | [@jmarokhovsky](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Ajmarokhovsky+updated%3A2025-02-13..2025-02-27&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-02-13..2025-02-27&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-02-13..2025-02-27&type=Issues)

## 0.4.0

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.3.0...142a554f57d7d7ccf1c960d82432f78ea69f3e39))

### Enhancements made

- fix #418 path validation of shapefiles [#453](https://github.com/geojupyter/jupytergis/pull/453) ([@annefou](https://github.com/annefou))
- Add jupytergis-lite metapackage [#451](https://github.com/geojupyter/jupytergis/pull/451) ([@martinRenou](https://github.com/martinRenou))
- Import VectorLayer from QGIS [#424](https://github.com/geojupyter/jupytergis/pull/424) ([@arjxn-py](https://github.com/arjxn-py))
- Time slider [#421](https://github.com/geojupyter/jupytergis/pull/421) ([@gjmooney](https://github.com/gjmooney))
- Widget with toolbar and sidepanel in cell output [#419](https://github.com/geojupyter/jupytergis/pull/419) ([@brichet](https://github.com/brichet))
- Enable Python API in the JupyterLite deployment [#412](https://github.com/geojupyter/jupytergis/pull/412) ([@davidbrochart](https://github.com/davidbrochart))
- Rework add layer toolbar menu [#410](https://github.com/geojupyter/jupytergis/pull/410) ([@gjmooney](https://github.com/gjmooney))
- Add error handling [#391](https://github.com/geojupyter/jupytergis/pull/391) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Support exporting vectorLayer to qgis [#390](https://github.com/geojupyter/jupytergis/pull/390) ([@arjxn-py](https://github.com/arjxn-py))
- Add local file support for `GeoTiff` [#385](https://github.com/geojupyter/jupytergis/pull/385) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Add Heatmap layer [#384](https://github.com/geojupyter/jupytergis/pull/384) ([@gjmooney](https://github.com/gjmooney))
- Support path lib objects [#378](https://github.com/geojupyter/jupytergis/pull/378) ([@gjmooney](https://github.com/gjmooney))
- Extend caching for image, geoJSON & shapeFiles [#339](https://github.com/geojupyter/jupytergis/pull/339) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Pin meta-package dependencies [#460](https://github.com/geojupyter/jupytergis/pull/460) ([@gjmooney](https://github.com/gjmooney))
- Use symlink for readme for pypi [#458](https://github.com/geojupyter/jupytergis/pull/458) ([@gjmooney](https://github.com/gjmooney))
- Fix collab view bug [#450](https://github.com/geojupyter/jupytergis/pull/450) ([@gjmooney](https://github.com/gjmooney))
- Fix a typo in gis_document.py [#448](https://github.com/geojupyter/jupytergis/pull/448) ([@brichet](https://github.com/brichet))
- Fix slider sync issue [#443](https://github.com/geojupyter/jupytergis/pull/443) ([@gjmooney](https://github.com/gjmooney))
- Fix categorized symbology [#430](https://github.com/geojupyter/jupytergis/pull/430) ([@gjmooney](https://github.com/gjmooney))
- Replace input field for selected file path with text [#417](https://github.com/geojupyter/jupytergis/pull/417) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Fix scale indicator in notebooks and symbology overflow [#408](https://github.com/geojupyter/jupytergis/pull/408) ([@gjmooney](https://github.com/gjmooney))
- Create a new file from the Python API [#402](https://github.com/geojupyter/jupytergis/pull/402) ([@brichet](https://github.com/brichet))
- Add optional-chaining check for `symbologyState` [#383](https://github.com/geojupyter/jupytergis/pull/383) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Proper Styling Added for OK Button [#379](https://github.com/geojupyter/jupytergis/pull/379) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Support path lib objects [#378](https://github.com/geojupyter/jupytergis/pull/378) ([@gjmooney](https://github.com/gjmooney))

### Maintenance and upkeep improvements

- Continue installing the labextension in the dev install script [#463](https://github.com/geojupyter/jupytergis/pull/463) ([@arjxn-py](https://github.com/arjxn-py))
- Updating version of proj4-list [#459](https://github.com/geojupyter/jupytergis/pull/459) ([@josueggh](https://github.com/josueggh))
- Bump yjs-widgets to >=0.3.9 [#449](https://github.com/geojupyter/jupytergis/pull/449) ([@brichet](https://github.com/brichet))
- Replace broken shapefile from ui tests [#442](https://github.com/geojupyter/jupytergis/pull/442) ([@arjxn-py](https://github.com/arjxn-py))
- Fix link to contribution docs [#440](https://github.com/geojupyter/jupytergis/pull/440) ([@martinRenou](https://github.com/martinRenou))
- Remove test to expect warning on vectorLayer export [#423](https://github.com/geojupyter/jupytergis/pull/423) ([@arjxn-py](https://github.com/arjxn-py))
- Bump dawidd6/action-download-artifact from 7 to 8 in the gha-dependencies group [#422](https://github.com/geojupyter/jupytergis/pull/422) ([@dependabot](https://github.com/dependabot))
- Remove source layer stuff [#413](https://github.com/geojupyter/jupytergis/pull/413) ([@gjmooney](https://github.com/gjmooney))
- Upgrade jupyter-ydoc python to match the npm version [#409](https://github.com/geojupyter/jupytergis/pull/409) ([@brichet](https://github.com/brichet))
- Fix shared document interface [#406](https://github.com/geojupyter/jupytergis/pull/406) ([@brichet](https://github.com/brichet))
- Fix name typo `notebookRenderePlugin` -> `notebookRendererPlugin` [#400](https://github.com/geojupyter/jupytergis/pull/400) ([@mfisher87](https://github.com/mfisher87))
- Move jupyterlab dependency from jupytergis_lab to jupytergis [#382](https://github.com/geojupyter/jupytergis/pull/382) ([@davidbrochart](https://github.com/davidbrochart))

### Documentation improvements

- Add Docker install instructions [#446](https://github.com/geojupyter/jupytergis/pull/446) ([@mfisher87](https://github.com/mfisher87))
- Fix link to contribution docs [#440](https://github.com/geojupyter/jupytergis/pull/440) ([@martinRenou](https://github.com/martinRenou))
- Re-organize docs navigation and add releasing guide [#428](https://github.com/geojupyter/jupytergis/pull/428) ([@mfisher87](https://github.com/mfisher87))
- added simple tutorial to introduce the jupyterGIS GUI. [#393](https://github.com/geojupyter/jupytergis/pull/393) ([@annefou](https://github.com/annefou))
- Restore rich Sphinx contributing doc, link from GitHub-Markdown doc [#392](https://github.com/geojupyter/jupytergis/pull/392) ([@mfisher87](https://github.com/mfisher87))
- Remove Duplicate CONTRIBUTING.md and add CHANGELOG to docs [#381](https://github.com/geojupyter/jupytergis/pull/381) ([@arjxn-py](https://github.com/arjxn-py))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-01-21&to=2025-02-13&type=c))

[@annefou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aannefou+updated%3A2025-01-21..2025-02-13&type=Issues) | [@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-01-21..2025-02-13&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2025-01-21..2025-02-13&type=Issues) | [@davidbrochart](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adavidbrochart+updated%3A2025-01-21..2025-02-13&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adependabot+updated%3A2025-01-21..2025-02-13&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-01-21..2025-02-13&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-01-21..2025-02-13&type=Issues) | [@josueggh](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Ajosueggh+updated%3A2025-01-21..2025-02-13&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-01-21..2025-02-13&type=Issues) | [@Meriem-BenIsmail](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AMeriem-BenIsmail+updated%3A2025-01-21..2025-02-13&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-01-21..2025-02-13&type=Issues)

## 0.3.0

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.2.1...5e05c1a0c7e0c373ebbcb8dd5c84e52899e4a680))

### Enhancements made

- Use `interpolate` property to Disable Image Smoothing for `ImageLayers` [#373](https://github.com/geojupyter/jupytergis/pull/373) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Add numerical input next to the slider and handle value 1-10 [#365](https://github.com/geojupyter/jupytergis/pull/365) ([@arjxn-py](https://github.com/arjxn-py))
- Add Path Validation for `ShapefileSource` and `ImageSource`. [#362](https://github.com/geojupyter/jupytergis/pull/362) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Multi band symbology [#360](https://github.com/geojupyter/jupytergis/pull/360) ([@gjmooney](https://github.com/gjmooney))
- Add Proper Styling to Symbology panel's "mode" [#354](https://github.com/geojupyter/jupytergis/pull/354) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Add status bar to map [#348](https://github.com/geojupyter/jupytergis/pull/348) ([@gjmooney](https://github.com/gjmooney))
- Move jupyter-collaboration dependency to jupytergis [#347](https://github.com/geojupyter/jupytergis/pull/347) ([@davidbrochart](https://github.com/davidbrochart))
- QGIS logo added for `.qgz` files [#337](https://github.com/geojupyter/jupytergis/pull/337) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Create layers by path or external URL with separate fields [#335](https://github.com/geojupyter/jupytergis/pull/335) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- visibility icon turns white when layer selected. [#330](https://github.com/geojupyter/jupytergis/pull/330) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Give some padding to the headings in editForm [#329](https://github.com/geojupyter/jupytergis/pull/329) ([@arjxn-py](https://github.com/arjxn-py))
- Use slider to set opacity in layer form [#325](https://github.com/geojupyter/jupytergis/pull/325) ([@arjxn-py](https://github.com/arjxn-py))
- Add Hillshade layer to notebook api [#304](https://github.com/geojupyter/jupytergis/pull/304) ([@gjmooney](https://github.com/gjmooney))
- Support Python 3.12 & Drop support for 3.8 and 3.9 [#303](https://github.com/geojupyter/jupytergis/pull/303) ([@arjxn-py](https://github.com/arjxn-py))
- Add zoom to layer to layer context menu [#294](https://github.com/geojupyter/jupytergis/pull/294) ([@gjmooney](https://github.com/gjmooney))
- Local and external file loading support for geojson, image and shapefile sources [#256](https://github.com/geojupyter/jupytergis/pull/256) ([@arjxn-py](https://github.com/arjxn-py))

### Bugs fixed

- Add numerical input next to the slider and handle value 1-10 [#365](https://github.com/geojupyter/jupytergis/pull/365) ([@arjxn-py](https://github.com/arjxn-py))
- Disable Image Smoothing for `ImageSource` [#364](https://github.com/geojupyter/jupytergis/pull/364) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Fix JupyterGISDoc.setSource [#346](https://github.com/geojupyter/jupytergis/pull/346) ([@davidbrochart](https://github.com/davidbrochart))
- Include files in lite deployment for `local.jGIS` [#345](https://github.com/geojupyter/jupytergis/pull/345) ([@arjxn-py](https://github.com/arjxn-py))
- Register new projections if needed when adding layers [#343](https://github.com/geojupyter/jupytergis/pull/343) ([@gjmooney](https://github.com/gjmooney))
- Move dependencies from root to dependent package + Update JupyterLite in lite build [#333](https://github.com/geojupyter/jupytergis/pull/333) ([@arjxn-py](https://github.com/arjxn-py))
- Try fixing jupyterlite deployment [#332](https://github.com/geojupyter/jupytergis/pull/332) ([@arjxn-py](https://github.com/arjxn-py))
- Add keyboard shortcuts for undo and redo [#320](https://github.com/geojupyter/jupytergis/pull/320) ([@gjmooney](https://github.com/gjmooney))
- Add "identified" style for polygons & linestrings [#319](https://github.com/geojupyter/jupytergis/pull/319) ([@gjmooney](https://github.com/gjmooney))

### Maintenance and upkeep improvements

- Bot: missing collaboration package [#368](https://github.com/geojupyter/jupytergis/pull/368) ([@martinRenou](https://github.com/martinRenou))
- Keep extension package name extension-artifacts for 3.12 to fix bot [#366](https://github.com/geojupyter/jupytergis/pull/366) ([@arjxn-py](https://github.com/arjxn-py))
- Support Python 3.12 & Drop support for 3.8 and 3.9 [#303](https://github.com/geojupyter/jupytergis/pull/303) ([@arjxn-py](https://github.com/arjxn-py))
- Add issue linkage to PR checklist [#298](https://github.com/geojupyter/jupytergis/pull/298) ([@mfisher87](https://github.com/mfisher87))

### Documentation improvements

- Add a pretty JupyterLite button to docs [#361](https://github.com/geojupyter/jupytergis/pull/361) ([@mfisher87](https://github.com/mfisher87))
- Fix Lite Deployment Badge via RTD on PR using Custom Action [#356](https://github.com/geojupyter/jupytergis/pull/356) ([@arjxn-py](https://github.com/arjxn-py))

### Other merged PRs

- Bot: Update Python [#367](https://github.com/geojupyter/jupytergis/pull/367) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-01-13&to=2025-01-21&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2025-01-13..2025-01-21&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2025-01-13..2025-01-21&type=Issues) | [@davidbrochart](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adavidbrochart+updated%3A2025-01-13..2025-01-21&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-01-13..2025-01-21&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-01-13..2025-01-21&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2025-01-13..2025-01-21&type=Issues) | [@Meriem-BenIsmail](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AMeriem-BenIsmail+updated%3A2025-01-13..2025-01-21&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2025-01-13..2025-01-21&type=Issues) | [@simonprovost](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Asimonprovost+updated%3A2025-01-13..2025-01-21&type=Issues) | [@SylvainCorlay](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3ASylvainCorlay+updated%3A2025-01-13..2025-01-21&type=Issues)

## 0.2.1

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.2.0...96cef85ae8edf6948e4e7d3b9b24c5a061e473c2))

### Bugs fixed

- Fix bug when loading geojson layers in notebook and update notebook test [#305](https://github.com/geojupyter/jupytergis/pull/305) ([@gjmooney](https://github.com/gjmooney))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2025-01-10&to=2025-01-13&type=c))

[@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2025-01-10..2025-01-13&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2025-01-10..2025-01-13&type=Issues)

## 0.2.0

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.7...c2372d35a7ce4368d85f484b92bcc83f6c781b61))

### Enhancements made

- Improve logos styling [#286](https://github.com/geojupyter/jupytergis/pull/286) ([@arjxn-py](https://github.com/arjxn-py))
- Add Identify tool [#270](https://github.com/geojupyter/jupytergis/pull/270) ([@gjmooney](https://github.com/gjmooney))
- Show other collaborators' cursors on map [#264](https://github.com/geojupyter/jupytergis/pull/264) ([@gjmooney](https://github.com/gjmooney))
- Speed-up GeoTIFF file handling [#262](https://github.com/geojupyter/jupytergis/pull/262) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Add ability to follow a collaborator's viewport [#257](https://github.com/geojupyter/jupytergis/pull/257) ([@gjmooney](https://github.com/gjmooney))
- Emphasize the hidden layer icon [#243](https://github.com/geojupyter/jupytergis/pull/243) ([@mfisher87](https://github.com/mfisher87))
- Add annotations support [#234](https://github.com/geojupyter/jupytergis/pull/234) ([@gjmooney](https://github.com/gjmooney))

### Bugs fixed

- Fix image layer python API [#297](https://github.com/geojupyter/jupytergis/pull/297) ([@gjmooney](https://github.com/gjmooney))
- Refactor layer tree updates [#284](https://github.com/geojupyter/jupytergis/pull/284) ([@gjmooney](https://github.com/gjmooney))
- Do not rely on collaborative drive for external file reading [#241](https://github.com/geojupyter/jupytergis/pull/241) ([@martinRenou](https://github.com/martinRenou))
- Fix shippping of geojson schema [#239](https://github.com/geojupyter/jupytergis/pull/239) ([@arjxn-py](https://github.com/arjxn-py))
- Fix check-release workflow [#223](https://github.com/geojupyter/jupytergis/pull/223) ([@gjmooney](https://github.com/gjmooney))

### Maintenance and upkeep improvements

- Remove redundant dev install instructions, loosen pydantic pin [#295](https://github.com/geojupyter/jupytergis/pull/295) ([@davidbrochart](https://github.com/davidbrochart))
- Temporary PR comment for lite preview [#290](https://github.com/geojupyter/jupytergis/pull/290) ([@brichet](https://github.com/brichet))
- Fix typo in ReadTheDocs PR link automation [#285](https://github.com/geojupyter/jupytergis/pull/285) ([@mfisher87](https://github.com/mfisher87))
- Bump the gha-dependencies group with 4 updates [#283](https://github.com/geojupyter/jupytergis/pull/283) ([@dependabot](https://github.com/dependabot))
- Make prettier output more human readable, improve documentation of linting [#282](https://github.com/geojupyter/jupytergis/pull/282) ([@mfisher87](https://github.com/mfisher87))
- Fix typo and formatting errors in dependabot config [#280](https://github.com/geojupyter/jupytergis/pull/280) ([@mfisher87](https://github.com/mfisher87))
- Bump actions/upload-artifact to v4 [#278](https://github.com/geojupyter/jupytergis/pull/278) ([@trungleduc](https://github.com/trungleduc))
- Build docs and Lite deployment in ReadTheDocs [#275](https://github.com/geojupyter/jupytergis/pull/275) ([@mfisher87](https://github.com/mfisher87))
- Automatically upgrade GitHub Action dependencies with Dependabot [#274](https://github.com/geojupyter/jupytergis/pull/274) ([@mfisher87](https://github.com/mfisher87))
- Add checks for reST content [#273](https://github.com/geojupyter/jupytergis/pull/273) ([@mfisher87](https://github.com/mfisher87))
- Improve layer update logic [#269](https://github.com/geojupyter/jupytergis/pull/269) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Grey out symbology entry for unsupported layers [#255](https://github.com/geojupyter/jupytergis/pull/255) ([@gjmooney](https://github.com/gjmooney))
- Replace @jupyterlab/rjsf with FormComponent from @jupyterlab/ui-components [#252](https://github.com/geojupyter/jupytergis/pull/252) ([@Meriem-BenIsmail](https://github.com/Meriem-BenIsmail))
- Apply pre-commit autofixes [#249](https://github.com/geojupyter/jupytergis/pull/249) ([@mfisher87](https://github.com/mfisher87))
- Update PR preview links [#233](https://github.com/geojupyter/jupytergis/pull/233) ([@martinRenou](https://github.com/martinRenou))
- Fix check-release workflow [#223](https://github.com/geojupyter/jupytergis/pull/223) ([@gjmooney](https://github.com/gjmooney))
- Embed GeoJSON schema in the project to improve build reliability [#165](https://github.com/geojupyter/jupytergis/pull/165) ([@arjxn-py](https://github.com/arjxn-py))

### Documentation improvements

- Remove unnecessary jupyterlab install [#301](https://github.com/geojupyter/jupytergis/pull/301) ([@davidbrochart](https://github.com/davidbrochart))
- Shrink logo and add lite badge to readme [#292](https://github.com/geojupyter/jupytergis/pull/292) ([@gjmooney](https://github.com/gjmooney))
- Configure lerna to use `jlpm` as npm client [#279](https://github.com/geojupyter/jupytergis/pull/279) ([@mfisher87](https://github.com/mfisher87))
- Add checks for reST content [#273](https://github.com/geojupyter/jupytergis/pull/273) ([@mfisher87](https://github.com/mfisher87))
- Set expectation that RTC doesn't work yet in JupyterLite deployment [#260](https://github.com/geojupyter/jupytergis/pull/260) ([@mfisher87](https://github.com/mfisher87))
- Update contributing docs to be more comprehensive (and fix links) [#242](https://github.com/geojupyter/jupytergis/pull/242) ([@mfisher87](https://github.com/mfisher87))
- docs: Add conda-forge install instructions [#228](https://github.com/geojupyter/jupytergis/pull/228) ([@matthewfeickert](https://github.com/matthewfeickert))
- Update README demo link to open `france_hiking.jGIS` [#226](https://github.com/geojupyter/jupytergis/pull/226) ([@mfisher87](https://github.com/mfisher87))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-12-06&to=2025-01-10&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2024-12-06..2025-01-10&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-12-06..2025-01-10&type=Issues) | [@davidbrochart](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adavidbrochart+updated%3A2024-12-06..2025-01-10&type=Issues) | [@dependabot](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adependabot+updated%3A2024-12-06..2025-01-10&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-12-06..2025-01-10&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-12-06..2025-01-10&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-12-06..2025-01-10&type=Issues) | [@matthewfeickert](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amatthewfeickert+updated%3A2024-12-06..2025-01-10&type=Issues) | [@Meriem-BenIsmail](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AMeriem-BenIsmail+updated%3A2024-12-06..2025-01-10&type=Issues) | [@mfisher87](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Amfisher87+updated%3A2024-12-06..2025-01-10&type=Issues) | [@pre-commit-ci](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Apre-commit-ci+updated%3A2024-12-06..2025-01-10&type=Issues) | [@trungleduc](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Atrungleduc+updated%3A2024-12-06..2025-01-10&type=Issues)

## 0.1.7

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.6...52c36a5d1a548724efc055de81f463a34ba1d1fb))

### Enhancements made

- JupyterLite: do not fail on file validation issues [#219](https://github.com/geojupyter/jupytergis/pull/219) ([@martinRenou](https://github.com/martinRenou))
- Open jgis files with json viewer [#210](https://github.com/geojupyter/jupytergis/pull/210) ([@gjmooney](https://github.com/gjmooney))
- Add support for other projections [#199](https://github.com/geojupyter/jupytergis/pull/199) ([@gjmooney](https://github.com/gjmooney))
- Symbology refactor [#193](https://github.com/geojupyter/jupytergis/pull/193) ([@gjmooney](https://github.com/gjmooney))
- Color ramps and classification [#177](https://github.com/geojupyter/jupytergis/pull/177) ([@gjmooney](https://github.com/gjmooney))

### Bugs fixed

- Skip cache when building prod [#222](https://github.com/geojupyter/jupytergis/pull/222) ([@gjmooney](https://github.com/gjmooney))
- CI: Set up caching [#211](https://github.com/geojupyter/jupytergis/pull/211) ([@gjmooney](https://github.com/gjmooney))
- UI-tests fix: Pin Jupyter Lab 4.2 [#203](https://github.com/geojupyter/jupytergis/pull/203) ([@gjmooney](https://github.com/gjmooney))
- Fix focus bug [#202](https://github.com/geojupyter/jupytergis/pull/202) ([@gjmooney](https://github.com/gjmooney))
- Add a min-height to the toolbar separator [#200](https://github.com/geojupyter/jupytergis/pull/200) ([@brichet](https://github.com/brichet))
- Add nodata to geotiff source [#198](https://github.com/geojupyter/jupytergis/pull/198) ([@gjmooney](https://github.com/gjmooney))
- Set collaborative attribute to False in Jupyterlite [#192](https://github.com/geojupyter/jupytergis/pull/192) ([@martinRenou](https://github.com/martinRenou))

### Maintenance and upkeep improvements

- Skip cache when building prod [#222](https://github.com/geojupyter/jupytergis/pull/222) ([@gjmooney](https://github.com/gjmooney))
- Commit gallery in the repo [#221](https://github.com/geojupyter/jupytergis/pull/221) ([@martinRenou](https://github.com/martinRenou))
- Fix update projection and allow exposing maps to ui-tests [#214](https://github.com/geojupyter/jupytergis/pull/214) ([@brichet](https://github.com/brichet))
- Disable docprovider-extension in lite deployment [#213](https://github.com/geojupyter/jupytergis/pull/213) ([@brichet](https://github.com/brichet))
- Update to jupyter-collaboration>=3 [#204](https://github.com/geojupyter/jupytergis/pull/204) ([@brichet](https://github.com/brichet))
- Use appsharing for testing jupyterlite from PRs and galata reports [#188](https://github.com/geojupyter/jupytergis/pull/188) ([@martinRenou](https://github.com/martinRenou))

### Documentation improvements

- Fix links to docs and lite deployment [#206](https://github.com/geojupyter/jupytergis/pull/206) ([@martinRenou](https://github.com/martinRenou))
- Build and publish docs to github pages [#205](https://github.com/geojupyter/jupytergis/pull/205) ([@martinRenou](https://github.com/martinRenou))
- first draft of documentation for JupyterGIS [#195](https://github.com/geojupyter/jupytergis/pull/195) ([@annefou](https://github.com/annefou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-10-14&to=2024-12-06&type=c))

[@annefou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aannefou+updated%3A2024-10-14..2024-12-06&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-10-14..2024-12-06&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-10-14..2024-12-06&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-10-14..2024-12-06&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-10-14..2024-12-06&type=Issues)

## 0.1.6

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.5...84200c15ed4537cf469482035c2d4eca9ffbfb42))

### Enhancements made

- Add `logoicon` as tab icon [#183](https://github.com/geojupyter/jupytergis/pull/183) ([@arjxn-py](https://github.com/arjxn-py))
- Reactive toolbar w.r.t width [#181](https://github.com/geojupyter/jupytergis/pull/181) ([@arjxn-py](https://github.com/arjxn-py))
- Rename launcher item [#180](https://github.com/geojupyter/jupytergis/pull/180) ([@martinRenou](https://github.com/martinRenou))
- Add JupyterGIS icons in the filebrowser [#179](https://github.com/geojupyter/jupytergis/pull/179) ([@martinRenou](https://github.com/martinRenou))
- Read/write color information for QGIS files [#175](https://github.com/geojupyter/jupytergis/pull/175) ([@gjmooney](https://github.com/gjmooney))

### Bugs fixed

- Remove extra comma from JSON repr, fixing creation of new files [#184](https://github.com/geojupyter/jupytergis/pull/184) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-10-04&to=2024-10-14&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2024-10-04..2024-10-14&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-10-04..2024-10-14&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-10-04..2024-10-14&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-10-04..2024-10-14&type=Issues)

## 0.1.5

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.4...743bc18afaccf544be4508cf8fbb0669f85dd59d))

### Enhancements made

- Add jupytergis_qgis to metapackage [#171](https://github.com/geojupyter/jupytergis/pull/171) ([@martinRenou](https://github.com/martinRenou))
- Animate spinner when fetching band information [#167](https://github.com/geojupyter/jupytergis/pull/167) ([@gjmooney](https://github.com/gjmooney))
- Vector symbology api [#163](https://github.com/geojupyter/jupytergis/pull/163) ([@gjmooney](https://github.com/gjmooney))

### Bugs fixed

- Fix the export path [#168](https://github.com/geojupyter/jupytergis/pull/168) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Exclude notebooks and qgz files from the lite deployment [#172](https://github.com/geojupyter/jupytergis/pull/172) ([@martinRenou](https://github.com/martinRenou))
- Remove terrain logic [#170](https://github.com/geojupyter/jupytergis/pull/170) ([@martinRenou](https://github.com/martinRenou))
- Use file from test directory only in UI tests [#169](https://github.com/geojupyter/jupytergis/pull/169) ([@brichet](https://github.com/brichet))
- Add test for ShapeFiles [#164](https://github.com/geojupyter/jupytergis/pull/164) ([@arjxn-py](https://github.com/arjxn-py))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-09-24&to=2024-10-04&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2024-09-24..2024-10-04&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-09-24..2024-10-04&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-09-24..2024-10-04&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-09-24..2024-10-04&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-09-24..2024-10-04&type=Issues)

## 0.1.4

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.3...27f26c221f3c85bdaa7954f57303ee3a0fd5a1e3))

### Enhancements made

- Export to qgis [#154](https://github.com/geojupyter/jupytergis/pull/154) ([@brichet](https://github.com/brichet))

### Bugs fixed

- Hotfix qgis loader for vector tile layer [#160](https://github.com/geojupyter/jupytergis/pull/160) ([@martinRenou](https://github.com/martinRenou))
- Fix the update layers [#159](https://github.com/geojupyter/jupytergis/pull/159) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Cleanup examples [#162](https://github.com/geojupyter/jupytergis/pull/162) ([@martinRenou](https://github.com/martinRenou))
- Update snapshots [#161](https://github.com/geojupyter/jupytergis/pull/161) ([@brichet](https://github.com/brichet))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-09-24&to=2024-09-24&type=c))

[@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-09-24..2024-09-24&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-09-24..2024-09-24&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-09-24..2024-09-24&type=Issues)

## 0.1.3

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.2...80c859e448632ddf3de6098611f4ac2ac5df99bc))

### Enhancements made

- Improve gdal initialization [#156](https://github.com/geojupyter/jupytergis/pull/156) ([@martinRenou](https://github.com/martinRenou))
- Vector symbology [#152](https://github.com/geojupyter/jupytergis/pull/152) ([@gjmooney](https://github.com/gjmooney))
- Build the lite deployment even if integration tests don't pass [#148](https://github.com/geojupyter/jupytergis/pull/148) ([@martinRenou](https://github.com/martinRenou))
- Raise an ImportError for the Python API in JupyterLite for now [#147](https://github.com/geojupyter/jupytergis/pull/147) ([@martinRenou](https://github.com/martinRenou))

### Bugs fixed

- Fix update option in main view [#153](https://github.com/geojupyter/jupytergis/pull/153) ([@brichet](https://github.com/brichet))
- Use base URL for accessing gdal assets [#150](https://github.com/geojupyter/jupytergis/pull/150) ([@gjmooney](https://github.com/gjmooney))
- Update geotiff example [#146](https://github.com/geojupyter/jupytergis/pull/146) ([@gjmooney](https://github.com/gjmooney))

### Maintenance and upkeep improvements

- Add ruff for linting and formatting [#151](https://github.com/geojupyter/jupytergis/pull/151) ([@gjmooney](https://github.com/gjmooney))
- Trigger snapshots update [#149](https://github.com/geojupyter/jupytergis/pull/149) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-09-18&to=2024-09-24&type=c))

[@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-09-18..2024-09-24&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-09-18..2024-09-24&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-09-18..2024-09-24&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-09-18..2024-09-24&type=Issues)

## 0.1.2

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/@jupytergis/base@0.1.1...2d2366ef0d447e418d6181ac24186a79a6ceeef2))

### Enhancements made

- Add icons [#144](https://github.com/geojupyter/jupytergis/pull/144) ([@martinRenou](https://github.com/martinRenou))
- Add handling for line type in vector layer [#143](https://github.com/geojupyter/jupytergis/pull/143) ([@arjxn-py](https://github.com/arjxn-py))
- Tif layer notebook API [#139](https://github.com/geojupyter/jupytergis/pull/139) ([@gjmooney](https://github.com/gjmooney))

### Bugs fixed

- Add the scale back [#142](https://github.com/geojupyter/jupytergis/pull/142) ([@arjxn-py](https://github.com/arjxn-py))
- Add back ShapeFile Support [#141](https://github.com/geojupyter/jupytergis/pull/141) ([@arjxn-py](https://github.com/arjxn-py))
- Fix jupyterlite issue [#138](https://github.com/geojupyter/jupytergis/pull/138) ([@trungleduc](https://github.com/trungleduc))

### Maintenance and upkeep improvements

- Notebook renderer: Use SharedModelFactory to create shared model [#145](https://github.com/geojupyter/jupytergis/pull/145) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-09-13&to=2024-09-18&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2024-09-13..2024-09-18&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-09-13..2024-09-18&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-09-13..2024-09-18&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-09-13..2024-09-18&type=Issues) | [@trungleduc](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Atrungleduc+updated%3A2024-09-13..2024-09-18&type=Issues)

## 0.1.1

**Although the version number can be misleading, this is the very first of many JupyterGIS releases 📡 🌍**

([Full Changelog](https://github.com/geojupyter/jupytergis/compare/951e5f31e353c7e074680a058be9b9f57d0f7402...1f3698e4e444856de7932e52c7e4b4577ed06220))

### Enhancements made

- Enable min/max values for tif layers [#137](https://github.com/geojupyter/jupytergis/pull/137) ([@gjmooney](https://github.com/gjmooney))
- Console view [#136](https://github.com/geojupyter/jupytergis/pull/136) ([@martinRenou](https://github.com/martinRenou))
- Improve toolbar [#135](https://github.com/geojupyter/jupytergis/pull/135) ([@martinRenou](https://github.com/martinRenou))
- Set Qt offscreen in jupytergis-qgis [#131](https://github.com/geojupyter/jupytergis/pull/131) ([@martinRenou](https://github.com/martinRenou))
- Small context menus improvements + add symbology menu [#129](https://github.com/geojupyter/jupytergis/pull/129) ([@martinRenou](https://github.com/martinRenou))
- More homogeneous CSS with the file browser [#128](https://github.com/geojupyter/jupytergis/pull/128) ([@martinRenou](https://github.com/martinRenou))
- Add symbology panel [#123](https://github.com/geojupyter/jupytergis/pull/123) ([@gjmooney](https://github.com/gjmooney))
- Use extent instead of center position and zoom [#119](https://github.com/geojupyter/jupytergis/pull/119) ([@brichet](https://github.com/brichet))
- Basic export from JGIS to QGIS file [#118](https://github.com/geojupyter/jupytergis/pull/118) ([@brichet](https://github.com/brichet))
- Switch to OpenLayers for the main view [#112](https://github.com/geojupyter/jupytergis/pull/112) ([@gjmooney](https://github.com/gjmooney))
- Terrain: allow to really exaggerate by removing the maximum [#105](https://github.com/geojupyter/jupytergis/pull/105) ([@martinRenou](https://github.com/martinRenou))
- #35 Add shapefile support [#104](https://github.com/geojupyter/jupytergis/pull/104) ([@arjxn-py](https://github.com/arjxn-py))
- Add StateDB to save UI state [#103](https://github.com/geojupyter/jupytergis/pull/103) ([@gjmooney](https://github.com/gjmooney))
- Notebook filters [#100](https://github.com/geojupyter/jupytergis/pull/100) ([@gjmooney](https://github.com/gjmooney))
- Add Scale to the basemap [#96](https://github.com/geojupyter/jupytergis/pull/96) ([@arjxn-py](https://github.com/arjxn-py))
- Add filtering in layers [#92](https://github.com/geojupyter/jupytergis/pull/92) ([@gjmooney](https://github.com/gjmooney))
- Add URL/tiles distinction and PM Tiles support [#91](https://github.com/geojupyter/jupytergis/pull/91) ([@gjmooney](https://github.com/gjmooney))
- Drag and drop layers [#90](https://github.com/geojupyter/jupytergis/pull/90) ([@brichet](https://github.com/brichet))
- Automatically infer source layer from Vector tile [#89](https://github.com/geojupyter/jupytergis/pull/89) ([@martinRenou](https://github.com/martinRenou))
- Reverse the layer order in side panel [#85](https://github.com/geojupyter/jupytergis/pull/85) ([@brichet](https://github.com/brichet))
- Add python API for image and video layers [#83](https://github.com/geojupyter/jupytergis/pull/83) ([@gjmooney](https://github.com/gjmooney))
- Add image and video support [#79](https://github.com/geojupyter/jupytergis/pull/79) ([@gjmooney](https://github.com/gjmooney))
- Allow opening basic QGIS files [#78](https://github.com/geojupyter/jupytergis/pull/78) ([@martinRenou](https://github.com/martinRenou))
- Add color picker for hillshade shadow color [#76](https://github.com/geojupyter/jupytergis/pull/76) ([@gjmooney](https://github.com/gjmooney))
- Add pitch and bearing to map options [#75](https://github.com/geojupyter/jupytergis/pull/75) ([@gjmooney](https://github.com/gjmooney))
- Improve form CSS [#74](https://github.com/geojupyter/jupytergis/pull/74) ([@martinRenou](https://github.com/martinRenou))
- Add keyboard shortcuts to sources panel [#68](https://github.com/geojupyter/jupytergis/pull/68) ([@gjmooney](https://github.com/gjmooney))
- Add support for 3d displays [#64](https://github.com/geojupyter/jupytergis/pull/64) ([@gjmooney](https://github.com/gjmooney))
- Add a source panel [#60](https://github.com/geojupyter/jupytergis/pull/60) ([@brichet](https://github.com/brichet))
- Keyboard shortcuts [#58](https://github.com/geojupyter/jupytergis/pull/58) ([@gjmooney](https://github.com/gjmooney))
- Update minZoom value for buildings example [#50](https://github.com/geojupyter/jupytergis/pull/50) ([@martinRenou](https://github.com/martinRenou))
- Add Context menu to layer tree items [#48](https://github.com/geojupyter/jupytergis/pull/48) ([@gjmooney](https://github.com/gjmooney))
- Attribution controls and navigation controls [#43](https://github.com/geojupyter/jupytergis/pull/43) ([@martinRenou](https://github.com/martinRenou))
- Notebook API [#38](https://github.com/geojupyter/jupytergis/pull/38) ([@martinRenou](https://github.com/martinRenou))
- Vector tile source [#37](https://github.com/geojupyter/jupytergis/pull/37) ([@martinRenou](https://github.com/martinRenou))
- Store map position in schema [#34](https://github.com/geojupyter/jupytergis/pull/34) ([@martinRenou](https://github.com/martinRenou))
- Rework custom raster layer creation [#32](https://github.com/geojupyter/jupytergis/pull/32) ([@martinRenou](https://github.com/martinRenou))
- Add geoJSON source and layer [#30](https://github.com/geojupyter/jupytergis/pull/30) ([@brichet](https://github.com/brichet))
- Rework object properties + format url properly [#29](https://github.com/geojupyter/jupytergis/pull/29) ([@martinRenou](https://github.com/martinRenou))
- Support importing QGIS project [#28](https://github.com/geojupyter/jupytergis/pull/28) ([@davidbrochart](https://github.com/davidbrochart))
- Add layer in the layers tree from the GIS model [#22](https://github.com/geojupyter/jupytergis/pull/22) ([@brichet](https://github.com/brichet))
- Object properties panel [#20](https://github.com/geojupyter/jupytergis/pull/20) ([@martinRenou](https://github.com/martinRenou))
- Use event in main view [#19](https://github.com/geojupyter/jupytergis/pull/19) ([@brichet](https://github.com/brichet))
- Add a layers panel [#17](https://github.com/geojupyter/jupytergis/pull/17) ([@brichet](https://github.com/brichet))
- Add raster layer gallery [#16](https://github.com/geojupyter/jupytergis/pull/16) ([@martinRenou](https://github.com/martinRenou))
- Allow for creating tile layers [#6](https://github.com/geojupyter/jupytergis/pull/6) ([@martinRenou](https://github.com/martinRenou))

### Bugs fixed

- Fix form for vectortilelayer [#126](https://github.com/geojupyter/jupytergis/pull/126) ([@martinRenou](https://github.com/martinRenou))
- fix notebook and qgis ydocs [#122](https://github.com/geojupyter/jupytergis/pull/122) ([@brichet](https://github.com/brichet))
- Add try/except case in the gallery building [#113](https://github.com/geojupyter/jupytergis/pull/113) ([@martinRenou](https://github.com/martinRenou))
- Fix examples schemas [#110](https://github.com/geojupyter/jupytergis/pull/110) ([@martinRenou](https://github.com/martinRenou))
- Fix select bug when creatng mutltiple new layers [#108](https://github.com/geojupyter/jupytergis/pull/108) ([@gjmooney](https://github.com/gjmooney))
- Fix layer removal bug [#101](https://github.com/geojupyter/jupytergis/pull/101) ([@gjmooney](https://github.com/gjmooney))
- Fix the layer order by making a copy of the array before reversing it [#88](https://github.com/geojupyter/jupytergis/pull/88) ([@brichet](https://github.com/brichet))
- Disable form validation at startup if it is invalid [#84](https://github.com/geojupyter/jupytergis/pull/84) ([@brichet](https://github.com/brichet))
- Fix a wrong comparison handling the unused statut of a source [#80](https://github.com/geojupyter/jupytergis/pull/80) ([@brichet](https://github.com/brichet))
- New file fix [#77](https://github.com/geojupyter/jupytergis/pull/77) ([@gjmooney](https://github.com/gjmooney))
- Fix source removal [#70](https://github.com/geojupyter/jupytergis/pull/70) ([@martinRenou](https://github.com/martinRenou))
- Pin reacttrs [#63](https://github.com/geojupyter/jupytergis/pull/63) ([@martinRenou](https://github.com/martinRenou))
- Fix context menu issue [#61](https://github.com/geojupyter/jupytergis/pull/61) ([@gjmooney](https://github.com/gjmooney))
- Fix undo bug [#57](https://github.com/geojupyter/jupytergis/pull/57) ([@gjmooney](https://github.com/gjmooney))
- Fix a typo on the layer tree observer [#56](https://github.com/geojupyter/jupytergis/pull/56) ([@brichet](https://github.com/brichet))
- Fix bot for updating snapshots [#52](https://github.com/geojupyter/jupytergis/pull/52) ([@martinRenou](https://github.com/martinRenou))
- Files sort keys [#49](https://github.com/geojupyter/jupytergis/pull/49) ([@martinRenou](https://github.com/martinRenou))
- Fix opacity step [#42](https://github.com/geojupyter/jupytergis/pull/42) ([@martinRenou](https://github.com/martinRenou))
- Fix thumnbails in script [#27](https://github.com/geojupyter/jupytergis/pull/27) ([@gjmooney](https://github.com/gjmooney))
- Fix new layer in map [#26](https://github.com/geojupyter/jupytergis/pull/26) ([@brichet](https://github.com/brichet))
- Clean the layer panel if there is no GIS widget in the tracker [#23](https://github.com/geojupyter/jupytergis/pull/23) ([@brichet](https://github.com/brichet))
- Fix the collaborative document [#18](https://github.com/geojupyter/jupytergis/pull/18) ([@brichet](https://github.com/brichet))

### Maintenance and upkeep improvements

- Update releaser workflows [#134](https://github.com/geojupyter/jupytergis/pull/134) ([@martinRenou](https://github.com/martinRenou))
- Fix CI [#130](https://github.com/geojupyter/jupytergis/pull/130) ([@martinRenou](https://github.com/martinRenou))
- Some code cleaning [#124](https://github.com/geojupyter/jupytergis/pull/124) ([@brichet](https://github.com/brichet))
- Fix UI tests [#116](https://github.com/geojupyter/jupytergis/pull/116) ([@brichet](https://github.com/brichet))
- Update repo links [#111](https://github.com/geojupyter/jupytergis/pull/111) ([@martinRenou](https://github.com/martinRenou))
- Attempt to fix the bot behavior [#97](https://github.com/geojupyter/jupytergis/pull/97) ([@martinRenou](https://github.com/martinRenou))
- Commands refactor [#86](https://github.com/geojupyter/jupytergis/pull/86) ([@gjmooney](https://github.com/gjmooney))
- Rework tests [#73](https://github.com/geojupyter/jupytergis/pull/73) ([@gjmooney](https://github.com/gjmooney))
- Bump ypywidgets>=0.9.0 [#65](https://github.com/geojupyter/jupytergis/pull/65) ([@davidbrochart](https://github.com/davidbrochart))
- Refactor form building [#55](https://github.com/geojupyter/jupytergis/pull/55) ([@martinRenou](https://github.com/martinRenou))
- Remove OCC from build env [#53](https://github.com/geojupyter/jupytergis/pull/53) ([@martinRenou](https://github.com/martinRenou))
- Fix linting [#45](https://github.com/geojupyter/jupytergis/pull/45) ([@martinRenou](https://github.com/martinRenou))
- Cleanup [#31](https://github.com/geojupyter/jupytergis/pull/31) ([@martinRenou](https://github.com/martinRenou))
- Remove the installation of server extension [#25](https://github.com/geojupyter/jupytergis/pull/25) ([@brichet](https://github.com/brichet))
- Drop YJGIS 'source' root type [#21](https://github.com/geojupyter/jupytergis/pull/21) ([@davidbrochart](https://github.com/davidbrochart))
- Linting [#15](https://github.com/geojupyter/jupytergis/pull/15) ([@martinRenou](https://github.com/martinRenou))
- Add jupyterlab build dependency [#5](https://github.com/geojupyter/jupytergis/pull/5) ([@davidbrochart](https://github.com/davidbrochart))
- Add CI [#2](https://github.com/geojupyter/jupytergis/pull/2) ([@martinRenou](https://github.com/martinRenou))

### Documentation improvements

- Update screenshot to show collaborators [#133](https://github.com/geojupyter/jupytergis/pull/133) ([@martinRenou](https://github.com/martinRenou))
- Add basic README [#132](https://github.com/geojupyter/jupytergis/pull/132) ([@martinRenou](https://github.com/martinRenou))
- Fix examples + fix filters schema + proper file validation error message [#107](https://github.com/geojupyter/jupytergis/pull/107) ([@martinRenou](https://github.com/martinRenou))
- Update JupyterLite examples [#106](https://github.com/geojupyter/jupytergis/pull/106) ([@martinRenou](https://github.com/martinRenou))
- Update Contributing Guide for Developer Installation [#81](https://github.com/geojupyter/jupytergis/pull/81) ([@arjxn-py](https://github.com/arjxn-py))

### Other merged PRs

- Attempt to fix the bot: part 2 [#121](https://github.com/geojupyter/jupytergis/pull/121) ([@martinRenou](https://github.com/martinRenou))
- Attempt to fix bot [#120](https://github.com/geojupyter/jupytergis/pull/120) ([@martinRenou](https://github.com/martinRenou))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/geojupyter/jupytergis/graphs/contributors?from=2024-06-11&to=2024-09-13&type=c))

[@arjxn-py](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Aarjxn-py+updated%3A2024-06-11..2024-09-13&type=Issues) | [@brichet](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Abrichet+updated%3A2024-06-11..2024-09-13&type=Issues) | [@davidbrochart](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Adavidbrochart+updated%3A2024-06-11..2024-09-13&type=Issues) | [@github-actions](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agithub-actions+updated%3A2024-06-11..2024-09-13&type=Issues) | [@gjmooney](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3Agjmooney+updated%3A2024-06-11..2024-09-13&type=Issues) | [@martinRenou](https://github.com/search?q=repo%3Ageojupyter%2Fjupytergis+involves%3AmartinRenou+updated%3A2024-06-11..2024-09-13&type=Issues)
