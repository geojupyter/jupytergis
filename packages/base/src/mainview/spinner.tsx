import * as React from 'react';

interface IProps {
  loading: boolean;
}
export function Spinner(props: IProps) {
  return (
    <div
      className={'jGIS-Spinner'}
      style={{ display: props.loading ? 'flex' : 'none' }}
    >
      <div className={'jGIS-SpinnerContent'}></div>
    </div>
  );
}
