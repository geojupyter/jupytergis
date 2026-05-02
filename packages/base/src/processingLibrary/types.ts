export interface OperationSpecificationArguments {
    [argName: string]: string;
}

export interface OperationSpecification {
    id: string;
    name: string;
    description: string;
    arguments: OperationSpecificationArguments;
    template: (args: { jgisPath: string; [key: string]: any }) => string;
}