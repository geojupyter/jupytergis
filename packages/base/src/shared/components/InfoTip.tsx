import { Info } from 'lucide-react';
import React from 'react';

import { HoverTip, IHoverTipProps } from './HoverTip';

type IInfoTipProps = Omit<IHoverTipProps, 'icon' | 'triggerLabel'>;

export function InfoTip(props: IInfoTipProps) {
  return (
    <HoverTip
      icon={<Info data-size="md" />}
      triggerLabel="More information"
      {...props}
    />
  );
}
