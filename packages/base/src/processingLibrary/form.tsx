import React from "react";
import { OperationSpecification } from "./types";

import { objectEntries } from "@src/tools";

interface FormGeneratorProps {
    operation: OperationSpecification;
    jgisPath: string;
    layers: any;
    onExecute: (renderedTemplate: string) => void;
}

export const formGenerator = ({operation, jgisPath, layers, onExecute}: FormGeneratorProps): JSX.Element => (
    <div>
        <h3>{operation.name}</h3>
        <div>{operation.description}</div>

        {objectEntries(operation.arguments).forEach((arg_name: string, arg_type: string) => {
            <label htmlFor={arg_name}>{arg_name}</label>

            {switch(arg_type) {
                case "number":
                    <input id={arg_name} type="number" />
                    break;
                case "VectorLayer":
                    <select id={arg_name}>
                        { /* TODO: Also filter to vector layers */ }
                        {layers.map((layer: any) => (
                            <option key={layer.id} value={layer.source}>{layer.name}</option>
                        ))}
                    </select>
                    break;
                default:
                    throw 'oh no';

            }}
        })}

        <button onClick={() => {
            const dynamicArgs = objectEntries(operation.arguments).map((arg_name: string, arg_type: string) => {
                // TODO: Get the actual values from the form fields and assign them to
                //       the names of the arguments in this object. We probably should use something
                //       other than `.map`... `.reduce`?
                //       {arg_name: `form.[arg_name].value` for arg_name in operation.arguments.keys()}
            })
            const args = {
                jgisPath,
                ...dynamicArgs,
            }
            const rendered = operation.template(...args);
            onExecute(rendered);
        }} />

    </div>
);