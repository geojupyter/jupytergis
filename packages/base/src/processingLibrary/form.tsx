import React from "react";
import { OperationSpecification } from "./types";

interface FormGeneratorProps {
    operation: OperationSpecification;
    jgisPath: string;
    layers: any;
    onExecute: (renderedTemplate: string) => void;
}

export const FormGenerator = ({operation, jgisPath, layers, onExecute}: FormGeneratorProps): JSX.Element => (
    <div>
        <h3>{operation.name}</h3>
        <div>{operation.description}</div>

        {Object.entries(operation.arguments).map(([arg_name, arg_type]: [string, string]) => (
            <div key={arg_name}>
                <label htmlFor={arg_name}>{arg_name}</label>
                {(() => { switch (arg_type) {
                    case "number":
                        return <input id={arg_name} type="number" />;
                    case "VectorLayer":
                        return <select id={arg_name}>
                            {layers.map((layer: any) => (
                                <option key={layer.id} value={layer.source}>{layer.name}</option>
                            ))}
                        </select>;
                    case "boolean":
                        return <><input id={arg_name} type="checkbox" /><label htmlFor={arg_name}>{arg_name}</label></>;
                    default:
                        throw new Error(`Unknown argument type: ${arg_type}`);
                }})()}
            </div>
        ))}

        <button onClick={() => {
            const dynamicArgs = Object.entries(operation.arguments).reduce((acc: any, [arg_name]: [string, string]) => {
                const el = document.getElementById(arg_name) as HTMLInputElement;
                acc[arg_name] = el?.type === 'checkbox' ? el.checked : el?.value;
                return acc;
            }, {});
            const rendered = operation.template({ jgisPath, ...dynamicArgs });
            onExecute(rendered);
        }}>Run</button>

    </div>
);