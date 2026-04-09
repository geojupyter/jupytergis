# State management

JupyterGIS stores state in four places. Choose based on who needs it and how long it should live.

| Mechanism                            | Persisted              | Shared with collaborators |
| ------------------------------------ | ---------------------- | ------------------------- |
| Document (`uiState`, `viewState`, …) | In `.jgis` file        | Yes (Yjs CRDT)            |
| JupyterLab Settings                  | Per-user JSON          | No                        |
| StateDB                              | Browser `localStorage` | No                        |
| React state                          | Memory only            | No                        |

## Document state

Written into the `.jgis` file and replicated via Yjs.

- **`layers` / `sources` / `layerTree`** — map content. Always shared.
- **`options`** — map view config (zoom, centre, projection). Always shared.
- **`viewState`** — per-collaborator camera snapshots, keyed by collaborator ID.
- **`uiState`** — panel open/closed state (`leftPanelOpen`, `rightPanelOpen`, `consoleOpen`, `temporalControllerOpen`). Whether changes are actually written to the shared document is controlled by the `syncUIState` setting (default: `true`). The `useUIState` hook abstracts this for React components.

Use document state for anything that belongs to the file's presentation or that the author wants to hand off to collaborators.

## JupyterLab Settings

Deployment-level feature flags (e.g. `leftPanelDisabled`, `syncUIState`). Defined in `python/jupytergis_core/schema/`. Per-user, never shared. Use for _whether a feature exists_, not its current state.

## StateDB

JupyterLab's `IStateDB` (`localStorage`). Per-browser, never shared. Use for personal UI micro-state too fine-grained for the document (e.g. layer tree expand/collapse).

## React state

Plain `useState` — lost on unmount. Use for ephemeral, local-only UI state (hover, open dropdown, uncommitted form values).
