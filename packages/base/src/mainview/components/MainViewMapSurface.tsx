import { IDict } from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import React, { RefObject } from 'react';

import CollaboratorPointers, {
  ClientPointer,
} from '@/src/mainview/CollaboratorPointers';
import { FollowIndicator } from '@/src/mainview/FollowIndicator';
import { LoadingOverlay } from '@/src/shared/components/loading';

export interface IMainViewMapSurfaceProps {
  mainViewRef: RefObject<HTMLDivElement>;
  loading: boolean;
  remoteUser?: User.IIdentity | null;
  clientPointers: IDict<ClientPointer>;
  spectaMobileTouch: boolean;
  onTouchStart?: (event: React.TouchEvent) => void;
  onTouchEnd?: (event: React.TouchEvent) => void;
  children: React.ReactNode;
}

export function MainViewMapSurface({
  mainViewRef,
  loading,
  remoteUser,
  clientPointers,
  spectaMobileTouch,
  onTouchStart,
  onTouchEnd,
  children,
}: IMainViewMapSurfaceProps): JSX.Element {
  return (
    <div
      ref={mainViewRef}
      className="jGIS-Mainview data-jgis-keybinding"
      tabIndex={0}
      style={{
        border: remoteUser ? `solid 3px ${remoteUser.color}` : 'unset',
      }}
      onTouchStart={spectaMobileTouch ? onTouchStart : undefined}
      onTouchEnd={spectaMobileTouch ? onTouchEnd : undefined}
    >
      <LoadingOverlay loading={loading} />
      <FollowIndicator remoteUser={remoteUser} />
      <CollaboratorPointers clients={clientPointers} />
      {children}
    </div>
  );
}
