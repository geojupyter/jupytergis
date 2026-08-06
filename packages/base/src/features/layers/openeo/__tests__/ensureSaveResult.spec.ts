import { ensureSaveResult, OPENEO_TEMPLATES } from '../templates';

describe('ensureSaveResult', () => {
  it('returns the graph unchanged when a save_result is already present', () => {
    const graph = {
      loadcollection1: {
        arguments: { id: 'S2' },
        process_id: 'load_collection',
      },
      saveresult1: {
        arguments: {
          data: { from_node: 'loadcollection1' },
          format: 'PNG',
          options: {},
        },
        process_id: 'save_result',
        result: true,
      },
    };
    expect(ensureSaveResult(graph)).toBe(graph);
  });

  it('leaves the built-in templates (which already save_result) untouched', () => {
    for (const template of OPENEO_TEMPLATES) {
      const graph = template.buildGraph(template.defaults);
      expect(ensureSaveResult(graph)).toBe(graph);
    }
  });

  it('injects a save_result over the result node when one is missing', () => {
    const graph = {
      loadcollection1: {
        arguments: { id: 'S2' },
        process_id: 'load_collection',
      },
      reducedimension1: {
        arguments: { data: { from_node: 'loadcollection1' } },
        process_id: 'reduce_dimension',
        result: true,
      },
    };
    const out = ensureSaveResult(graph);

    expect(out).not.toBe(graph);
    // A new save_result node exists and is now the graph's output.
    expect(out.saveresult1).toEqual({
      arguments: {
        data: { from_node: 'reducedimension1' },
        format: 'PNG',
        options: {},
      },
      process_id: 'save_result',
      result: true,
    });
    // The former result node hands off its output role.
    expect(out.reducedimension1.result).toBeUndefined();
    expect(out.reducedimension1.process_id).toBe('reduce_dimension');
    // Exactly one node carries result: true.
    const resultNodes = Object.values(out).filter(
      (n: any) => n?.result === true,
    );
    expect(resultNodes).toHaveLength(1);
  });

  it('honors a custom output format', () => {
    const graph = {
      apply1: {
        arguments: {},
        process_id: 'apply',
        result: true,
      },
    };
    const out = ensureSaveResult(graph, 'GTiff');
    expect(out.saveresult1.arguments.format).toBe('GTiff');
  });

  it('avoids clobbering an existing node named saveresult1', () => {
    const graph = {
      saveresult1: {
        arguments: {},
        process_id: 'some_other_process',
        result: true,
      },
    };
    const out = ensureSaveResult(graph);
    // The original saveresult1 (not a save_result) is preserved...
    expect(out.saveresult1.process_id).toBe('some_other_process');
    // ...and the injected node lands on a non-colliding key.
    expect(out.saveresult2.process_id).toBe('save_result');
    expect(out.saveresult2.arguments.data).toEqual({
      from_node: 'saveresult1',
    });
  });

  it('leaves the graph unchanged when there is no result node to wire onto', () => {
    const graph = {
      loadcollection1: {
        arguments: { id: 'S2' },
        process_id: 'load_collection',
      },
    };
    expect(ensureSaveResult(graph)).toBe(graph);
  });
});
