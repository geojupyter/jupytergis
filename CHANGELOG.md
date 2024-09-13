# JupyterGIS Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

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

<!-- <END NEW CHANGELOG ENTRY> -->
