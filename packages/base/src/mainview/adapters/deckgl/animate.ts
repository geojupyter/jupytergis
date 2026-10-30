export type AnimateOptions = {
  from: number;
  to: number;
  duration: number;
  /** Extra play-throughs after the first. Use `Infinity` to loop forever. */
  repeat?: number;
  onUpdate: (value: number) => void;
};

export type AnimationControls = {
  stop: () => void;
};

export function animate(options: AnimateOptions): AnimationControls {
  const { from, to, duration, onUpdate } = options;
  const repeat = options.repeat ?? 0;
  const startedAt = performance.now();
  const delta = to - from;

  let frame: number | undefined;
  let stopped = false;

  const tick = (now: number): void => {
    if (stopped) {
      return;
    }

    if (duration <= 0) {
      onUpdate(to);
      return;
    }

    const elapsed = now - startedAt;
    const cycle = Math.floor(elapsed / duration);
    if (repeat !== Infinity && cycle > repeat) {
      onUpdate(to);
      return;
    }

    onUpdate(from + delta * ((elapsed % duration) / duration));
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
  };
}
