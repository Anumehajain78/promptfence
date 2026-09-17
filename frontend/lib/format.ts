// Indian digit grouping: 100000 → ₹1,00,000 (same as backend _inr).
export function inr(value: number): string {
  const sign = value < 0 ? "-" : "";
  let digits = String(Math.abs(Math.round(value)));
  if (digits.length > 3) {
    let head = digits.slice(0, -3);
    const tail = digits.slice(-3);
    const groups: string[] = [];
    while (head.length > 2) {
      groups.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    if (head) groups.unshift(head);
    digits = [...groups, tail].join(",");
  }
  return `${sign}₹${digits}`;
}

// "2026-09-18T14:02:31.114Z" → "14:02:31.114" in the viewer's local time.
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

// #1 → "#01"
export function seqLabel(seq: number): string {
  return `#${String(seq).padStart(2, "0")}`;
}

export interface TextSegment {
  mono: boolean;
  text: string;
}

// Splits prose so values and identifiers render in Geist Mono:
// rupee amounts, #numbers, snake_case identifiers and policy ids (2+ hyphens,
// so prose like "per-call" stays in Geist).
const MONO_TOKEN = /(₹\d+(?:,\d+)*|#\d+|\b[a-z]+(?:_[a-z0-9]+)+\b(?:\(\))?|\b[a-z]+(?:-[a-z0-9]+){2,}\b)/;

export function monoSegments(text: string): TextSegment[] {
  // split() with a capture group alternates plain text (even) and matches (odd).
  return text
    .split(MONO_TOKEN)
    .map((part, i) => ({ mono: i % 2 === 1, text: part }))
    .filter((seg) => seg.text !== "");
}
