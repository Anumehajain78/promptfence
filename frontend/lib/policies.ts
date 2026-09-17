// Mirrors backend/policies/*.cedar verbatim (the `cedar` strings are the file
// contents, byte for byte). If a policy file changes, update it here too.

import type { Decision, PolicyId } from "./api";

export interface LabelSegment {
  font: "sans" | "mono";
  text: string;
}

export interface PolicyDef {
  id: Exclude<PolicyId, "no-matching-policy">;
  file: string;
  // Chip text, e.g. "Support refund ≤" + mono "₹10,000".
  label: LabelSegment[];
  effect: Decision;
  // Lines of `cedar` containing any of these are the "evaluating" lines.
  highlight: string[];
  cedar: string;
}

export const POLICIES: PolicyDef[] = [
  {
    id: "allow-support-refund-small",
    file: "backend/policies/allow-support-refund-small.cedar",
    label: [{ font: "sans", text: "Support refund ≤" }, { font: "mono", text: "₹10,000" }],
    effect: "ALLOW",
    highlight: ["when {"],
    cedar: "@id(\"allow-support-refund-small\")\n// Support agents may refund up to ₹10,000 in a single call.\npermit (\n  principal is Agent,\n  action == Action::\"refund\",\n  resource is Order\n)\nwhen { principal.role == \"support\" && context.amount <= 10000 };\n",
  },
  {
    id: "hold-support-refund-large",
    file: "backend/policies/hold-support-refund-large.cedar",
    label: [{ font: "sans", text: "Support refund >" }, { font: "mono", text: "₹10,000" }],
    effect: "APPROVAL",
    highlight: ["@decision(\"APPROVAL\")","when {"],
    cedar: "@id(\"hold-support-refund-large\")\n@decision(\"APPROVAL\")\n// Support refunds above ₹10,000 are permitted only as APPROVAL (a human must confirm); see app.py.\npermit (\n  principal is Agent,\n  action == Action::\"refund\",\n  resource is Order\n)\nwhen { principal.role == \"support\" && context.amount > 10000 };\n",
  },
  {
    id: "cumulative-refund-ceiling-v1",
    file: "backend/policies/cumulative-refund-ceiling-v1.cedar",
    label: [{ font: "sans", text: "Support session refunds >" }, { font: "mono", text: "₹3,55,000" }],
    effect: "DENY",
    highlight: ["context.session_total + context.amount > 355000"],
    cedar: "@id(\"cumulative-refund-ceiling-v1\")\n// Support agents may not push the session's refund total above ₹3,55,000.\nforbid (\n  principal is Agent,\n  action == Action::\"refund\",\n  resource is Order\n)\nwhen {\n  principal.role == \"support\" &&\n  context.session_total + context.amount > 355000\n};\n",
  },
  {
    id: "forbid-support-delete",
    file: "backend/policies/forbid-support-delete.cedar",
    label: [{ font: "sans", text: "Support" }, { font: "mono", text: "delete_customer" }],
    effect: "DENY",
    highlight: ["when {"],
    cedar: "@id(\"forbid-support-delete\")\n// Support agents may never delete a customer.\nforbid (\n  principal is Agent,\n  action == Action::\"delete_customer\",\n  resource is Order\n)\nwhen { principal.role == \"support\" };\n",
  },
  {
    id: "allow-finance-refund",
    file: "backend/policies/allow-finance-refund.cedar",
    label: [{ font: "sans", text: "Finance refund ≤" }, { font: "mono", text: "₹1,00,000" }],
    effect: "ALLOW",
    highlight: ["when {"],
    cedar: "@id(\"allow-finance-refund\")\n// Finance agents may refund up to ₹1,00,000 in a single call.\npermit (\n  principal is Agent,\n  action == Action::\"refund\",\n  resource is Order\n)\nwhen { principal.role == \"finance\" && context.amount <= 100000 };\n",
  },
  {
    id: "forbid-intern-export",
    file: "backend/policies/forbid-intern-export.cedar",
    label: [{ font: "sans", text: "Intern" }, { font: "mono", text: "export_customer_data" }],
    effect: "DENY",
    highlight: ["when {"],
    cedar: "@id(\"forbid-intern-export\")\n// Intern agents may never export customer data.\nforbid (\n  principal is Agent,\n  action == Action::\"export_customer_data\",\n  resource is Order\n)\nwhen { principal.role == \"intern\" };\n",
  },
];

// Shown when Cedar found no permit (policy id "no-matching-policy").
export const DEFAULT_DENY_CEDAR = "// No permit policy matched this request.\n// Cedar denies by default.";

export function policyById(id: string): PolicyDef | undefined {
  return POLICIES.find((p) => p.id === id);
}
