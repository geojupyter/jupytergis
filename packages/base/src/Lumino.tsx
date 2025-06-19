import { Widget } from '@lumino/widgets';
import * as React from 'react';

type LuminoProps = {
  id?: string;
  height?: string | number;
  children: Widget;
};

export const Lumino = (props: LuminoProps) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { children, id, height } = props;
  React.useEffect(() => {
    if (ref && ref.current) {
      try {
        Widget.attach(children, ref.current);
      } catch (e) {
        console.warn('Exception while attaching Lumino widget.', e);
      }
      return () => {
        try {
          if (children.isAttached || children.node.isConnected) {
            children.dispose();
            Widget.detach(children);
          }
        } catch (e) {
          // no-op.
          //          console.debug('Exception while detaching Lumino widget.', e);
        }
      };
    }
  }, [ref, children]);
  return (
    <div id={id} ref={ref} style={{ height: height, minHeight: height }} />
  );
};

Lumino.defaultProps = {
  id: 'lumino-id',
  height: '100%',
};

export default Lumino;
