import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import * as React from 'react';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={'jgis-checkbox'} {...props}>
    <CheckboxPrimitive.Indicator className={'jgis-checkbox-indicator'}>
      <Check
        style={{
          height: '1rem',
          width: '1rem',
        }}
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export default Checkbox;
