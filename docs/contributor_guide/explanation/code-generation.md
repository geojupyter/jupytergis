# Code generation

JupyterGIS leverages code generation to share information about data structures across
Python and TypeScript packages.


## Overview

There are 3 code generation targets: the schema registry, TypeScript types, and Python
types.

```{mermaid}
flowchart LR
    package-manifest[package.json]
    npm-script-schema-registry{{build:schema:registry}}
    npm-script-schema-js{{build:schema:js}}
    npm-script-schema-py{{build:schema:py}}

    combined-schema[(Combined schema<br/>&lpar;forms.json&rpar;)]
    schema-registry[[python/jupytergis_core/src/schemaregistry.ts]]
    react-forms[[React forms]]

    ts-types[(TypeScript type definitions)]

    tmp-schema[(Temporary schema<br/>&lpar;Normalized $ref paths&rpar;)]
    py-types[(Python type definitions)]

    package-manifest -->|jlpm run| npm-script-schema-registry
    package-manifest -->|jlpm run| npm-script-schema-js
    package-manifest -->|jlpm run| npm-script-schema-py

    npm-script-schema-registry -->|scripts/dereference-and-combine-schemas-for-registry.js| combined-schema
    -->|read| schema-registry
    -->|react-jsonschema-form| react-forms

    npm-script-schema-js -->|json-schema-to-typescript| ts-types
    npm-script-schema-js -->|scripts/add-schema-version.ts| ts-types

    npm-script-schema-py -->|scripts/preprocess-schemas-for-python-type-generation.js| tmp-schema
    --> |datamodel-code-generator| py-types
```


## Schema registry

The schema registry is built for use in TypeScript code.
It's used by [`react-jsonschema-form` (RJSF)](https://github.com/rjsf-team/react-jsonschema-form)
to generate forms (React components) from JSONSchema.

Prior to generating the schema registry, we dereference (i.e. inline `$ref`s) our
schemas and combine them into one JSON file which contains a mapping from schema names
to schema data for each schema.

:::{note}
Combining the schemas into `forms.json` is vestigial.
Before we had a schema registry, we would directly index into this data to find a
schema.
Now that we're building a schema registry for interfacing with schemas, perhaps we don't
need a combined `forms.json` schema.
:::


## TypeScript types

TypeScript types are generated from the JSONSchema files using
[`json-schema-to-typescript`](https://github.com/bcherny/json-schema-to-typescript).

We additionally run a custom script (`scripts/add-schema-version.ts`) to generate a
version number variable.


## Python types

Python types are generated from the JSONSchema files using
[`datamodel-code-generator`](https://github.com/koxudaxi/datamodel-code-generator).


### Weirdness with `$ref` paths

Unfortunately, `datamodel-code-generator` expects `$ref` paths to be expressed
differently from `json-schema-to-typescript`.
The former expects "relative" paths, and the latter expects "absolute" paths.

For example, if we have two schema files:

```
├── referent.json
└── subdir
    └── referrer.json
```

...`json-schema-to-typescript` would expect `referrer.json` to contain a reference like:

```json
"$ref": "referent.json",
```

...and `datamodel-code-generator` would expect the reference in `referrer.json` to look like:

```json
"$ref": "../referent.json",
```

**For this reason, we chose to write our schema files in the way
`json-schema-to-typescript` expects, and pre-process them into a temp directory so they
look the way `datamodel-code-generator` expects before generating Python types.**
