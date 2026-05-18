# Form system

This document describes how layer, source, processing, and story-editor forms work, including how they are built, who owns state, and how data flows.

## What the form system does

The form system powers:

- **Layer and source creation/editing** (e.g. add layer, edit layer properties, add source, edit source properties).
- **Processing dialogs** (e.g. Dissolve).
- **Story map editor** (e.g. story presentation settings).

All of these use **JSON Schema–driven forms** (RJSF). The same form component for a given type is used both when creating a new object (e.g. in the layer creation dialog) and when editing an existing one (e.g. in the properties panel). Behaviour differs only by **form context** (`'create'` vs `'update'`), which affects things like read-only fields and labels.

## Design ideas

1. **One render primitive**
   **SchemaForm** only renders a schema-driven form and reports changes via `onChange` and `onSubmit`. It does not own persistence, dialog behaviour, or create/update mode. The parent component owns state and decides what to do on change and submit.

2. **Shared state and handlers**
   **useSchemaFormState** holds form data (synced from `sourceData`), builds a copy of the schema, and provides a standard form context. It can also provide base change/submit handlers. Type-specific forms use this hook and either use those handlers directly or wrap them (e.g. to add validation or transform data before submit).

3. **Shared schema behaviour**
   **schemaUtils** (`processBaseSchema`, `removeFormEntry`) adapts the JSON schema and uiSchema before they are passed to SchemaForm (array options, opacity field, read-only handling, hiding fields). Each type form calls these and then applies its own logic (e.g. source enum, custom widgets).

4. **One component per type**
   Each layer type, source type, and special form (Dissolve, Story editor, default processing) is a **function component** in its own file. It composes: `useSchemaFormState` (and optionally its base handlers), schemaUtils, type-specific uiSchema/validation, and SchemaForm. There is no shared base class; behaviour is composed from the hook and utilities.

5. **Selectors and flows**
   **formselectors** (`getLayerTypeForm`, `getSourceTypeForm`) choose the right form component by type. **CreationForm** and **EditForm** use these selectors and pass a common set of props (schema, sourceData, syncData, model, formContext, etc.). Dialogs and the properties panel use CreationForm or EditForm; they do not talk to individual form components directly.

## Main pieces

### SchemaForm

- **Location:** `packages/base/src/formbuilder/objectform/SchemaForm.tsx`
- **Role:** Renders an RJSF form from `schema`, `formData`, and optional `uiSchema`. Calls `onChange` when the user edits and `onSubmit` when the form is submitted (e.g. hidden submit button). Accepts `formContext` for custom fields and optional `extraErrors`, `submitButtonRef`, etc. Does not call `syncData` or close dialogs; the parent does that in the callbacks.

### useSchemaFormState

- **Location:** `packages/base/src/formbuilder/objectform/useSchemaFormState.ts`
- **Role:** Hook that owns form state and common wiring. Given `sourceData`, `schemaProp`, and `model`, it returns:
  - `formData`, `setFormData` (state synced from `sourceData` when it changes),
  - `schema` (deep copy of `schemaProp`),
  - `formContextValue` (`{ model, formData }` for SchemaForm),
  - `hasSchema` (whether to render or return null),
  - and, when `syncData` (and optionally `cancel`, `onAfterChange`) are passed: `handleChangeBase` and `handleSubmitBase`.

  Type forms use the hook and either pass these handlers straight to SchemaForm or wrap them (e.g. run validation, transform payload, update `dialogOptions`).

### schemaUtils

- **Location:** `packages/base/src/formbuilder/objectform/schemaUtils.ts`
- **Role:** `removeFormEntry` removes a property from form data, schema, and uiSchema. `processBaseSchema` applies shared behaviour for array options, opacity field, read-only handling, and nested object handling. Type forms call these when building `schema` and `uiSchema` in `useMemo`.

### Type form components

Each layer or source type has a function component (e.g. `vectorlayerform.tsx`, `geojsonsource.tsx`) that:

1. Calls **useSchemaFormState** with the right props.
2. Builds **uiSchema** in a `useMemo` using `processBaseSchema`, `removeFormEntry`, and type-specific logic (e.g. source dropdown enum, custom widgets, hidden fields).
3. Uses **handleChangeBase** and **handleSubmitBase** from the hook, or wraps them (e.g. path-based and GeoJSON sources add path/URL validation).
4. Renders **SchemaForm** with the hook’s `schema`, `formData`, `formContextValue`, and the chosen change/submit handlers.

The same component is used for create and edit.

**Layer forms:** `layerform.tsx`, `vectorlayerform.tsx`, `hillshadeLayerForm.tsx`, `geoTiffLayerForm.tsx`, `heatmapLayerForm.tsx`, `storySegmentLayerForm.tsx`.

**Source forms:** `sourceform.tsx`, `geojsonsource.tsx`, `pathbasedsource.tsx`, `tilesourceform.tsx`, `geotiffsource.tsx`.

**Other forms:** **DefaultProcessingForm** (`processingForm.tsx`), **DissolveForm** (`process/dissolveProcessForm.tsx`), **StoryEditorPropertiesForm** (`StoryEditorForm.tsx`). These use the same hook and SchemaForm. The processing forms connect the dialog OK button to a programmatic submit via `submitButtonRef`.

### Form selectors and flows

- **formselectors.ts** exposes `getLayerTypeForm(layerType)` and `getSourceTypeForm(sourceType)` so callers get the right form component without importing each one.
- **CreationForm** (used by the layer/source creation dialog) renders the chosen source and/or layer form, stores latest form data in refs via `syncData`, and registers a confirm handler. When the user clicks OK, the dialog invokes that handler and CreationForm reads the refs and calls the model’s add methods.
- **EditForm** (used by the properties panel) resolves the layer/source by id, picks the form via the selectors, and passes `syncData` so that each change updates the model (e.g. `updateObjectParameters`). No OK button; changes apply as you edit.

## Sync policy

- **Create flow** (e.g. layer/source creation dialog): Form data is **not** written to the model while the dialog is open. On OK, the dialog’s confirm handler runs and CreationForm reads the latest data from refs and calls the model’s add methods.
- **Edit flow** (properties panel): Form data is **synced on every change**. Each change calls `syncData`, which updates the model so the panel always reflects the current state.
- **Processing dialogs** (e.g. Dissolve): The dialog OK button triggers a programmatic submit (via `submitButtonRef`). The form’s `onSubmit` runs; it may validate and then calls `syncData`.
