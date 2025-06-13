import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

type FontAwesomeIconSize = '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '1x' | '2x' | '3x' | '4x' | '5x' | '6x' | '7x' | '8x' | '9x' | '10x';
interface ILoadingIcon {
  size?: FontAwesomeIconSize;
  style?: React.CSSProperties;
  className?: string;
}
export const LoadingIcon: React.FC<ILoadingIcon> = (props) => (
  <FontAwesomeIcon icon={faSpinner}
    spin
    size={props.size || 'xl'}
    style={props.style || {margin: 'auto', padding: '1rem'}}
    className={props.className}
  />
);

export const LoadingOverlay: React.FC<{loading: boolean}> = (props) => (
  <div
    className={'jGIS-Spinner'}
    style={{ display: props.loading ? 'flex' : 'none' }}
  >
    <div className={'jGIS-SpinnerContent'}></div>
  </div>
);
