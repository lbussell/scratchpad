import { type RefObject, useLayoutEffect, useRef } from "react";

/** Where each keyed element was when it last unmounted, and when. */
const departures = new Map<string, { left: number; top: number; at: number }>();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Animates an element in. If an element with the same key unmounted in the same render (it moved
 * to another place in the tree, like someone's avatar moving to another note in the list), it
 * slides over from there; otherwise it pops in.
 */
export function useSlide<T extends HTMLElement>(key: string): RefObject<T | null> {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const from = departures.get(key);
    departures.delete(key);
    const to = element.getBoundingClientRect();
    const dx = from ? from.left - to.left : 0;
    const dy = from ? from.top - to.top : 0;
    const moved = from && performance.now() - from.at < 100 && Math.hypot(dx, dy) >= 1;
    if (!reducedMotion.matches) {
      element.animate(
        moved
          ? [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }]
          : [
              { scale: 0, opacity: 0 },
              { scale: 1, opacity: 1 },
            ],
        { duration: moved ? 250 : 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
    return () => {
      // React runs this before removing the element, so it's still where it was.
      const { left, top } = element.getBoundingClientRect();
      departures.set(key, { left, top, at: performance.now() });
    };
  }, [key]);

  return ref;
}
