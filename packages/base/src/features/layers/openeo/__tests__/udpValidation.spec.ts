import { validateProcessGraphLocally } from '../validation';

// A minimal but valid process catalog — enough that
// validateProcessGraphLocally doesn't early-return, so the registry is
// actually exercised against UDP references.
const PROCESSES = [
  {
    id: 'save_result',
    parameters: [
      { name: 'data', schema: {} },
      { name: 'format', schema: {} },
      { name: 'options', schema: {}, optional: true },
    ],
    returns: { schema: {} },
  },
];

function hasUnsupported(errors: { code?: string; message: string }[]): boolean {
  return errors.some(e => e.code === 'ProcessUnsupported');
}

describe('validateProcessGraphLocally — UDP support', () => {
  it('flags a bare reference to an unknown user-defined process', async () => {
    const graph = {
      u1: { process_id: 'my_udp', arguments: {}, result: true },
    };
    const errors = await validateProcessGraphLocally(graph, PROCESSES);
    expect(hasUnsupported(errors)).toBe(true);
  });

  it('accepts a reference to a backend-registered UDP', async () => {
    const graph = {
      u1: { process_id: 'my_udp', arguments: {}, result: true },
    };
    const userProcesses = [
      { id: 'my_udp', parameters: [], returns: { schema: {} } },
    ];
    const errors = await validateProcessGraphLocally(
      graph,
      PROCESSES,
      userProcesses,
    );
    expect(hasUnsupported(errors)).toBe(false);
  });

  it('does not flag an externally-namespaced UDP reference (backend resolves it)', async () => {
    const graph = {
      u1: {
        process_id: 'ext_udp',
        namespace: 'https://algorithm-catalogue.apex.esa.int/ext_udp.json',
        arguments: {},
        result: true,
      },
    };
    // No matching entry in processes or userProcesses — the local registry
    // can't know it, but the explicit namespace means it's the backend's to
    // validate, so we must not surface a false ProcessUnsupported.
    const errors = await validateProcessGraphLocally(graph, PROCESSES, []);
    expect(hasUnsupported(errors)).toBe(false);
  });
});
