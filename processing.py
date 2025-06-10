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
            "description",
            "gen_name",
            "gen_params",
            "gen_label",
            "gen_type",
            "gen_additionals",
        ]
        params.append({x: e[x] for x in keep})


def addBanner(f):
    f.write("//Generated automatically please don't modify directly\n")


def generateJsonMerge():
    output = f"packages/schema/src/processing/_generated/processing_merge.json"

    with open(output, "w+") as f:
        json.dump(params, f, indent=2)
        f.write("\n")


def exportSchema():
    curFileName = "packages/schema/src/processing/_generated/exportProcessingSchema.ts"
    with open(curFileName, "w+") as f:
        addBanner(f)
        for param in params:
            gen_name = param["gen_name"]
            f.write(f"export * from '../../_interface/processing/{gen_name}';\n")


def defineProcessingType():
    curFileName = "packages/base/src/processing/_generated/processingType.ts"
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
    curFileName = "packages/base/src/processing/_generated/processingConstants.ts"
    with open(curFileName, "w+") as f:
        addBanner(f)
        for i in range(len(params)):
            param = params[i]
            gen_name = param["gen_name"]
            f.write(f"export const {gen_name} = 'jupytergis:{gen_name}';\n")
            if i + 1 == len(params):
                continue


generateJsonMerge()
exportSchema()
defineProcessingType()
addConstant()
