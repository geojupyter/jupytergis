import { ProcessingMerge } from '@jupytergis/schema';
import { ICommandPalette } from '@jupyterlab/apputils';

export function addProcessingToPalette(palette: ICommandPalette) {
  for (const processingElement of ProcessingMerge) {
    palette.addItem({
      command: processingElement.gen_name,
      category: 'JupyterGIS',
    });
  }
}
