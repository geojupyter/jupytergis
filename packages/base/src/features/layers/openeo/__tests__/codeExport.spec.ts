import { exportProcessGraphCode } from '../codeExport';
import { OPENEO_TEMPLATES } from '../templates';

const SERVER = 'https://openeo.example.org';

function graphOf(id: string): Record<string, any> {
  const template = OPENEO_TEMPLATES.find(t => t.id === id);
  if (!template) {
    throw new Error(`Unknown template ${id}`);
  }
  return template.buildGraph(template.defaults);
}

describe('exportProcessGraphCode — Python', () => {
  it('binds load_collection to the connection with the collection id positional', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'python', {
      serverUrl: SERVER,
    });
    expect(code).toContain('import openeo');
    expect(code).toContain('from openeo.processes import process');
    expect(code).toContain(`connection = openeo.connect("${SERVER}")`);
    expect(code).toContain(
      'loadcollection1 = connection.load_collection("sentinel-2-global-mosaics"',
    );
    // The collection id must not also appear as a keyword argument.
    expect(code).not.toContain('id="sentinel-2-global-mosaics"');
    // Metadata fetching is disabled so the client does not validate our
    // convention dimension/band names ("time"/"bands") against a backend that
    // names its axes differently ("t"/"spectral") and reject a valid graph
    // before it is ever sent. Verified end-to-end against a titiler-openeo
    // server: the graph renders a PNG with this flag, and errors without it.
    expect(code).toContain('fetch_metadata=False');
  });

  it('emits an authenticate line with credential placeholders', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'python', {
      serverUrl: SERVER,
    });
    expect(code).toContain(
      'connection.authenticate_basic("USERNAME", "PASSWORD")',
    );
  });

  it('emits callback-bearing processes as native datacube methods with def callbacks', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'python', {
      serverUrl: SERVER,
    });
    // reduce_dimension is a native method chained on the previous datacube.
    expect(code).toMatch(
      /reducedimension1 = loadcollection1\.reduce_dimension\(/,
    );
    // Its reducer callback is a def that returns the result node.
    expect(code).toMatch(/def reducer\d+\(data\):/);
    expect(code).toContain('first1 = process("first", data=data)');
    expect(code).toMatch(/reducer=reducer\d+/);
  });

  it('uses the generic .process() form (with explicit data) for non-native processes', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'python', {
      serverUrl: SERVER,
    });
    expect(code).toMatch(
      /colorformula1 = apply1\.process\("color_formula", data=apply1, formula=/,
    );
  });

  it('renders nested arithmetic callbacks (NDVI) with parameter references', () => {
    const code = exportProcessGraphCode(graphOf('ndvi'), 'python', {
      serverUrl: SERVER,
    });
    expect(code).toContain('nir = process("array_element", data=data, index=0)');
    expect(code).toContain('red = process("array_element", data=data, index=1)');
    expect(code).toContain('diff = process("subtract", x=nir, y=red)');
    expect(code).toMatch(/ndvi = process\("divide", x=diff, y=sum\)/);
    expect(code).toMatch(/return ndvi/);
  });

  it('appends the JupyterGIS snippet when requested', () => {
    const code = exportProcessGraphCode(graphOf('ndvi'), 'python', {
      serverUrl: SERVER,
      includeJupyterGIS: true,
      layerName: 'My NDVI',
    });
    expect(code).toContain('from jupytergis import GISDocument');
    expect(code).toContain('await doc.ready()');
    expect(code).toContain(
      'doc.add_openeo_tile_layer(saveresult1, name="My NDVI")',
    );
    expect(code).toContain('display(doc)');
  });

  it('omits the JupyterGIS snippet by default and hints at execute()', () => {
    const code = exportProcessGraphCode(graphOf('ndvi'), 'python', {
      serverUrl: SERVER,
    });
    expect(code).not.toContain('GISDocument');
    expect(code).toContain('# result = connection.execute(saveresult1)');
  });
});

describe('exportProcessGraphCode — R', () => {
  it('emits every process uniformly via the process collection p', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'r', {
      serverUrl: SERVER,
    });
    expect(code).toContain('library(openeo)');
    expect(code).toContain(`connection = connect(host = "${SERVER}")`);
    expect(code).toContain('p = processes()');
    expect(code).toContain('loadcollection1 = p$load_collection(');
    expect(code).toContain('reducedimension1 = p$reduce_dimension(');
    // Data flows through explicit data = <var> arguments, not method chaining.
    expect(code).toContain('data = loadcollection1');
  });

  it('wraps callbacks in R anonymous functions that return the result', () => {
    const code = exportProcessGraphCode(graphOf('true-color'), 'r', {
      serverUrl: SERVER,
    });
    expect(code).toMatch(/reducer\d+ = function\(data\) \{/);
    expect(code).toContain('first1 = p$first(data = data)');
  });

  it('never appends the JupyterGIS snippet for R', () => {
    const code = exportProcessGraphCode(graphOf('ndvi'), 'r', {
      serverUrl: SERVER,
      includeJupyterGIS: true,
    });
    expect(code).not.toContain('GISDocument');
  });
});
