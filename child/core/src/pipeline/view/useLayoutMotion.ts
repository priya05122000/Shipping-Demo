import { useEffect, useLayoutEffect, useRef } from 'react';

const MARK = '[data-layout-motion]';

const marked = (e: TransitionEvent) => e.target instanceof Element && e.target.matches(MARK);

/**
 * Elements marked `data-layout-motion` (the sidebar, the info panel's column)
 * animate their size, and with it the diagram's box. `hold` is called when the
 * first of them starts moving, and the function it returns once all have
 * stopped, so a diagram can keep its drawing a steady size instead of redrawing
 * it at every frame's size.
 */
export function useLayoutMotion(hold: () => () => void) {
  const latest = useRef(hold);
  useLayoutEffect(() => {
    latest.current = hold;
  });

  useEffect(() => {
    let release: (() => void) | null = null;
    const onRun = (e: TransitionEvent) => {
      if (marked(e)) release ??= latest.current();
    };
    const onStop = (e: TransitionEvent) => {
      if (!release || !marked(e)) return;
      // A transition cut short by a new one is cancelled with the new one already running.
      if ([...document.querySelectorAll(MARK)].some((el) => el.getAnimations().length > 0)) return;
      release();
      release = null;
    };
    document.addEventListener('transitionrun', onRun);
    document.addEventListener('transitionend', onStop);
    document.addEventListener('transitioncancel', onStop);
    return () => {
      document.removeEventListener('transitionrun', onRun);
      document.removeEventListener('transitionend', onStop);
      document.removeEventListener('transitioncancel', onStop);
      release?.();
    };
  }, []);
}
