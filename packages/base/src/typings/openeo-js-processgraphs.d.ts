declare module '@openeo/js-processgraphs' {
  export class ProcessRegistry {
    constructor(processes?: any[], addNamespace?: boolean);
    add(process: any, namespace?: string, fireEvent?: boolean): void;
    addAll(processes: any[], namespace?: string): void;
    get(id: string, namespace?: string | null): any;
    has(id: string, namespace?: string | null): boolean;
    count(): number;
  }

  export class ErrorList {
    count(): number;
    getAll(): any[];
    toJSON(): any[];
    getMessage(): string;
  }

  export class ProcessGraph {
    constructor(
      process: { id?: string; process_graph: Record<string, any> },
      processRegistry?: ProcessRegistry | null,
      jsonSchemaValidator?: any,
    );
    parse(): void;
    validate(throwOnErrors?: boolean): Promise<void>;
    getErrors(): ErrorList;
    isValid(): boolean;
    allowEmptyGraph: boolean;
  }

  export class ProcessGraphError extends Error {
    code: string;
  }
}
