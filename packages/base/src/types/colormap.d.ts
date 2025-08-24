declare module "colormap/colorScale.js" {
    export interface ColorScalePoint {
      index: number;
      rgb: [number, number, number];
    }

    export default function colorScale(
      options: {
        colormap: string | ColorScalePoint[];
        nshades?: number;
        format?: "hex" | "rgbaString" | "float";
      }
    ): string[];
  }

