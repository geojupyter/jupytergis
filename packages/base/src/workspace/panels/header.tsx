import { Widget } from '@lumino/widgets';

export class ControlPanelHeader extends Widget {
  /**
   * Instantiate a new sidebar header.
   */
  constructor() {
    super({ node: createHeader() });
    this.title.changed.connect(_ => {
      this.node.textContent = this.title.label;
    });
  }
}

/**
 * Create a sidebar header node.
 */
export function createHeader(): HTMLElement {
  const title = document.createElement('h2');
  title.textContent = '-';
  return title;
}
