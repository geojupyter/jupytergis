import React from 'react';
import { User } from '@jupyterlab/services';

interface IFollowIndicatorProps {
  remoteUser: User.IIdentity | null | undefined;
}

export function FollowIndicator({ remoteUser }: IFollowIndicatorProps) {
  return remoteUser?.display_name ? (
    <div
      style={{
        position: 'absolute',
        top: 1,
        right: 3,
        background: remoteUser.color
      }}
    >
      {`Following ${remoteUser.display_name}`}
    </div>
  ) : null;
}
