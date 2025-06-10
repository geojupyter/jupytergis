import { ProcessingMerge } from '@jupytergis/schema';
import { Menu } from '@lumino/widgets';

export function addProcessingToMenu(processingSubmenu: Menu) {
  for (const processingElement of ProcessingMerge) {
    processingSubmenu.addItem({
      command: processingElement.gen_name,
    });
  }
}
