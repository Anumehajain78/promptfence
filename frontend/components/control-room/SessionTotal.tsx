"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";

interface Props {
  value: number;
  limit: number;
  blocked: boolean;
  reducedMotion: boolean;
}

const INTERPOLATE_MS = 300;
const SHAKE_MS = 150;

export function SessionTotal({ value, limit, blocked, reducedMotion }: Props) {
  const [shown, setShown] = useState(value);
  const [shaking, setShaking] = useState(false);
  const shownRef = useRef(value);
  const wasBlocked = useRef(blocked);

  useEffect(() => {
    if (reducedMotion) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / INTERPOLATE_MS);
      shownRef.current = from + (value - from) * p;
      setShown(shownRef.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);

  useEffect(() => {
    if (blocked && !wasBlocked.current && !reducedMotion) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), SHAKE_MS);
      wasBlocked.current = blocked;
      return () => clearTimeout(t);
    }
    wasBlocked.current = blocked;
  }, [blocked, reducedMotion]);

  return (
    <div className="mt-auto pt-[18px]">
      <div
        aria-live="polite"
        className={`font-mono text-[clamp(40px,4.4vw,76px)] font-medium leading-none tracking-[-0.03em] tabular-nums ${
          blocked ? "text-deny" : "text-ink"
        } ${shaking ? "animate-pf-shake" : ""}`}
      >
        {inr(shown)}
      </div>
      <div className="mt-2 text-sm text-grey-500">
        of <span className="font-mono text-grey-700">{inr(limit)}</span> policy limit
      </div>
    </div>
  );
}
