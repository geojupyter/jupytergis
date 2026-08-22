// Vue 2.7's own type definitions register a *global* JSX namespace (via
// `vue/types/jsx`) that collides with React's JSX everywhere in this
// project. We therefore never import Vue's types into the tsc program —
// `.vue` single-file components are typed as `any` here, and the Vue
// runtime is pulled in untyped (see registerModelBuilder.ts). Webpack still
// compiles/bundles the real modules.
declare module '*.vue' {
  const component: any;
  export default component;
}
