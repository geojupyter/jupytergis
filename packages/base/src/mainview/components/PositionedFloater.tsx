import React from 'react';

interface IPositionedFloaterProps {
  id: string;
  className: string;
  left: number;
  top: number;
  children: React.ReactNode;
}

export function PositionedFloater({
  id,
  className,
  left,
  top,
  children,
}: IPositionedFloaterProps): JSX.Element {
  return (
    <div
      id={id}
      className={className}
      style={{
        left,
        top,
      }}
    >
      {children}
    </div>
  );
}
