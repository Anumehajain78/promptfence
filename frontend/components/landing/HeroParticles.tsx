"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's particle formation: a hollow ring of small radial dashes that
 * follows the pointer.
 *
 * Every number here was measured from the reference recording (1900px wide):
 *  - dashes point away from a centre that trails the pointer;
 *  - they are small: about 7 x 3px at the very largest, 4.6px long at the median, and roughly a third
 *    are no more than specks;
 *  - they sit about 58px apart, and are only full size in a band around a ring,
 *    so the middle is hollow and the outside fades out;
 *  - the ring's radius is driven by the pointer, not a clock: while the pointer moves slowly or
 *    rests the ring opens out (about +100px/s), while it moves fast the ring tightens (about
 *    -80px/s), and it holds steady near 420px/s. It ranges from about 330 to 650px;
 *  - the ring is not a true circle: its radius varies by about 10% around the circumference, and
 *    that unevenness drifts;
 *  - the formation is not rigid: each particle follows with its own lag, which is
 *    what makes it trail and settle like a fluid;
 *  - colour is pinned to the particle, in coherent patches: about half blue and
 *    indigo, then crimson, orange and a little yellow.
 *
 * Canvas 2D, one loop, and only while the hero is on screen and the tab is
 * visible. With prefers-reduced-motion it draws one still frame and stops.
 */

// Colours from the recording, as [share of particles, fill]. Order is the order along the colour field.
const PALETTE: [number, string][] = [
  [0.38, "#4F64DD"],
  [0.13, "#6665DA"],
  [0.03, "#8A5AA0"],
  [0.2, "#C5516B"],
  [0.08, "#DB6336"],
  [0.08, "#E4773E"],
  [0.1, "#EBC744"],
];

const REFERENCE_WIDTH = 1900; // the recording's viewport; radii scale from it
const SPACING = 58;
const DASH_LENGTH = 7;
const DASH_WIDTH = 3;
const MAX_ALPHA = 0.85; // the recording's dots sit lightly on the page
const BAND = 125; // half-width of the band in which dashes are full size
// Ring radius against pointer speed (reference px/s): wide at rest, tight when fast, easing between over RING.lag.
const RING = { rest: 650, tight: 330, slow: 120, fast: 620, lag: 1.4, start: 480 };
const SPEED_LAG = 0.35; // seconds; smoothing of the measured pointer speed
const WOBBLE = [0.08, 0.05]; // how far the ring departs from a circle, as a share of its radius (2 and 3 lobes)
const EXTENT = 950; // how far out the formation has particles at all
const CENTRE_LAG = 0.24; // seconds; the point the dashes aim away from
const PARTICLE_LAG: [number, number] = [0.12, 0.5]; // seconds; each particle gets its own
const SPIN = 0.09; // radians per second

interface Particle {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  lag: number;
  colour: string;
  size: number; // this particle's own share of full size: dots in the recording are far from uniform
}

// Small seeded generator: the formation is the same on every load.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFormation(scale: number): Particle[] {
  const random = seeded(7);
  const spacing = SPACING * Math.max(scale, 0.7);
  const homes: { x: number; y: number; field: number; lag: number; size: number }[] = [];
  for (let radius = spacing; radius <= EXTENT * scale; radius += spacing) {
    const count = Math.max(6, Math.round((2 * Math.PI * radius) / spacing));
    const offset = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.18 * (spacing / radius);
      const r = radius + (random() - 0.5) * spacing * 0.3;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      // A smooth field over the formation, so neighbours share a colour and warm colours come in patches.
      const u = x / (EXTENT * scale);
      const v = y / (EXTENT * scale);
      const field = Math.sin(3.1 * u + 1.7 * v + 0.6) + Math.sin(-2.3 * u + 3.7 * v + 2.1) + 0.6 * Math.sin(5.2 * u - 4.1 * v + 4.4) + (random() - 0.5) * 0.5;
      homes.push({ x, y, field, lag: PARTICLE_LAG[0] + random() * (PARTICLE_LAG[1] - PARTICLE_LAG[0]), size: 0.5 + 0.5 * random() });
    }
  }
  // Colour by rank in the field, so the shares match the recording exactly while patches stay coherent.
  const order = homes.map((_, i) => i).sort((a, b) => homes[a].field - homes[b].field);
  const colours = new Array<string>(homes.length);
  let from = 0;
  let cumulative = 0;
  for (const [share, fill] of PALETTE) {
    cumulative += share;
    const to = Math.round(cumulative * homes.length);
    for (let k = from; k < to; k++) colours[order[k]] = fill;
    from = to;
  }
  for (let k = from; k < homes.length; k++) colours[order[k]] = PALETTE[PALETTE.length - 1][1];
  return homes.map((h, i) => ({ homeX: h.x, homeY: h.y, x: NaN, y: NaN, lag: h.lag, colour: colours[i], size: h.size }));
}

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let scale = 1;
    let particles: Particle[] = [];
    // Pointer target and the trailing centre, in canvas coordinates. Until the pointer arrives, the hero's centre.
    let targetX = 0;
    let targetY = 0;
    let centreX = 0;
    let centreY = 0;
    let pointerSeen = false;
    // Where the target was last frame, the smoothed pointer speed (reference px/s) and the ring's current radius.
    let lastTargetX = 0;
    let lastTargetY = 0;
    let speed = 0;
    let ringRadius = RING.start;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const nextScale = Math.min(1.15, Math.max(0.42, window.innerWidth / REFERENCE_WIDTH));
      if (nextScale !== scale || particles.length === 0) {
        scale = nextScale;
        particles = buildFormation(scale);
      }
      if (!pointerSeen) {
        targetX = centreX = lastTargetX = width / 2;
        targetY = centreY = lastTargetY = Math.min(height / 2, window.innerHeight * 0.46);
      }
    };

    const draw = (time: number, dt: number) => {
      const follow = (lag: number) => (dt <= 0 ? 1 : 1 - Math.exp(-dt / lag));
      centreX += (targetX - centreX) * follow(CENTRE_LAG);
      centreY += (targetY - centreY) * follow(CENTRE_LAG);

      // The pointer drives the ring: measure its speed, ease the radius toward what that speed calls for.
      if (dt > 0) {
        const moved = Math.hypot(targetX - lastTargetX, targetY - lastTargetY) / scale / dt;
        speed += (moved - speed) * follow(SPEED_LAG);
        const pace = Math.min(1, Math.max(0, (speed - RING.slow) / (RING.fast - RING.slow)));
        ringRadius += (RING.rest + (RING.tight - RING.rest) * pace - ringRadius) * follow(RING.lag);
      }
      lastTargetX = targetX;
      lastTargetY = targetY;
      const ring = scale * (ringRadius + 16 * Math.sin(time * 1.3));
      const lobes2 = time * 0.21 + 0.7;
      const lobes3 = -time * 0.16 + 2.2;
      const band = BAND * scale;
      // Dashes stay their measured size on desktop and ease down a little on small screens, where the ring is tighter.
      const dash = Math.min(1, 0.55 + 0.6 * scale);
      const spin = time * SPIN;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);

      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      for (const p of particles) {
        const wantX = targetX + p.homeX * cos - p.homeY * sin;
        const wantY = targetY + p.homeX * sin + p.homeY * cos;
        if (Number.isNaN(p.x)) {
          p.x = wantX;
          p.y = wantY;
        } else {
          const k = follow(p.lag);
          p.x += (wantX - p.x) * k;
          p.y += (wantY - p.y) * k;
        }
        if (p.x < -12 || p.y < -12 || p.x > width + 12 || p.y > height + 12) continue;

        const dx = p.x - centreX;
        const dy = p.y - centreY;
        const distance = Math.hypot(dx, dy) || 1;
        const direction = Math.atan2(dy, dx);
        const ringHere = ring * (1 + WOBBLE[0] * Math.sin(2 * direction + lobes2) + WOBBLE[1] * Math.sin(3 * direction + lobes3));
        const off = (distance - ringHere) / band;
        if (off > 3.2) continue; // beyond the formation's edge there is nothing, not even specks
        const size = Math.exp(-off * off) * p.size;
        // Below a fifth of full size a particle is a round speck (a zero-length stroke with round caps), not a dash.
        const length = size > 0.2 ? DASH_LENGTH * dash * size : 0.01;
        const half = (length * 0.5) / distance;

        context.globalAlpha = 0.32 + (MAX_ALPHA - 0.32) * size;
        context.strokeStyle = p.colour;
        context.lineWidth = Math.max(1.3, DASH_WIDTH * dash * Math.min(1, size * 1.15));
        context.beginPath();
        context.moveTo(p.x - dx * half, p.y - dy * half);
        context.lineTo(p.x + dx * half, p.y + dy * half);
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    resize();

    if (reduced) {
      draw(0.9, 0);
      const onResize = () => {
        resize();
        draw(0.9, 0);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    let frame = 0;
    let last = 0;
    let clock = 0;
    let onScreen = true;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;
      draw(clock, dt);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && onScreen && !document.hidden) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (event.clientY > rect.bottom || event.clientY < rect.top) return;
      pointerSeen = true;
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });

    observer.observe(canvas);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full" />;
}
