#!/bin/python3
import os
import json

processing_dir = "packages/schema/src/schema/processing"

filenames = [file for file in os.listdir(processing_dir) if file.endswith(".json")]

params = []
for filename in filenames:
    filename = f"{processing_dir}/{filename}"
    with open(filename, "r") as f:
        e = json.loads(f.read())
        keep = [
            "processName",
            "processParams",
            "processLabel",
            "processType",
            "processAdditionalsParams",
        ]

        toAdd = {}
        toAdd["description"] = e["description"]

        for x in keep:
            toAdd[x] = e["processGenerationParams"][x]

        params.append(toAdd)


def addBanner(f):
    f.write("//Generated automatically please don't modify directly\n")


def generateJsonMerge():
    directory = "packages/schema/src/processing/_generated"

    os.makedirs(directory, exist_ok=True)

    output = f"{directory}/processing_merge.json"

    with open(output, "w+") as f:
        json.dump(params, f, indent=2)
        f.write("\n")


def exportSchema():
    directory = "packages/schema/src/processing/_generated"

    os.makedirs(directory, exist_ok=True)

    curFileName = f"{directory}/exportProcessingSchema.ts"

    with open(curFileName, "w+") as f:
        addBanner(f)
        for param in params:
            processName = param["processName"]
            f.write(f"export * from '../../_interface/processing/{processName}';\n")


def defineProcessingType():
    directory = "packages/base/src/processing/_generated"

    os.makedirs(directory, exist_ok=True)

    curFileName = f"{directory}/processingType.ts"

    with open(curFileName, "w+") as f:
        addBanner(f)

        f.write("export type ProcessingType =")

        for param in params:
            description = param["description"]
            f.write(f"\n  | '{description}'")

        f.write(";\n")

        f.write("export const ProcessingList = [\n")

        for param in params:
            description = param["description"]
            f.write(f"  '{description}',\n")

        f.write("];\n")


def addConstant():
    directory = "packages/base/src/processing/_generated"

    os.makedirs(directory, exist_ok=True)

    curFileName = "packages/base/src/processing/_generated/processingConstants.ts"

    with open(curFileName, "w+") as f:
        addBanner(f)
        for i in range(len(params)):
            param = params[i]
            processName = param["processName"]
            f.write(f"export const {processName} = 'jupytergis:{processName}';\n")
            if i + 1 == len(params):
                continue


generateJsonMerge()
exportSchema()
defineProcessingType()
addConstant()
