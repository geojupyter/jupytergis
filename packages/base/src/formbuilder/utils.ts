export function focusInputField(
    filePath?: string,
    fieldId?: string | null,
    value?: any,
    color?: string,
    lastSelectedPropFieldId?: string
  ): string | undefined {
    const propsToRemove = ['border-color', 'box-shadow'];
    let newSelected: string | undefined;
    if (!fieldId) {
      if (lastSelectedPropFieldId) {
        removeStyleFromProperty(filePath, lastSelectedPropFieldId, propsToRemove);
        if (value) {
          const el = getElementFromProperty(filePath, lastSelectedPropFieldId);
          if (el?.tagName?.toLowerCase() === 'input') {
            (el as HTMLInputElement).value = value;
          }
        }
        newSelected = undefined;
      }
    } else {
      if (fieldId !== lastSelectedPropFieldId) {
        removeStyleFromProperty(filePath, lastSelectedPropFieldId, propsToRemove);

        const el = getElementFromProperty(filePath, fieldId);
        if (el) {
          el.style.borderColor = color ?? 'red';
          el.style.boxShadow = `inset 0 0 4px ${color ?? 'red'}`;
        }
        newSelected = fieldId;
      }
    }
    return newSelected;
  }

  export function getElementFromProperty(
    filePath?: string | null,
    prop?: string | null
  ): HTMLElement | undefined | null {
    if (!filePath || !prop) {
      return;
    }
    const parent = document.querySelector(`[data-path="${filePath}"]`);

    if (parent) {
      const el = parent.querySelector(`[id$=${prop}]`);
      return el as HTMLElement;
    }
  }

  export function removeStyleFromProperty(
    filePath: string | null | undefined,
    prop: string | null | undefined,
    properties: string[]
  ): void {
    if (!filePath || !prop || properties.length === 0) {
      return;
    }
    const el = getElementFromProperty(filePath, prop);
    if (el) {
      properties.forEach(prop => el.style.removeProperty(prop));
    }
  }
