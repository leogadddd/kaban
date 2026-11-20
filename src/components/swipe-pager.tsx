"use client";

import { motion, useMotionValue, type PanInfo } from "motion/react";
import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal pager: one pane per child, swipe left/right or set `index` from tabs.
 * Tab position is declarative. Motion only handles the temporary offset during a swipe.
 */
export function SwipePager({ index, onIndexChange, children }: { index: number; onIndexChange: (i: number) => void; children: ReactNode }) {
  const panes = Children.toArray(children);
  const count = panes.length;
  const ref = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const timer = setTimeout(() => setSettled(index), 350);
    return () => clearTimeout(timer);
  }, [index]);

  useLayoutEffect(() => {
    // A restored Activity must discard any unfinished drag, preserving the selected pane.
    x.jump(0);
    return () => x.stop();
  }, [x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    let next = index;
    if (Math.abs(info.offset.x) >= Math.abs(info.offset.y)) {
      if (info.offset.x < -80 || info.velocity.x < -500) next = Math.min(count - 1, index + 1);
      if (info.offset.x > 80 || info.velocity.x > 500) next = Math.max(0, index - 1);
    }
    if (next !== index) onIndexChange(next);
  };

  return (
    <div ref={ref} className="overflow-hidden">
      <div
        className="transition-transform duration-350 ease-out motion-reduce:transition-none"
        style={{ width: "100%", transform: `translateX(${-index * 100}%)` }}
      >
        <motion.div
          className="flex items-start touch-pan-y"
          style={{ x, width: `${count * 100}%`, minHeight }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
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
    </div>
  );
}
