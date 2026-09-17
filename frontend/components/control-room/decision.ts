import type { Decision, DecisionRecord } from "@/lib/api";

export const DECISION_WORD: Record<Decision, string> = {
  ALLOW: "Allow",
  APPROVAL: "Approval",
  DENY: "Deny",
};

export const DECISION_TEXT_CLASS: Record<Decision, string> = {
  ALLOW: "text-allow",
  APPROVAL: "text-amber",
  DENY: "text-deny",
};

// Display number: the ledger seq, or the row position when the backend runs stateless.
export function rowNumber(row: DecisionRecord, index: number): number {
  return row.seq ?? index + 1;
}

export function isCeilingBlock(row: DecisionRecord): boolean {
  return row.decision === "DENY" && row.policy === "cumulative-refund-ceiling-v1";
}
