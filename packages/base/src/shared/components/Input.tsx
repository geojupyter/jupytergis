import * as React from 'react';

import { cn } from './utils';

type InputProps = React.ComponentProps<'input'> & {
  onEnter?: (value: string) => void;
};

const SKIP_ENTER_COMMIT_TYPES = new Set([
  'button',
  'checkbox',
  'file',
  'image',
  'radio',
  'reset',
  'submit',
]);

function Input({ className, type, onKeyDown, onChange, onEnter, ...props }: InputProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);

    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      (type && SKIP_ENTER_COMMIT_TYPES.has(type))
    ) {
      return;
    }

    event.preventDefault();
    const { currentTarget } = event;
    const { value } = currentTarget;

    onChange?.({
      ...event,
      target: currentTarget,
      currentTarget,
    } as React.ChangeEvent<HTMLInputElement>);
    currentTarget.blur();
    onEnter?.(value);
  };

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(className)}
      onKeyDown={handleKeyDown}
      onChange={onChange}
      {...props}
    />
  );
}

export { Input };
