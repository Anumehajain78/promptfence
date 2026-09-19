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
    <>
      <div
        aria-live="polite"
        className={`mt-2 font-mono text-[clamp(38px,3.5vw,64px)] font-medium leading-[0.95] tracking-[-0.04em] tabular-nums transition-colors duration-300 ${
          blocked ? "text-deny-fill" : "text-ink"
        } ${shaking ? "animate-pf-shake" : ""}`}
      >
        {inr(shown)}
      </div>
      <p className="m-0 mt-2.5 text-[16px] text-grey-700">
        of <span className={`font-mono ${blocked ? "text-deny-fill" : "text-ink"}`}>{inr(limit)}</span> policy limit
      </p>
    </>
  );
}
