export interface OperationSpecificationArguments {
    [argName: string]: string;
}

export interface OperationSpecification {
    id: string;
    name: string;
    description: string;
    arguments: OperationSpecificationArguments;
    template: any;
}