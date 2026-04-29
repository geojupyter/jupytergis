import { OperationSpecification } from "./types";

class GeoProcessingOperationRegistry {
    operations: Map<str, OperationSpecification>

    add(name: string, spec: OperationSpecification) {
        // if it's not in operations already:
        this.operations.set(name, spec);
    }

    remove(name: string) {
        // TODO
    }

    get(name: string) { //TODO: Return type
        return this.operations.get(name);
    }
}

export const geoProcessingOperationRegistry = new GeoProcessingOperationRegistry();