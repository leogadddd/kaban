"use client";

import { animate, motion, useMotionValue, type PanInfo } from "motion/react";
import { Children, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal pager: one pane per child, swipe left/right or set `index` from tabs.
 * Same feel as Home's Money/Credit: position lives in one motion value so drags and taps never fight.
 */
export function SwipePager({ index, onIndexChange, children }: { index: number; onIndexChange: (i: number) => void; children: ReactNode }) {
  const panes = Children.toArray(children);
  const count = panes.length;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Fill down to the bottom of the screen, so a swipe on the empty space below a short pane still works.
  const [minHeight, setMinHeight] = useState(0);
  const x = useMotionValue(0);
  // The pane we last came to rest on. It stays full height until the slide away finishes, so it doesn't
  // vanish mid-swipe; every other pane is clipped to the screen, keeping the strip as tall as one pane.
  const [settled, setSettled] = useState(index);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setMinHeight(Math.max(0, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const snapTo = useCallback(
    (i: number, instant = false) => {
      const to = -i * width;
      if (instant) {
        x.set(to);
        setSettled(i);
      } else void animate(x, to, { type: "spring", stiffness: 300, damping: 34 }).then(() => setSettled(i));
    },
    [width, x],
  );

  // Activity restores the selected tab but recreates effects on back navigation.
  // Restore its position before paint, even when the saved width has not changed.
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    return () => {
      lastWidth.current = 0;
      x.stop();
    };
  }, [x]);
  useLayoutEffect(() => {
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
        style={{ x, width: `${count * 100}%`, minHeight }}
        drag="x"
        dragConstraints={{ left: -(count - 1) * width, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        dragDirectionLock
        onDragEnd={onDragEnd}
      >
        {panes.map((pane, i) => (
          <section
            key={i}
            className="px-4"
            style={{ width: `${100 / count}%`, ...(i !== index && i !== settled && { height: minHeight || "100dvh", overflow: "clip" }) }}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            {pane}
          </section>
        ))}
      </motion.div>
    </div>
  );
}
