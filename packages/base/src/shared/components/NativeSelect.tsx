import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from './utils';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

function NativeSelect({
  className,
  size = 'default',
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn('jgis-native-select', className)}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select data-slot="native-select" data-size={size} {...props} />
      <ChevronDownIcon
        className="jgis-native-select-icon"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<'option'>) {
  return (
    <option
      data-slot="native-select-option"
      className={cn(className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<'optgroup'>) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn(className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
