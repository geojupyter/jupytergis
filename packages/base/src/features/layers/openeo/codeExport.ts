/**
 * Convert an openEO flat process graph into the equivalent client code that
 * would build it, for the openeo Python and R clients.
 *
 * This mirrors the "Export as code" feature of the openeo-web-editor, but is a
 * standalone, typed implementation over the flat-graph shape JupyterGIS
 * already works with — see `templates.ts` for representative graphs.
 *
 * Scope: the graphs produced by our templates and by hand-editing in the
 * dialog — linear datacube chains plus callback sub-graphs (reducers,
 * `apply` processes). Callback-bearing processes are emitted as native client
 * methods (e.g. `reduce_dimension`, `apply`, `save_result`), so a callback on
 * a process with no native method is not supported; such a node falls back to
 * the generic `process()` form, which the backend may still accept.
 */

export type ExportLanguage = 'python' | 'r';

interface IFlatNode {
  process_id: string;
  arguments: Record<string, any>;
  result?: boolean;
  namespace?: string;
}

type FlatGraph = Record<string, IFlatNode>;

export interface ICodeExportOptions {
  /** Server URL to seed the `connect(...)` call with. */
  serverUrl?: string;
  /**
   * Append a JupyterGIS snippet that adds the resulting graph as a layer.
   * Python only (JupyterGIS has no R API); ignored for R.
   */
  includeJupyterGIS?: boolean;
  /** Layer name used in the JupyterGIS snippet. */
  layerName?: string;
}

// Reserved identifiers we must not use as variable names. Beyond each
// language's keywords, these are names the generated code itself relies on.
const PY_RESERVED = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield', 'None', 'True', 'False',
  'openeo', 'connection', 'process', 'result',
]);

const R_RESERVED = new Set([
  'if', 'else', 'repeat', 'while', 'function', 'for', 'in', 'next', 'break',
  'TRUE', 'FALSE', 'NULL', 'Inf', 'NaN', 'NA',
  'openeo', 'connect', 'connection', 'compute_result', 'result', 'p',
]);

// Preferred ordering for callback parameters so signatures read naturally.
const PARAM_ORDER = ['data', 'x', 'y', 'value', 'label', 'context'];

function isRef(v: any, key: 'from_node' | 'from_parameter'): v is Record<string, any> {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v[key] === 'string'
  );
}

function isCallback(v: any): v is { process_graph: FlatGraph } {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    v.process_graph !== null &&
    typeof v.process_graph === 'object'
  );
}

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Sanitise a node/parameter id into a valid identifier, tracking uniqueness. */
function makeVar(
  id: string,
  reserved: Set<string>,
  used: Set<string>,
): string {
  let base = id.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!base || /^[0-9]/.test(base)) {
    base = `v_${base}`;
  }
  if (reserved.has(base)) {
    base = `${base}_`;
  }
  let name = base;
  let n = 1;
  while (used.has(name)) {
    name = `${base}${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}

/** Order node ids so every node comes after the siblings it references. */
function topoOrder(graph: FlatGraph): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (id: string, stack: Set<string>) => {
    if (visited.has(id) || !graph[id]) {
      return;
    }
    if (stack.has(id)) {
      return; // cycle guard — openEO graphs are acyclic, but be safe.
    }
    stack.add(id);
    for (const dep of siblingDeps(graph[id])) {
      visit(dep, stack);
    }
    stack.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const id of Object.keys(graph)) {
    visit(id, new Set());
  }
  return order;
}

/** Collect the `from_node` ids referenced anywhere in a node's arguments. */
function siblingDeps(node: IFlatNode): string[] {
  const deps: string[] = [];
  const walk = (v: any) => {
    if (isRef(v, 'from_node')) {
      deps.push(v.from_node);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (isCallback(v)) {
      return; // callbacks are a separate scope.
    }
    if (isPlainObject(v)) {
      Object.values(v).forEach(walk);
    }
  };
  Object.values(node.arguments ?? {}).forEach(walk);
  return deps;
}

/** The id of the node this node reads its primary data input from, if any. */
function receiverArg(
  node: IFlatNode,
): { key: string; nodeId: string } | null {
  const args = node.arguments ?? {};
  if (isRef(args.data, 'from_node')) {
    return { key: 'data', nodeId: args.data.from_node };
  }
  for (const [key, value] of Object.entries(args)) {
    if (isRef(value, 'from_node')) {
      return { key, nodeId: value.from_node };
    }
  }
  return null;
}

function collectParams(graph: FlatGraph): string[] {
  const names = new Set<string>();
  const walk = (v: any) => {
    if (isRef(v, 'from_parameter')) {
      names.add(v.from_parameter);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (isCallback(v)) {
      return;
    }
    if (isPlainObject(v)) {
      Object.values(v).forEach(walk);
    }
  };
  for (const node of Object.values(graph)) {
    Object.values(node.arguments ?? {}).forEach(walk);
  }
  const sorted = Array.from(names).sort((a, b) => {
    const ia = PARAM_ORDER.indexOf(a);
    const ib = PARAM_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    }
    return a.localeCompare(b);
  });
  return sorted.length > 0 ? sorted : ['data'];
}

function resultNodeId(graph: FlatGraph): string | null {
  for (const [id, node] of Object.entries(graph)) {
    if (node.result) {
      return id;
    }
  }
  const ids = Object.keys(graph);
  return ids.length ? ids[ids.length - 1] : null;
}

interface IScope {
  /** Map of node id -> emitted variable name for this graph level. */
  vars: Map<string, string>;
  /** Map of callback parameter name -> emitted variable name. */
  params: Map<string, string>;
}

/** Shared generator; language differences are injected via the `lang` field. */
class CodeGenerator {
  private reserved: Set<string>;
  private usedNames = new Set<string>();
  private callbackCounter = 0;

  constructor(private lang: ExportLanguage) {
    this.reserved = lang === 'python' ? PY_RESERVED : R_RESERVED;
  }

  // --- literal rendering ------------------------------------------------

  private lit(value: any, scope: IScope): string {
    if (value === null || value === undefined) {
      return this.lang === 'python' ? 'None' : 'NULL';
    }
    if (typeof value === 'boolean') {
      if (this.lang === 'python') {
        return value ? 'True' : 'False';
      }
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (isRef(value, 'from_node')) {
      return scope.vars.get(value.from_node) ?? JSON.stringify(value.from_node);
    }
    if (isRef(value, 'from_parameter')) {
      return (
        scope.params.get(value.from_parameter) ??
        JSON.stringify(value.from_parameter)
      );
    }
    if (Array.isArray(value)) {
      const items = value.map(v => this.lit(v, scope));
      return this.lang === 'python'
        ? `[${items.join(', ')}]`
        : `list(${items.join(', ')})`;
    }
    if (isPlainObject(value)) {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return this.lang === 'python' ? 'None' : 'NULL';
      }
      const parts = entries.map(([k, v]) =>
        this.lang === 'python'
          ? `${JSON.stringify(k)}: ${this.lit(v, scope)}`
          : `${JSON.stringify(k)} = ${this.lit(v, scope)}`,
      );
      return this.lang === 'python'
        ? `{${parts.join(', ')}}`
        : `list(${parts.join(', ')})`;
    }
    return this.lang === 'python' ? 'None' : 'NULL';
  }

  // --- callback (child process graph) -----------------------------------

  /**
   * Emit a callback sub-graph as a named function and return its name plus the
   * lines that define it (to be placed before the node that references it).
   */
  private emitCallback(
    argKey: string,
    graph: FlatGraph,
    lines: string[],
  ): string {
    this.callbackCounter += 1;
    // The function name lives in the enclosing scope, so keep it unique there;
    // its parameters and internal node variables are local to the function
    // body and get a fresh name set so they don't collect suffixes.
    const name = makeVar(
      `${argKey}${this.callbackCounter}`,
      this.reserved,
      this.usedNames,
    );
    const localNames = new Set<string>();
    const paramNames = collectParams(graph);
    const scope: IScope = { vars: new Map(), params: new Map() };
    for (const p of paramNames) {
      scope.params.set(p, makeVar(p, this.reserved, localNames));
    }
    const signature = paramNames.map(p => scope.params.get(p)).join(', ');
    const body: string[] = [];
    // Inside a callback everything is a builder, so use the generic
    // `process(...)` form (Python) / `p$<id>(...)` form (R) uniformly.
    for (const id of topoOrder(graph)) {
      const node = graph[id];
      const v = makeVar(id, this.reserved, localNames);
      scope.vars.set(id, v);
      body.push(this.callbackStatement(v, node, scope, body));
    }
    const rid = resultNodeId(graph);
    const retVar = rid ? scope.vars.get(rid) : undefined;

    if (this.lang === 'python') {
      lines.push(`def ${name}(${signature}):`);
      body.forEach(l => lines.push(`    ${l}`));
      lines.push(`    return ${retVar ?? 'None'}`);
    } else {
      lines.push(`${name} = function(${signature}) {`);
      body.forEach(l => lines.push(`  ${l}`));
      lines.push('}');
    }
    return name;
  }

  private callbackStatement(
    variable: string,
    node: IFlatNode,
    scope: IScope,
    pre: string[],
  ): string {
    const args = this.renderArgs(node.arguments ?? {}, scope, pre, new Set());
    if (this.lang === 'python') {
      const call = [JSON.stringify(node.process_id), ...args].join(', ');
      return `${variable} = process(${call})`;
    }
    return `${variable} = p$${node.process_id}(${args.join(', ')})`;
  }

  /** Render arguments as `name=code` / `name = code` strings, skipping keys. */
  private renderArgs(
    args: Record<string, any>,
    scope: IScope,
    pre: string[],
    skip: Set<string>,
  ): string[] {
    const sep = this.lang === 'python' ? '=' : ' = ';
    const out: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (skip.has(key)) {
        continue;
      }
      let rendered: string;
      if (isCallback(value)) {
        rendered = this.emitCallback(key, value.process_graph, pre);
      } else {
        rendered = this.lit(value, scope);
      }
      out.push(`${key}${sep}${rendered}`);
    }
    return out;
  }

  // --- top-level nodes --------------------------------------------------

  private pythonNode(
    variable: string,
    node: IFlatNode,
    scope: IScope,
    lines: string[],
  ): void {
    const args = node.arguments ?? {};
    const recv = receiverArg(node);
    const hasCallback = Object.values(args).some(isCallback);

    if (!recv) {
      // Start node — bind it to the connection.
      if (node.process_id === 'load_collection' && 'id' in args) {
        const idCode = this.lit(args.id, scope);
        const rest = this.renderArgs(args, scope, lines, new Set(['id']));
        // `fetch_metadata=False` stops the client from validating dimension and
        // band names against the collection's advertised metadata. Our graphs
        // use the openEO-web-editor convention (`"time"`, `"bands"`), which the
        // in-app path submits verbatim; some backends (e.g. titiler-openeo)
        // advertise different axis names (`"t"`, `"spectral"`) and would
        // otherwise reject an otherwise-valid graph before it is ever sent.
        const call = [idCode, ...rest, 'fetch_metadata=False'].join(', ');
        lines.push(`${variable} = connection.load_collection(${call})`);
      } else {
        const rest = this.renderArgs(args, scope, lines, new Set());
        const call = [JSON.stringify(node.process_id), ...rest].join(', ');
        lines.push(`${variable} = connection.datacube_from_process(${call})`);
      }
      return;
    }

    const recvVar = scope.vars.get(recv.nodeId) ?? recv.nodeId;
    if (hasCallback || node.process_id === 'save_result') {
      // Native datacube method; the receiver is passed implicitly as `self`.
      const rest = this.renderArgs(args, scope, lines, new Set([recv.key]));
      lines.push(`${variable} = ${recvVar}.${node.process_id}(${rest.join(', ')})`);
    } else {
      // Generic call; pass all arguments (including the data reference).
      const rest = this.renderArgs(args, scope, lines, new Set());
      const call = [JSON.stringify(node.process_id), ...rest].join(', ');
      lines.push(`${variable} = ${recvVar}.process(${call})`);
    }
  }

  private rNode(
    variable: string,
    node: IFlatNode,
    scope: IScope,
    lines: string[],
  ): void {
    // The R client calls every process uniformly via the process collection
    // `p`, passing `data = <var>` explicitly rather than method chaining.
    const args = this.renderArgs(node.arguments ?? {}, scope, lines, new Set());
    lines.push(`${variable} = p$${node.process_id}(${args.join(', ')})`);
  }

  // --- entry point ------------------------------------------------------

  generate(graph: FlatGraph, options: ICodeExportOptions): string {
    const scope: IScope = { vars: new Map(), params: new Map() };
    const order = topoOrder(graph);
    for (const id of order) {
      scope.vars.set(id, makeVar(id, this.reserved, this.usedNames));
    }

    const body: string[] = [];
    for (const id of order) {
      const variable = scope.vars.get(id) ?? id;
      if (this.lang === 'python') {
        this.pythonNode(variable, graph[id], scope, body);
      } else {
        this.rNode(variable, graph[id], scope, body);
      }
    }

    const rid = resultNodeId(graph);
    const resultVar = rid ? scope.vars.get(rid) : undefined;
    const serverUrl = options.serverUrl || 'https://openeo.example.org';

    if (this.lang === 'python') {
      return this.assemblePython(body, resultVar, serverUrl, options);
    }
    return this.assembleR(body, resultVar, serverUrl);
  }

  private assemblePython(
    body: string[],
    resultVar: string | undefined,
    serverUrl: string,
    options: ICodeExportOptions,
  ): string {
    const lines: string[] = [
      'import openeo',
      'from openeo.processes import process',
      '',
      `connection = openeo.connect(${JSON.stringify(serverUrl)})`,
      '',
      '# Authenticate — enter your credentials below.',
      '# Local titiler-openeo servers use basic auth:',
      'connection.authenticate_basic("USERNAME", "PASSWORD")',
      '# Most hosted openEO backends use OIDC instead — comment the line above',
      '# and use: connection.authenticate_oidc()',
      '',
      ...body,
    ];
    if (options.includeJupyterGIS && resultVar) {
      const name = options.layerName || 'OpenEO Layer';
      lines.push(
        '',
        'from jupytergis import GISDocument',
        '',
        'doc = GISDocument()',
        'await doc.ready()',
        `doc.add_openeo_tile_layer(${resultVar}, name=${JSON.stringify(name)})`,
        'display(doc)',
      );
    } else if (resultVar) {
      lines.push('', `# result = connection.execute(${resultVar})`);
    }
    return lines.join('\n') + '\n';
  }

  private assembleR(
    body: string[],
    resultVar: string | undefined,
    serverUrl: string,
  ): string {
    const lines: string[] = [
      'library(openeo)',
      '',
      `connection = connect(host = ${JSON.stringify(serverUrl)})`,
      '# ToDo: authenticate with login()',
      'p = processes()',
      '',
      ...body,
    ];
    if (resultVar) {
      lines.push('', `# result = compute_result(graph = ${resultVar})`);
    }
    return lines.join('\n') + '\n';
  }
}

/**
 * Generate openeo client code (Python or R) that reconstructs `graph`.
 *
 * @param graph - an openEO flat process graph (node id -> node).
 * @param lang - target client language.
 * @param options - server URL and optional JupyterGIS snippet.
 */
export function exportProcessGraphCode(
  graph: Record<string, any>,
  lang: ExportLanguage,
  options: ICodeExportOptions = {},
): string {
  return new CodeGenerator(lang).generate(graph as FlatGraph, options);
}
