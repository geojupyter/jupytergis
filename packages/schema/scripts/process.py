import os
import json

processingSchemaDir = "src/schema/processing"
processingConfigDir = "src/processing/config"
filenamesSchema = []
filenamesProcessConfig = []
params = []


directory = "src/processing/_generated"


def addBanner(f):
    f.write("//Generated automatically please don't modify directly\n")


def generateJsonMerge():
    output = f"{directory}/processing_merge.json"

    with open(output, "w+") as f:
        json.dump(params, f, indent=2)
        f.write("\n")


def exportSchema():
    curFileName = f"{directory}/exportProcessingSchema.ts"

    with open(curFileName, "w+") as f:
        addBanner(f)
        for param in params:
            processName = param["name"]
            f.write(f"export * from '../../_interface/processing/{processName}';\n")


def defineProcessingType():
    curFileName = f"{directory}/processingType.ts"

    with open(curFileName, "w+") as f:
        addBanner(f)

        f.write("export type ProcessingType =")

        for param in params:
            description = param["description"]
            f.write(f"\n  | '{description}'")

        f.write(";\n")

        f.write("export const processingList = [\n")

        for param in params:
            description = param["description"]
            f.write(f"  '{description}',\n")

        f.write("];\n")


if __name__ == "__main__":
    filenamesSchema = [
        file for file in os.listdir(processingSchemaDir) if file.endswith(".json")
    ]

    params = []
    for filename in filenamesSchema:
        filename = f"{processingSchemaDir}/{filename}"
        with open(filename, "r") as f:
            e = json.loads(f.read())

            toAdd = {}
            toAdd["description"] = e["description"]

            params.append(toAdd)

    filenamesProcessConfig = [
        file for file in os.listdir(processingConfigDir) if file.endswith(".json")
    ]

    cnt = 0
    for filename in filenamesProcessConfig:
        filename = f"{processingConfigDir}/{filename}"
        with open(filename, "r") as f:
            e = json.loads(f.read())
            for x in e:
                params[cnt][x] = e[x]
        cnt += 1

    os.makedirs(directory, exist_ok=True)
    generateJsonMerge()
    exportSchema()
    defineProcessingType()
