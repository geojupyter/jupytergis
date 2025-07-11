import { User } from '@jupyterlab/services';
import React from 'react';

interface IFollowIndicatorProps {
  remoteUser: User.IIdentity | null | undefined;
}

export const FollowIndicator: React.FC<IFollowIndicatorProps> = ({
  remoteUser,
}) => {
  return remoteUser?.display_name ? (
    <div
      style={{
        position: 'absolute',
        top: 1,
        right: 3,
        background: remoteUser.color,
      }}
    >
      {`Following ${remoteUser.display_name}`}
    </div>
  ) : null;
};
