"use client";

import { animate, motion, useMotionValue, type PanInfo } from "motion/react";
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal pager: one pane per child, swipe left/right or set `index` from tabs.
 * Same feel as Home's Money/Credit: position lives in one motion value so drags and taps never fight.
 */
export function SwipePager({ index, onIndexChange, children }: { index: number; onIndexChange: (i: number) => void; children: ReactNode }) {
  const panes = Children.toArray(children);
  const count = panes.length;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const snapTo = useCallback(
    (i: number, instant = false) => {
      const to = -i * width;
      if (instant) x.set(to);
      else animate(x, to, { type: "spring", stiffness: 300, damping: 34 });
    },
    [width, x],
  );

  // First paint and resizes jump straight to the pane; tab taps animate.
  const lastWidth = useRef(0);
  useEffect(() => {
    const resized = lastWidth.current !== width;
    lastWidth.current = width;
    snapTo(index, resized);
  }, [index, width, snapTo]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    let next = index;
    if (Math.abs(info.offset.x) >= Math.abs(info.offset.y)) {
      if (info.offset.x < -80 || info.velocity.x < -500) next = Math.min(count - 1, index + 1);
      if (info.offset.x > 80 || info.velocity.x > 500) next = Math.max(0, index - 1);
    }
    if (next === index) snapTo(index);
    else onIndexChange(next);
  };

  return (
    <div ref={ref} className="overflow-hidden">
      <motion.div
        className="flex items-start touch-pan-y"
        style={{ x, width: `${count * 100}%` }}
        drag="x"
        dragConstraints={{ left: -(count - 1) * width, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        dragDirectionLock
        onDragEnd={onDragEnd}
      >
        {panes.map((pane, i) => (
          <section key={i} className="px-4" style={{ width: `${100 / count}%` }} aria-hidden={i !== index} inert={i !== index}>
            {pane}
          </section>
        ))}
      </motion.div>
    </div>
  );
}
