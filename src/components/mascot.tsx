"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { ChestArt } from "./chest-art";

/** The mascot's moves (the reactions from the character sheet). One-shots call `onDone`; loops run until the action changes. */
export const MASCOT_ACTIONS = {
  idle: { loop: true },
  peek: { loop: false },
  "coin-in": { loop: false },
  "coin-out": { loop: false },
  celebrate: { loop: false },
  squish: { loop: false },
  hop: { loop: true },
  talk: { loop: true },
  sleep: { loop: true },
  empty: { loop: false },
  alert: { loop: false },
  worried: { loop: true },
  nope: { loop: false },
  locked: { loop: false },
} as const;

export type MascotAction = keyof typeof MASCOT_ACTIONS;

/* eslint-disable @typescript-eslint/no-explicit-any -- motion keyframe/option shapes vary per call */
type Go = (sel: string, kf: any, opts?: any) => Promise<unknown>;

const spring = (stiffness: number, damping: number, extra?: object) => ({ type: "spring", stiffness, damping, ...extra });
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const EASE = [0.22, 1, 0.36, 1] as const;

const REST: [string, Record<string, number>][] = [
  [".kc-rig", { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 }],
  [".kc-lid", { x: 0, y: 0, rotate: 0 }],
  [".kc-shadow", { scaleX: 1, opacity: 0.16 }],
  [".kc-pupil", { x: 0, y: 0, scale: 1 }],
  [".kc-eye", { opacity: 1, scaleY: 1 }],
  [".kc-happy, .kc-sleep", { opacity: 0 }],
  [".kc-glow", { opacity: 0 }],
  [".kc-fx", { opacity: 0, x: 0, y: 0, scale: 1, rotate: 0 }],
  [".kc-leaf", { opacity: 1, scale: 1 }],
  [".kc-lock", { opacity: 0, y: 0 }],
];

async function perform(action: MascotAction, go: Go, wait: (ms: number) => Promise<void>, alive: () => boolean) {
  const blink = () => go(".kc-eye", { scaleY: [1, 0.08, 1] }, { duration: 0.2, ease: "easeInOut" });
  const face = (eyes: "open" | "happy" | "sleep") => {
    void go(".kc-eye", { opacity: eyes === "open" ? 1 : 0 }, { duration: 0.12 });
    void go(".kc-happy", { opacity: eyes === "happy" ? 1 : 0 }, { duration: 0.12 });
    void go(".kc-sleep", { opacity: eyes === "sleep" ? 1 : 0 }, { duration: 0.12 });
  };
  // Lid moves: lift (y) plus a tilt back around the hinge (positive = the front swings up).
  const openLid = (y = -12, rotate = 2, s: any = spring(420, 20)) => {
    void go(".kc-glow", { opacity: 0.85 }, { duration: 0.25 });
    return go(".kc-lid", { y, rotate }, s);
  };
  const closeLid = (s: any = spring(520, 24)) => {
    void go(".kc-glow", { opacity: 0 }, { duration: 0.2 });
    return go(".kc-lid", { y: 0, rotate: 0 }, s);
  };
  const thud = () => go(".kc-rig", { scaleY: [1, 0.94, 1.02, 1], scaleX: [1, 1.04, 0.99, 1] }, { duration: 0.32, ease: "easeOut" });
  const sparkle = () => {
    for (let i = 0; i < 3; i++) void go(`.kc-spark-${i}`, { opacity: [0, 1, 0], scale: [0.3, 1.15, 0.3], rotate: [0, 90] }, { duration: 0.75, delay: i * 0.12, ease: "easeOut" });
  };
  const peek = async (look = Math.random() < 0.5 ? -1 : 1) => {
    await openLid(-12, 2);
    if (!alive()) return;
    await wait(120);
    await go(".kc-pupil", { x: 1.6 * look }, { duration: 0.28, ease: EASE });
    await wait(320);
    if (!alive()) return;
    await go(".kc-pupil", { x: -1.6 * look }, { duration: 0.4, ease: EASE });
    await wait(200);
    await blink();
    await go(".kc-pupil", { x: 0 }, { duration: 0.25, ease: EASE });
    await wait(150);
    if (!alive()) return;
    void closeLid();
    await wait(140);
    await thud();
  };

  switch (action) {
    case "idle": {
      void go(".kc-rig", { y: [0, -2.5, 0] }, { duration: 3.6, repeat: Infinity, ease: "easeInOut" });
      void go(".kc-shadow", { scaleX: [1, 0.9, 1], opacity: [0.16, 0.11, 0.16] }, { duration: 3.6, repeat: Infinity, ease: "easeInOut" });
      for (;;) {
        await wait(rnd(4200, 6500));
        if (!alive()) return;
        await peek();
        if (!alive()) return;
      }
    }

    case "peek":
      await wait(250);
      return peek();

    case "coin-in": {
      await go(".kc-coin-0", { x: 0, y: -74, opacity: 0, rotate: 0 }, { duration: 0 });
      void openLid(-14, 3, spring(500, 18));
      await go(".kc-coin-0", { y: [-74, -8], opacity: [0, 1], rotate: [0, 300] }, { duration: 0.5, ease: "easeIn" });
      void go(".kc-coin-0", { y: 4, opacity: 0 }, { duration: 0.1 });
      void closeLid(spring(700, 22));
      await go(".kc-rig", { scaleY: [1, 0.86, 1.06, 1], scaleX: [1, 1.1, 0.97, 1] }, { duration: 0.5, ease: "easeOut" });
      sparkle();
      return wait(600);
    }

    case "coin-out": {
      await openLid(-13, 2);
      void go(".kc-pupil", { x: 1.6, y: -1 }, { duration: 0.3, ease: EASE });
      await go(".kc-coin-0", { x: [0, 16, 34], y: [0, -38, -22], opacity: [0, 1, 1, 0], rotate: [0, 220] }, { duration: 0.9, ease: "easeOut" });
      if (!alive()) return;
      await go(".kc-pupil", { x: 0, y: 1 }, { duration: 0.35, ease: EASE });
      void go(".kc-rig", { scaleY: [1, 0.96, 1], scaleX: [1, 1.03, 1] }, { duration: 0.6, ease: "easeInOut" });
      await wait(350);
      await closeLid({ duration: 0.45, ease: "easeInOut" });
      return go(".kc-pupil", { y: 0 }, { duration: 0 });
    }

    case "celebrate": {
      await go(".kc-rig", { scaleY: 0.86, scaleX: 1.08 }, { duration: 0.14, ease: "easeOut" });
      void go(".kc-rig", { y: -16, scaleY: 1.06, scaleX: 0.96 }, { duration: 0.26, ease: "easeOut" });
      void go(".kc-shadow", { scaleX: 0.7, opacity: 0.08 }, { duration: 0.26 });
      void openLid(-6, 22, spring(380, 14));
      face("happy");
      for (let i = 0; i < 8; i++) {
        const peak = rnd(34, 54);
        void go(
          `.kc-coin-${i}`,
          { x: [0, (i - 3.5) * 9 + rnd(-3, 3)], y: [0, -peak, -peak * 0.45], opacity: [0, 1, 1, 0], rotate: [0, rnd(-300, 300)] },
          { duration: 1, delay: 0.06 + i * 0.03, ease: "easeOut" },
        );
      }
      sparkle();
      await wait(260);
      void go(".kc-shadow", { scaleX: 1, opacity: 0.16 }, { duration: 0.2 });
      await go(".kc-rig", { y: 0, scaleY: 0.9, scaleX: 1.07 }, { duration: 0.2, ease: "easeIn" });
      await go(".kc-rig", { scaleY: 1, scaleX: 1 }, spring(500, 14));
      await wait(500);
      if (!alive()) return;
      face("open");
      void closeLid();
      await wait(140);
      return thud();
    }

    case "squish":
      void go(".kc-lid", { y: [0, -6, 0] }, { duration: 0.4 });
      return go(".kc-rig", { scaleY: [1, 0.8, 1.1, 0.97, 1], scaleX: [1, 1.13, 0.93, 1.02, 1] }, { duration: 0.6 });

    case "hop":
      for (;;) {
        void go(".kc-shadow", { scaleX: 0.8 }, { duration: 0.22 });
        void go(".kc-lid", { y: -6 }, { duration: 0.2, delay: 0.05 });
        await go(".kc-rig", { y: -10, scaleY: 1.05, scaleX: 0.97 }, { duration: 0.22, ease: "easeOut" });
        void go(".kc-shadow", { scaleX: 1 }, { duration: 0.2 });
        await go(".kc-rig", { y: 0, scaleY: 1, scaleX: 1 }, { duration: 0.2, ease: "easeIn" });
        void go(".kc-lid", { y: 0 }, spring(700, 18));
        await go(".kc-rig", { scaleY: [1, 0.9, 1], scaleX: [1, 1.06, 1] }, { duration: 0.22 });
        if (!alive()) return;
        await wait(80);
      }

    case "talk":
      for (let n = 0; ; n++) {
        void go(".kc-rig", { rotate: [0, -2, 2, 0] }, { duration: 1.1, ease: "easeInOut" });
        await go(".kc-lid", { y: [0, -10, -3, -12, -2, -8, 0] }, { duration: 1.1, ease: "easeInOut" });
        if (!alive()) return;
        await wait(500);
        if (n % 2) {
          await go(".kc-lid", { y: -11 }, { duration: 0.15 });
          await blink();
          await go(".kc-lid", { y: 0 }, { duration: 0.15 });
        }
        await wait(300);
        if (!alive()) return;
      }

    case "sleep": {
      face("sleep");
      await go(".kc-lid", { y: -8 }, { duration: 0.6, ease: "easeInOut" });
      void go(".kc-lid", { y: [-8, -9.5, -8] }, { duration: 3, repeat: Infinity, ease: "easeInOut" });
      void go(".kc-rig", { scaleY: [1, 1.03, 1] }, { duration: 3, repeat: Infinity, ease: "easeInOut" });
      for (let i = 0; i < 3; i++)
        void go(`.kc-z-${i}`, { opacity: [0, 1, 0], x: [0, 6 + i * 3], y: [0, -14 - i * 4], scale: [0.6, 1] }, { duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: "easeOut" });
      return;
    }

    case "empty": {
      await openLid(-16, 2);
      await go(".kc-pupil", { y: 1.6 }, { duration: 0.3, ease: EASE });
      await wait(350);
      if (!alive()) return;
      for (let i = 0; i < 3; i++)
        void go(`.kc-dust-${i}`, { opacity: [0, 0.5, 0], scale: [0.4, 1.6], x: [0, 40 + i * 6], y: [0, -18 - i * 8] }, { duration: 1.1, delay: i * 0.1, ease: "easeOut" });
      await wait(900);
      await go(".kc-pupil", { y: 0 }, { duration: 0.25 });
      await blink();
      await go(".kc-rig", { rotate: [0, -3, 3, 0] }, { duration: 0.5 });
      if (!alive()) return;
      return closeLid({ duration: 0.4, ease: "easeInOut" });
    }

    case "alert": {
      void go(".kc-rig", { y: [0, -8, 0] }, { duration: 0.35 });
      await openLid(-19, 0, spring(700, 18));
      void go(".kc-pupil", { scale: 0.75 }, { duration: 0.15 });
      await go(".kc-bang", { opacity: 1, y: -16, scale: [0.4, 1.2, 1] }, { duration: 0.35 });
      await go(".kc-bang", { rotate: [0, -12, 10, -6, 0] }, { duration: 0.5 });
      await wait(700);
      if (!alive()) return;
      void go(".kc-bang", { opacity: 0, y: -22 }, { duration: 0.25 });
      void go(".kc-pupil", { scale: 1 }, { duration: 0.2 });
      return closeLid();
    }

    case "worried":
      await openLid(-13, 0);
      void go(".kc-pupil", { scale: 0.65 }, { duration: 0.2 });
      for (;;) {
        void go(".kc-sweat", { opacity: [0, 1, 1, 0], y: [0, 12] }, { duration: 1.2, ease: "easeIn" });
        await go(".kc-rig", { x: [0, -1.2, 1.2, -1.2, 1.2, -1, 1, 0] }, { duration: 0.5 });
        await go(".kc-pupil", { x: [0, -1.4, 1.4, 0] }, { duration: 0.8 });
        if (!alive()) return;
        await wait(600);
        if (!alive()) return;
      }

    case "nope":
      void go(".kc-lid", { y: [0, -3, 0, -3, 0, -2, 0] }, { duration: 0.55 });
      return go(".kc-rig", { rotate: [0, -8, 7, -5, 3, 0] }, { duration: 0.55 });

    case "locked":
      void go(".kc-leaf", { opacity: 0, scale: 0.6 }, { duration: 0.15 });
      await go(".kc-lock", { opacity: 1, y: [-4, 0] }, spring(600, 16));
      return go(".kc-rig", { rotate: [0, -3, 3, -1.5, 0] }, { duration: 0.4 });
  }
}

/** Kaban's mascot. Change `action` (or bump `playKey` to replay it) to make it perform. */
export function Mascot({ action = "idle", playKey = 0, onDone, className }: { action?: MascotAction; playKey?: number; onDone?: () => void; className?: string }) {
  const [scope, animate] = useAnimate<SVGSVGElement>();
  const reduce = useReducedMotion();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!scope.current) return;
    let alive = true;
    const running = new Set<{ stop: () => void }>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const go: Go = (sel, kf, opts) => {
      if (!alive) return new Promise(() => {});
      const c = animate(sel, kf, opts);
      running.add(c);
      return c.then(() => void running.delete(c));
    };
    const wait = (ms: number) =>
      new Promise<void>((r) => {
        const t = setTimeout(() => (timers.delete(t), r()), ms);
        timers.add(t);
      });

    // Settle into the rest pose quickly, so switching actions never jumps.
    for (const [sel, pose] of REST) animate(sel, pose, { duration: sel === ".kc-fx" ? 0 : 0.18 });
    if (reduce) {
      // No motion: hold the pose that carries the meaning.
      if (action === "locked") {
        animate(".kc-leaf", { opacity: 0 }, { duration: 0 });
        animate(".kc-lock", { opacity: 1 }, { duration: 0 });
      } else animate(".kc-lid", { y: -12 }, { duration: 0 });
      if (action === "sleep") {
        animate(".kc-eye", { opacity: 0 }, { duration: 0 });
        animate(".kc-sleep", { opacity: 1 }, { duration: 0 });
      }
      if (!MASCOT_ACTIONS[action].loop) done.current?.();
    } else {
      const t = setTimeout(() => {
        void perform(action, go, wait, () => alive).then(() => alive && !MASCOT_ACTIONS[action].loop && done.current?.());
      }, 190);
      timers.add(t);
    }
    return () => {
      alive = false;
      running.forEach((c) => c.stop());
      timers.forEach(clearTimeout);
    };
  }, [action, playKey, reduce, animate, scope]);

  return <ChestArt svgRef={scope} className={className} />;
}
